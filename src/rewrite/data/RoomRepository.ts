import {
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  type Unsubscribe,
} from "firebase/database";
import { db } from "../../lib/firebase";
import {
  createDefaultLobbyConfig,
  generateGameId,
  getDefaultGameMode,
  type MapType,
  type Player,
  type RoomState,
} from "../domain";
import { createGameState, type GameState } from "../game/GameState";
import type { GameModeId } from "../game/GameMode";
import { createRelayModeState } from "../game/RelayModeState";
import {
  canStartGame,
  canSubmitRound,
  cancelClearVote,
  castClearVote,
  getHostId,
  hasClearVotePassed,
  nextRoundState,
  orderPlayers,
  recoverMissingCurrentPlayer,
  requestClearVote,
} from "../game/GameRules";

const MAX_RELAY_PAGE_BYTES = 8 * 1024 * 1024;

type WatchErrorCallback = (error: Error) => void;

function roomRef(roomId: string) { return ref(db, `rooms/${roomId}`); }
function gameRef(gameId: string) { return ref(db, `games/${gameId}`); }
function relayPagesRef(gameId: string) { return ref(db, `relayPages/${gameId}`); }

export function watchRoom(
  roomId: string,
  callback: (room: RoomState | null) => void,
  onError?: WatchErrorCallback,
): Unsubscribe {
  return onValue(
    roomRef(roomId),
    (snapshot) => callback(snapshot.val() as RoomState | null),
    (error) => onError?.(error),
  );
}

export function watchGame(
  gameId: string,
  callback: (game: GameState | null) => void,
  onError?: WatchErrorCallback,
): Unsubscribe {
  return onValue(
    gameRef(gameId),
    (snapshot) => callback(snapshot.val() as GameState | null),
    (error) => onError?.(error),
  );
}

export function watchRelayPages(
  gameId: string,
  callback: (pages: Record<string, string>) => void,
  onError?: WatchErrorCallback,
): Unsubscribe {
  return onValue(
    relayPagesRef(gameId),
    (snapshot) => callback((snapshot.val() as Record<string, string> | null) ?? {}),
    (error) => onError?.(error),
  );
}

export async function upsertPlayer(roomId: string, player: Player): Promise<void> {
  await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current) {
      return {
        players: { [player.id]: player },
        currentGameId: null,
        lobby: createDefaultLobbyConfig(),
        createdAt: Date.now(),
      } satisfies RoomState;
    }

    if (current.currentGameId !== null) {
      const existing = current.players[player.id];
      if (existing) {
        return {
          ...current,
          players: {
            ...current.players,
            [player.id]: { ...existing, name: player.name },
          },
        } satisfies RoomState;
      }
      return current;
    }

    return {
      ...current,
      players: {
        ...current.players,
        [player.id]: {
          ...player,
          joinedAt: current.players[player.id]?.joinedAt ?? player.joinedAt,
        },
      },
    } satisfies RoomState;
  }, { applyLocally: false });
}

export async function startPlayerPresence(roomId: string, playerId: string): Promise<void> {
  await onDisconnect(ref(db, `rooms/${roomId}/players/${playerId}`)).remove();
}

export async function leaveRoom(roomId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current || !current.players[playerId]) return;
    const players = { ...current.players };
    delete players[playerId];
    if (Object.keys(players).length === 0) return null;
    return { ...current, players } satisfies RoomState;
  }, { applyLocally: false });

  if (result.committed) {
    const room = result.snapshot.val() as RoomState | null;
    if (room?.currentGameId) await recoverMissingCurrentPlayerTurn(roomId, room.currentGameId);
  }

  return result.committed;
}

export async function recoverMissingCurrentPlayerTurn(roomId: string, gameId: string): Promise<boolean> {
  const result = await runTransaction(ref(db), (root: unknown) => {
    const currentRoot = (root ?? {}) as {
      rooms?: Record<string, RoomState | undefined>;
      games?: Record<string, GameState | undefined>;
    };
    const room = currentRoot.rooms?.[roomId] ?? null;
    const game = currentRoot.games?.[gameId] ?? null;
    if (!room || !game || room.currentGameId !== gameId) return;

    const activePlayerIds = new Set(Object.keys(room.players));
    const recovered = recoverMissingCurrentPlayer(game, activePlayerIds);
    if (!recovered) return;

    return {
      ...currentRoot,
      games: {
        ...(currentRoot.games ?? {}),
        [gameId]: recovered,
      },
    };
  }, { applyLocally: false });

  return result.committed;
}

export async function startGame(
  roomId: string,
  playerId: string,
  map: MapType,
  mode: GameModeId = getDefaultGameMode()
): Promise<string> {
  const gameId = generateGameId();
  const createdAt = Date.now();

  const result = await runTransaction(ref(db), (root: unknown) => {
    const currentRoot = (root ?? {}) as {
      rooms?: Record<string, RoomState | undefined>;
      games?: Record<string, GameState | undefined>;
    };
    const room = currentRoot.rooms?.[roomId] ?? null;
    if (!room || !canStartGame(room, playerId)) return;

    const participantIds = orderPlayers(room.players).map((player) => player.id);
    if (!participantIds.length) return;

    const game = createGameState({
      gameId,
      roomId,
      mode,
      map,
      participantIds,
      currentPlayerId: participantIds[0] ?? null,
      createdAt,
      modeState: mode === "relay-30" ? createRelayModeState() : {},
    });

    return {
      ...currentRoot,
      rooms: {
        ...(currentRoot.rooms ?? {}),
        [roomId]: {
          ...room,
          currentGameId: gameId,
          lobby: { selectedMode: mode, selectedMap: map },
        },
      },
      games: {
        ...(currentRoot.games ?? {}),
        [gameId]: game,
      },
    };
  }, { applyLocally: false });

  if (!result.committed) throw new Error("無法開始遊戲");
  return gameId;
}

export async function closeCurrentGame(roomId: string, gameId: string): Promise<boolean> {
  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current || current.currentGameId !== gameId) return;
    return {
      ...current,
      currentGameId: null,
    } satisfies RoomState;
  }, { applyLocally: false });
  return result.committed;
}

export async function submitRound(
  roomId: string,
  gameId: string,
  playerId: string,
  pageDataUrl: string
): Promise<boolean> {
  if (!pageDataUrl.startsWith("data:image/")) throw new Error("送出作品格式無效");
  if (new TextEncoder().encode(pageDataUrl).byteLength > MAX_RELAY_PAGE_BYTES) {
    throw new Error("作品快照過大，請稍後重新整理後再送出");
  }

  const result = await runTransaction(ref(db), (root: unknown) => {
    const currentRoot = (root ?? {}) as {
      rooms?: Record<string, RoomState | undefined>;
      games?: Record<string, GameState | undefined>;
      relayPages?: Record<string, Record<string, string> | undefined>;
    };
    const room = currentRoot.rooms?.[roomId] ?? null;
    const game = currentRoot.games?.[gameId] ?? null;
    if (!room || room.currentGameId !== gameId) return;
    if (!game || game.roomId !== roomId || !canSubmitRound(game, playerId)) return;

    const pageKey = String(game.currentTurn);
    if (game.currentTurn < 1) return;

    const gamePages = currentRoot.relayPages?.[gameId] ?? {};
    if (gamePages[pageKey]) return;

    const nextGame = nextRoundState(game);
    if (!nextGame) return;

    return {
      ...currentRoot,
      games: {
        ...(currentRoot.games ?? {}),
        [gameId]: nextGame,
      },
      relayPages: {
        ...(currentRoot.relayPages ?? {}),
        [gameId]: {
          ...gamePages,
          [pageKey]: pageDataUrl,
        },
      },
    };
  }, { applyLocally: false });

  return result.committed;
}

export async function requestPageClearVote(gameId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(gameRef(gameId), (current: GameState | null) => {
    if (!current) return;
    return requestClearVote(current, playerId) ?? undefined;
  }, { applyLocally: false });
  return result.committed;
}

export async function voteToClearPage(gameId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(ref(db), (root: unknown) => {
    const currentRoot = (root ?? {}) as {
      games?: Record<string, GameState | undefined>;
      relayPages?: Record<string, Record<string, string> | undefined>;
    };
    const game = currentRoot.games?.[gameId];
    if (!game || !game.clearVote) return;

    const voted = castClearVote(game, playerId);
    if (!voted) return;

    const approved = hasClearVotePassed(voted);
    if (!approved) {
      return {
        ...currentRoot,
        games: {
          ...(currentRoot.games ?? {}),
          [gameId]: voted,
        },
      };
    }

    const relayPages = currentRoot.relayPages ?? {};
    const gamePages = relayPages[gameId] ?? {};
    const nextPages = { ...gamePages };
    delete nextPages[String(voted.clearVote?.pageIndex ?? Math.max(0, game.currentTurn - 1))];

    return {
      ...currentRoot,
      games: {
        ...(currentRoot.games ?? {}),
        [gameId]: { ...voted, clearVote: null },
      },
      relayPages: {
        ...relayPages,
        [gameId]: nextPages,
      },
    };
  }, { applyLocally: false });
  return result.committed;
}

export async function cancelPageClearVote(gameId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(gameRef(gameId), (current: GameState | null) => {
    if (!current) return;
    return cancelClearVote(current, playerId) ?? undefined;
  }, { applyLocally: false });
  return result.committed;
}

export function getOrderedPlayers(room: RoomState | null): Player[] { return orderPlayers(room?.players); }
export function isRoomHost(room: RoomState | null, playerId: string): boolean { return getHostId(room) === playerId; }
