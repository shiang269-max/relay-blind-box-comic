import type { Player, RoomState } from "../domain";
import { getGameFlow } from "./getGameFlow";
import {
  createRelayModeState,
  type RelayModeState,
} from "./RelayModeState";
import type { GameState } from "./GameState";

export function orderPlayers(
  players: Record<string, Player> | undefined
): Player[] {
  return Object.values(players ?? {}).sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.id.localeCompare(b.id);
  });
}

export function getHostId(room: RoomState | null): string | null {
  return orderPlayers(room?.players)[0]?.id ?? null;
}

export function canStartGame(room: RoomState | null, playerId: string): boolean {
  if (!room || room.game.phase !== "lobby") return false;
  return getHostId(room) === playerId;
}

export function canSubmitRound(room: RoomState | null, playerId: string): boolean {
  if (!room || room.game.phase !== "playing") return false;
  return room.game.currentPlayerId === playerId;
}

export function recoverMissingCurrentPlayer(room: RoomState): RoomState | null {
  if (room.game.phase !== "playing") return null;

  const players = orderPlayers(room.players);
  if (players.length === 0) return null;

  const currentPlayerId = room.game.currentPlayerId;
  if (currentPlayerId && room.players[currentPlayerId]) return null;

  return {
    ...room,
    game: {
      ...room.game,
      currentPlayerId: players[0].id,
    },
  };
}

/**
 * 推進遊戲流程只處理小型狀態。
 *
 * 30 頁圖片本身不能再塞進 room transaction，否則每次送出都會把所有歷史
 * 累積快照一起帶進交易，資料量會隨回合數倍增。頁面內容由 Repository 存在
 * 獨立的 relayPages 路徑，流程狀態只保存「現在輪到誰、進度到哪裡」。
 */
export function nextRoundState(room: RoomState): RoomState | null {
  if (room.game.phase !== "playing") return null;

  const players = orderPlayers(room.players);
  if (players.length === 0) return null;

  const mode = room.game.mode ?? "relay-30";
  const flow = getGameFlow(mode);
  const next = flow.getNextState({
    currentRound: room.game.currentTurn,
    currentPlayerId: room.game.currentPlayerId,
    playerIds: players.map((player) => player.id),
  });

  if (mode !== "relay-30") {
    throw new Error("目前尚未實作此模式的送出規則");
  }

  return {
    ...room,
    game: {
      ...room.game,
      mode,
      phase: next.phase,
      currentTurn: next.currentRound,
      currentPlayerId: next.currentPlayerId,
    },
  };
}

/**
 * Backward-compatible reader for rooms created before relay pages moved to
 * their dedicated Firebase path.
 */
export function asRelayModeState(game: GameState): RelayModeState {
  if (isRelayModeState(game.modeState)) return game.modeState;
  return createRelayModeState();
}

function isRelayModeState(value: unknown): value is RelayModeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pages = (value as { pages?: unknown }).pages;
  return !!pages && typeof pages === "object" && !Array.isArray(pages);
}
