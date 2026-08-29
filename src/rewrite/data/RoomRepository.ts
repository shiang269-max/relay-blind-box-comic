import { onDisconnect, onValue, ref, runTransaction, set, update, type Unsubscribe } from "firebase/database";
import { db } from "../../lib/firebase";
import { createDefaultLobbyConfig, generateGameId, getDefaultGameMode, type MapType, type Player, type RoomState } from "../domain";
import { createGameState, type GameState } from "../game/GameState";
import type { GameModeId } from "../game/GameMode";
import { createRelayModeState } from "../game/RelayModeState";
import { canStartGame, canSubmitRound, cancelClearVote, castClearVote, getHostId, hasClearVotePassed, nextRoundState, orderPlayers, recoverMissingCurrentPlayer, requestClearVote } from "../game/GameRules";

const MAX_RELAY_PAGE_BYTES = 8 * 1024 * 1024;
const PLAYER_STALE_MS = 30_000;
type WatchErrorCallback = (error: Error) => void;
function roomRef(roomId: string) { return ref(db, `rooms/${roomId}`); }
function gameRef(gameId: string) { return ref(db, `games/${gameId}`); }
function relayPagesRef(gameId: string) { return ref(db, `relayPages/${gameId}`); }
function normalizePlayers(players: unknown): Record<string, Player> { return players && typeof players === "object" && !Array.isArray(players) ? players as Record<string, Player> : {}; }
function activePlayers(players: Record<string, Player>, now = Date.now()): Record<string, Player> { return Object.fromEntries(Object.entries(players).filter(([, p]) => now - (p.activeAt ?? p.joinedAt ?? 0) <= PLAYER_STALE_MS)); }

export function watchRoom(roomId: string, callback: (room: RoomState | null) => void, onError?: WatchErrorCallback): Unsubscribe { return onValue(roomRef(roomId), s => callback(s.val() as RoomState | null), e => onError?.(e)); }
export function watchGame(gameId: string, callback: (game: GameState | null) => void, onError?: WatchErrorCallback): Unsubscribe { return onValue(gameRef(gameId), s => callback(s.val() as GameState | null), e => onError?.(e)); }
export function watchRelayPages(gameId: string, callback: (pages: Record<string, string>) => void, onError?: WatchErrorCallback): Unsubscribe { return onValue(relayPagesRef(gameId), s => callback((s.val() as Record<string, string> | null) ?? {}), e => onError?.(e)); }

export async function upsertPlayer(roomId: string, player: Player): Promise<void> {
  await runTransaction(roomRef(roomId), (raw: RoomState | null) => {
    const now = Date.now();
    const old = raw ?? null;
    const active = activePlayers(normalizePlayers(old?.players), now);
    if (old && Object.keys(active).length === 0) {
      // Empty/stale room is a finished room. Recreate it cleanly; never reuse its game state.
      return { players: { [player.id]: { ...player, activeAt: now } }, currentGameId: null, lobby: createDefaultLobbyConfig(), createdAt: now } satisfies RoomState;
    }
    return { ...(old ?? {}), players: { ...active, [player.id]: { ...active[player.id], ...player, joinedAt: active[player.id]?.joinedAt ?? player.joinedAt, activeAt: now } }, currentGameId: old?.currentGameId ?? null, lobby: old?.lobby ?? createDefaultLobbyConfig(), createdAt: old?.createdAt ?? now } satisfies RoomState;
  }, { applyLocally: false });
}

export async function startPlayerPresence(roomId: string, playerId: string): Promise<void> {
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
  await onDisconnect(playerRef).remove();
}
export async function touchPlayer(roomId: string, playerId: string): Promise<void> { await update(ref(db, `rooms/${roomId}/players/${playerId}`), { activeAt: Date.now() }); }

export async function leaveRoom(roomId: string, playerId: string): Promise<boolean> {
  // A leave is a terminal room operation when it removes the last active participant.
  // The room record itself is deleted, so the room code cannot resurrect an old game.
  const result = await runTransaction(roomRef(roomId), (raw: RoomState | null) => {
    if (!raw) return raw;
    const players = activePlayers(normalizePlayers(raw.players));
    delete players[playerId];
    if (Object.keys(players).length === 0) return null;
    return { ...raw, players } satisfies RoomState;
  }, { applyLocally: false });
  if (result.committed && result.snapshot.val() === null) {
    const room = rawRoomSnapshotFallback(roomId);
    void room;
  }
  return result.committed;
}

async function rawRoomSnapshotFallback(roomId: string): Promise<RoomState | null> {
  // Intentionally unused; kept private so leaveRoom remains a single room transaction.
  return new Promise((resolve) => { void roomId; resolve(null); });
}

export async function recoverMissingCurrentPlayerTurn(roomId: string, gameId: string): Promise<boolean> {
  const result = await runTransaction(gameRef(gameId), (game: GameState | null) => game ? recoverMissingCurrentPlayer(game, new Set<string>()) ?? game : game, { applyLocally: false });
  return result.committed;
}

export async function startGame(roomId: string, playerId: string, map: MapType, mode: GameModeId = getDefaultGameMode()): Promise<string> {
  const gameId = generateGameId(); const createdAt = Date.now(); let game: GameState | null = null;
  const roomResult = await runTransaction(roomRef(roomId), (raw: RoomState | null) => {
    if (!raw) return raw;
    const room = { ...raw, players: activePlayers(normalizePlayers(raw.players), createdAt), currentGameId: raw.currentGameId ?? null, lobby: raw.lobby ?? createDefaultLobbyConfig() } satisfies RoomState;
    if (!canStartGame(room, playerId)) return raw;
    const ids = orderPlayers(room.players).map(p => p.id); if (!ids.length) return raw;
    game = createGameState({ gameId, roomId, mode, map, participantIds: ids, currentPlayerId: ids[0] ?? null, createdAt, modeState: mode === "relay-30" ? createRelayModeState() : {} });
    return { ...room, currentGameId: gameId, lobby: { selectedMode: mode, selectedMap: map } } satisfies RoomState;
  }, { applyLocally: false });
  if (!roomResult.committed || !game) throw new Error("無法開始遊戲");
  await set(gameRef(gameId), game);
  return gameId;
}

export async function closeCurrentGame(roomId: string, gameId: string): Promise<boolean> {
  await set(gameRef(gameId), null);
  await set(relayPagesRef(gameId), null);
  const result = await runTransaction(roomRef(roomId), (room: RoomState | null) => {
    if (!room || room.currentGameId !== gameId) return room;
    return null;
  }, { applyLocally: false });
  return result.committed;
}

export async function submitRound(roomId: string, gameId: string, playerId: string, pageDataUrl: string): Promise<boolean> { if (!pageDataUrl.startsWith("data:image/")) throw new Error("作品格式無效"); if (new TextEncoder().encode(pageDataUrl).byteLength > MAX_RELAY_PAGE_BYTES) throw new Error("作品快照過大"); let accepted = false; let pageKey: string | null = null; const result = await runTransaction(gameRef(gameId), (current: GameState | null) => { if (!current || current.roomId !== roomId || !canSubmitRound(current, playerId) || current.currentTurn < 1) return current; const next = nextRoundState(current); if (!next) return current; accepted = true; pageKey = String(current.currentTurn); return next; }, { applyLocally: false }); if (!accepted || !pageKey) return false; const finalGame = result.snapshot.val() as GameState | null; if (!finalGame || finalGame.roomId !== roomId) return false; await set(ref(db, `relayPages/${gameId}/${pageKey}`), pageDataUrl); return true; }
export async function requestPageClearVote(gameId: string, playerId: string): Promise<boolean> { const r = await runTransaction(gameRef(gameId), g => g ? requestClearVote(g, playerId) ?? undefined : undefined, { applyLocally: false }); return r.committed; }
export async function voteToClearPage(gameId: string, playerId: string): Promise<boolean> { const r = await runTransaction(gameRef(gameId), g => { if (!g || !g.clearVote) return g; const v = castClearVote(g, playerId); return v && hasClearVotePassed(v) ? { ...v, clearVote: null } : v ?? g; }, { applyLocally: false }); return r.committed; }
export async function cancelPageClearVote(gameId: string, playerId: string): Promise<boolean> { const r = await runTransaction(gameRef(gameId), g => g ? cancelClearVote(g, playerId) ?? undefined : undefined, { applyLocally: false }); return r.committed; }
export function getOrderedPlayers(room: RoomState | null): Player[] { return orderPlayers(normalizePlayers(room?.players)); }
export function isRoomHost(room: RoomState | null, playerId: string): boolean { return getHostId(room ? { ...room, players: normalizePlayers(room.players) } : null) === playerId; }
