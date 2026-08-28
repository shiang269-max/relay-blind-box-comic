import type { Player, RoomState } from "../domain";
import { getGameFlow } from "./getGameFlow";
import {
  appendRelayPage,
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

export function nextRoundState(room: RoomState, pageDataUrl: string): RoomState | null {
  if (room.game.phase !== "playing") return null;

  const players = orderPlayers(room.players);
  if (players.length === 0) return null;

  const flow = getGameFlow(room.game.mode);
  const next = flow.getNextState({
    currentRound: room.game.currentTurn,
    currentPlayerId: room.game.currentPlayerId,
    playerIds: players.map((player) => player.id),
  });

  if (room.game.mode !== "relay-30") {
    throw new Error("目前尚未實作此模式的送出規則");
  }

  const relayState = asRelayModeState(room.game);
  const nextModeState = appendRelayPage(
    relayState,
    room.game.currentTurn,
    pageDataUrl
  );

  return {
    ...room,
    game: {
      ...room.game,
      modeState: nextModeState,
      phase: next.phase,
      currentTurn: next.currentRound,
      currentPlayerId: next.currentPlayerId,
    },
  };
}

export function asRelayModeState(game: GameState): RelayModeState {
  if (!isRelayModeState(game.modeState)) {
    throw new Error("relay-30 的 modeState 資料格式無效");
  }

  return game.modeState;
}

function isRelayModeState(value: unknown): value is RelayModeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pages = (value as { pages?: unknown }).pages;
  return !!pages && typeof pages === "object" && !Array.isArray(pages);
}
