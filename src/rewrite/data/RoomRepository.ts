import {
  get,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  set,
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
  getHostId,
  nextRoundState,
  orderPlayers,
  recoverMissingCurrentPlayer,
} from "../game/GameRules";

const MAX_RELAY_PAGE_BYTES = 8 * 1024 * 1024;

function roomRef(roomId: string) {
  return ref(db, `rooms/${roomId}`);
}

function gameRef(gameId: string) {
  return ref(db, `games/${gameId}`);
}

function relayPagesRef(gameId: string) {
  return ref(db, `relayPages/${gameId}`);
}

export function watchRoom(roomId: string, callback: (room: RoomState | null) => void): Unsubscribe {
  return onValue(roomRef(roomId), (snapshot) => {
    callback(snapshot.val() as RoomState | null);
  });
}

export function watchGame(gameId: string, callback: (game: GameState | null) => void): Unsubscribe {
  return onValue(gameRef(gameId), (snapshot) => {
    callback(snapshot.val() as GameState | null);
  });
}

export function watchRelayPages(gameId: string, callback: (pages: Record<string, string>) => void): Unsubscribe {
  return onValue(relayPagesRef(gameId), (snapshot) => {
    callback((snapshot.val() as Record<string, string> | null) ?? {});
  });
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
  const roomSnapshot = await get(roomRef(roomId));
  const room = roomSnapshot.val() as RoomState | null;

  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current || !current.players[playerId]) return;
    const nextPlayers = { ...current.players };
    delete nextPlayers[playerId];
    if (Object.keys(nextPlayers).length === 0) return null;
    return { ...current, players: nextPlayers } satisfies RoomState;
  }, { applyLocally: false });

  if (result.committed && room?.currentGameId) {
    await recoverMissingCurrentPlayerTurn(roomId, room.currentGameId);
  }

  return result.committed;
}

export async function recoverMissingCurrentPlayerTurn(roomId: string, gameId: string): Promise<boolean> {
  const [roomSnapshot, gameSnapshot] = await Promise.all([
    get(roomRef(roomId)),
    get(gameRef(gameId)),
  ]);
  const room = roomSnapshot.val() as RoomState | null;
  const game = gameSnapshot.val() as GameState | null;

  if (!room || !game || room.currentGameId !== gameId) return false;

  const activePlayerIds = new Set(Object.keys(room.players));
  if (!recoverMissingCurrentPlayer(game, activePlayerIds)) return false;

  const result = await runTransaction(gameRef(gameId), (current: GameState | null) => {
    if (!current || current.roomId !== roomId) return;
    return recoverMissingCurrentPlayer(current, activePlayerIds) ?? undefined;
  }, { applyLocally: false });

  return result.committed;
}

export async function startGame(roomId: string, playerId: string, map: MapType, mode: GameModeId = getDefaultGameMode()): Promise<string> {
  const gameId = generateGameId();
  const createdAt = Date.now();
  let gameToCreate: GameState | null = null;

  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current || !canStartGame(current, playerId)) return;
    const participants = orderPlayers(current.players);
    if (participants.length === 0) return;

    const participantIds = participants.map((player) => player.id);
    const currentPlayerId = participantIds[0] ?? null;
    gameToCreate = createGameState({
      gameId,
      roomId,
      mode,
      map,
      participantIds,
      currentPlayerId,
      createdAt,
      modeState: mode === "relay-30" ? createRelayModeState() : {},
    });

    return {
      ...current,
      currentGameId: gameId,
      lobby: { selectedMode: mode, selectedMap: map },
    } satisfies RoomState;
  }, { applyLocally: false });

  if (!result.committed || !gameToCreate) throw new Error("無法開始遊戲");

  try {
    await set(gameRef(gameId), gameToCreate);
  } catch (error) {
    await runTransaction(roomRef(roomId), (current: RoomState | null) => {
      if (!current || current.currentGameId !== gameId) return;
      return { ...current, currentGameId: null } satisfies RoomState;
    }, { applyLocally: false });
    throw error;
  }

  return gameId;
}

/** 僅結束房間對本局的指向，不刪除已完成的 game / relayPages。 */
export async function closeCurrentGame(roomId: string, gameId: string): Promise<boolean> {
  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current || current.currentGameId !== gameId) return;
    return { ...current, currentGameId: null } satisfies RoomState;
  }, { applyLocally: false });
  return result.committed;
}

/**
 * 送出頁面與推進回合必須是同一個 Firebase transaction。
 * 避免先寫入頁面、後推進回合失敗而留下無法覆寫的孤立資料。
 */
export async function submitRound(roomId: string, gameId: string, playerId: string, pageDataUrl: string): Promise<boolean> {
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
    if (!game || game.roomId !== roomId) return;
    if (!canSubmitRound(game, playerId)) return;

    const turnSnapshot = game.currentTurn;
    if (turnSnapshot < 1) return;

    const gamePages = currentRoot.relayPages?.[gameId] ?? {};
    const pageKey = String(turnSnapshot);

    // 同一回合一旦已有正式頁面，不允許第二次覆寫。
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

export function getOrderedPlayers(room: RoomState | null): Player[] {
  return orderPlayers(room?.players);
}

export function isRoomHost(room: RoomState | null, playerId: string): boolean {
  return getHostId(room) === playerId;
}
