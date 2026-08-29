import { onDisconnect, onValue, ref, runTransaction, set, type Unsubscribe } from "firebase/database";
import { db } from "../../lib/firebase";
import { createDefaultLobbyConfig, generateGameId, getDefaultGameMode, type MapType, type Player, type RoomState } from "../domain";
import { createGameState, type GameState } from "../game/GameState";
import type { GameModeId } from "../game/GameMode";
import { createRelayModeState } from "../game/RelayModeState";
import { canStartGame, canSubmitRound, cancelClearVote, castClearVote, getHostId, hasClearVotePassed, nextRoundState, orderPlayers, recoverMissingCurrentPlayer, requestClearVote } from "../game/GameRules";

const MAX_RELAY_PAGE_BYTES = 8 * 1024 * 1024;
type WatchErrorCallback = (error: Error) => void;

function roomRef(roomId: string) { return ref(db, `rooms/${roomId}`); }
function gameRef(gameId: string) { return ref(db, `games/${gameId}`); }
function relayPagesRef(gameId: string) { return ref(db, `relayPages/${gameId}`); }
function normalizePlayers(players: unknown): Record<string, Player> {
  if (!players || typeof players !== "object" || Array.isArray(players)) return {};
  return players as Record<string, Player>;
}

export function watchRoom(roomId: string, callback: (room: RoomState | null) => void, onError?: WatchErrorCallback): Unsubscribe {
  return onValue(roomRef(roomId), (snapshot) => callback(snapshot.val() as RoomState | null), (error) => onError?.(error));
}
export function watchGame(gameId: string, callback: (game: GameState | null) => void, onError?: WatchErrorCallback): Unsubscribe {
  return onValue(gameRef(gameId), (snapshot) => callback(snapshot.val() as GameState | null), (error) => onError?.(error));
}
export function watchRelayPages(gameId: string, callback: (pages: Record<string, string>) => void, onError?: WatchErrorCallback): Unsubscribe {
  return onValue(relayPagesRef(gameId), (snapshot) => callback((snapshot.val() as Record<string, string> | null) ?? {}), (error) => onError?.(error));
}

export async function upsertPlayer(roomId: string, player: Player): Promise<void> {
  await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current) return { players: { [player.id]: player }, currentGameId: null, lobby: createDefaultLobbyConfig(), createdAt: Date.now() } satisfies RoomState;
    const players = normalizePlayers(current.players);
    const currentGameId = typeof current.currentGameId === "string" ? current.currentGameId : null;
    const lobby = current.lobby ?? createDefaultLobbyConfig();
    if (currentGameId !== null) {
      const existing = players[player.id];
      if (existing) return { ...current, players: { ...players, [player.id]: { ...existing, name: player.name } }, currentGameId, lobby } satisfies RoomState;
      return { ...current, players, currentGameId, lobby } satisfies RoomState;
    }
    return { ...current, players: { ...players, [player.id]: { ...player, joinedAt: players[player.id]?.joinedAt ?? player.joinedAt } }, currentGameId, lobby, createdAt: current.createdAt ?? Date.now() } satisfies RoomState;
  }, { applyLocally: false });
}

export async function startPlayerPresence(roomId: string, playerId: string): Promise<void> { await onDisconnect(ref(db, `rooms/${roomId}/players/${playerId}`)).remove(); }

export async function leaveRoom(roomId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => {
    if (!current) return;
    const players = normalizePlayers(current.players);
    if (!players[playerId]) return;
    const nextPlayers = { ...players }; delete nextPlayers[playerId];
    if (Object.keys(nextPlayers).length === 0) return null;
    return { ...current, players: nextPlayers, currentGameId: typeof current.currentGameId === "string" ? current.currentGameId : null, lobby: current.lobby ?? createDefaultLobbyConfig() } satisfies RoomState;
  }, { applyLocally: false });
  if (result.committed) { const room = result.snapshot.val() as RoomState | null; if (room?.currentGameId) await recoverMissingCurrentPlayerTurn(roomId, room.currentGameId); }
  return result.committed;
}

export async function recoverMissingCurrentPlayerTurn(roomId: string, gameId: string): Promise<boolean> {
  const result = await runTransaction(ref(db), (root: unknown) => {
    const currentRoot = (root ?? {}) as { rooms?: Record<string, RoomState | undefined>; games?: Record<string, GameState | undefined> };
    const room = currentRoot.rooms?.[roomId] ?? null;
    const game = currentRoot.games?.[gameId] ?? null;
    if (!room || !game || room.currentGameId !== gameId) return;
    const recovered = recoverMissingCurrentPlayer(game, new Set(Object.keys(normalizePlayers(room.players))));
    if (!recovered) return;
    return { ...currentRoot, games: { ...(currentRoot.games ?? {}), [gameId]: recovered } };
  }, { applyLocally: false });
  return result.committed;
}

export async function startGame(roomId: string, playerId: string, map: MapType, mode: GameModeId = getDefaultGameMode()): Promise<string> {
  const gameId = generateGameId();
  const createdAt = Date.now();
  let game: GameState | null = null;
  const roomResult = await runTransaction(roomRef(roomId), (rawRoom: RoomState | null) => {
    if (!rawRoom) return;
    const room: RoomState = { ...rawRoom, players: normalizePlayers(rawRoom.players), currentGameId: typeof rawRoom.currentGameId === "string" ? rawRoom.currentGameId : null, lobby: rawRoom.lobby ?? createDefaultLobbyConfig(), createdAt: rawRoom.createdAt ?? createdAt };
    if (!canStartGame(room, playerId)) return;
    const participantIds = orderPlayers(room.players).map((item) => item.id);
    if (!participantIds.length) return;
    game = createGameState({ gameId, roomId, mode, map, participantIds, currentPlayerId: participantIds[0] ?? null, createdAt, modeState: mode === "relay-30" ? createRelayModeState() : {} });
    return { ...room, currentGameId: gameId, lobby: { selectedMode: mode, selectedMap: map } } satisfies RoomState;
  }, { applyLocally: false });
  if (!roomResult.committed || !game) throw new Error("無法開始遊戲");
  try { await set(gameRef(gameId), game); }
  catch (error) {
    await runTransaction(roomRef(roomId), (current: RoomState | null) => {
      if (!current || current.currentGameId !== gameId) return;
      return { ...current, currentGameId: null } satisfies RoomState;
    }, { applyLocally: false });
    throw error;
  }
  return gameId;
}

export async function closeCurrentGame(roomId: string, gameId: string): Promise<boolean> {
  const result = await runTransaction(roomRef(roomId), (current: RoomState | null) => current?.currentGameId === gameId ? { ...current, currentGameId: null } satisfies RoomState : undefined, { applyLocally: false });
  return result.committed;
}

/** 對單一 game 節點原子推進回合；交易 updater 絕不回傳 undefined，避免 RTDB 直接拋出 Data returned undefined。 */
export async function submitRound(roomId: string, gameId: string, playerId: string, pageDataUrl: string): Promise<boolean> {
  if (!pageDataUrl.startsWith("data:image/")) throw new Error("送出作品格式無效");
  if (new TextEncoder().encode(pageDataUrl).byteLength > MAX_RELAY_PAGE_BYTES) throw new Error("作品快照過大，請稍後重新整理後再送出");

  let accepted = false;
  let pageKey: string | null = null;
  const result = await runTransaction(gameRef(gameId), (current: GameState | null) => {
    if (!current) return current;
    if (current.roomId !== roomId || !canSubmitRound(current, playerId) || current.currentTurn < 1) return current;
    const nextGame = nextRoundState(current);
    if (!nextGame) return current;
    accepted = true;
    pageKey = String(current.currentTurn);
    return nextGame;
  }, { applyLocally: false });

  if (!accepted || !pageKey) return false;
  const finalGame = result.snapshot.val() as GameState | null;
  if (!finalGame || finalGame.roomId !== roomId) return false;

  try {
    await set(ref(db, `relayPages/${gameId}/${pageKey}`), pageDataUrl);
    return true;
  } catch (error) {
    throw new Error(error instanceof Error ? `作品已推進但頁面保存失敗：${error.message}` : "作品已推進但頁面保存失敗");
  }
}

export async function requestPageClearVote(gameId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(gameRef(gameId), (current: GameState | null) => current ? requestClearVote(current, playerId) ?? undefined : undefined, { applyLocally: false });
  return result.committed;
}
export async function voteToClearPage(gameId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(ref(db), (root: unknown) => {
    const currentRoot = (root ?? {}) as { games?: Record<string, GameState | undefined>; relayPages?: Record<string, Record<string, string> | undefined> };
    const game = currentRoot.games?.[gameId]; if (!game || !game.clearVote) return;
    const voted = castClearVote(game, playerId); if (!voted) return;
    if (!hasClearVotePassed(voted)) return { ...currentRoot, games: { ...(currentRoot.games ?? {}), [gameId]: voted } };
    const nextPages = { ...(currentRoot.relayPages?.[gameId] ?? {}) }; delete nextPages[String(voted.clearVote?.pageIndex ?? Math.max(0, game.currentTurn - 1))];
    return { ...currentRoot, games: { ...(currentRoot.games ?? {}), [gameId]: { ...voted, clearVote: null } }, relayPages: { ...(currentRoot.relayPages ?? {}), [gameId]: nextPages } };
  }, { applyLocally: false });
  return result.committed;
}
export async function cancelPageClearVote(gameId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(gameRef(gameId), (current: GameState | null) => current ? cancelClearVote(current, playerId) ?? undefined : undefined, { applyLocally: false });
  return result.committed;
}
export function getOrderedPlayers(room: RoomState | null): Player[] { return orderPlayers(normalizePlayers(room?.players)); }
export function isRoomHost(room: RoomState | null, playerId: string): boolean { return getHostId(room ? { ...room, players: normalizePlayers(room.players) } : null) === playerId; }
