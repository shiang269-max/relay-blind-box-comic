import type {
  Player,
  RoomState,
} from "../domain";
import { getGameFlow } from "./getGameFlow";
import {
  appendRelayPage,
  type RelayModeState,
} from "./RelayModeState";

export function orderPlayers(
  players: Record<string, Player> | undefined
): Player[] {
  return Object.values(players ?? {}).sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) {
      return a.joinedAt - b.joinedAt;
    }

    return a.id.localeCompare(b.id);
  });
}

export function getHostId(
  room: RoomState | null): string | null {
  return orderPlayers(room?.players)[0]?.id ?? null;
}

export function canStartGame(
  room: RoomState | null,
  playerId: string
): boolean {
  if (!room) return false;
  if (room.game.phase !== "lobby") return false;

  return getHostId(room) === playerId;
}

export function canSubmitRound(
  room: RoomState | null,
  playerId: string
): boolean {
  if (!room) return false;
  if (room.game.phase !== "playing") return false;

  return room.game.currentPlayerId === playerId;
}

/**
 * 當目前輪到的玩家已不在房間時，維持同一回合並把繪圖權交給仍在線的玩家。
 * 不增加 currentTurn，因此不會產生缺頁；下一位玩家直接補完原本那一頁。
 */
export function recoverMissingCurrentPlayer(
  room: RoomState
): RoomState | null {
  if (room.game.phase !== "playing") return null;

  const players = orderPlayers(room.players);
  if (players.length === 0) return null;

  const currentPlayerId = room.game.currentPlayerId;
  if (
    currentPlayerId &&
    room.players[currentPlayerId]
  ) {
    return null;
  }

  return {
    ...room,
    game: {
      ...room.game,
      currentPlayerId: players[0].id,
    },
  };
}

/**
 * 接力模式目前的送出規則。
 *
 * 模式專屬 pages 寫入 RelayModeState，
 * 共用 RoomState 不再直接持有 pages。
 */
export function nextRoundState(
  room: RoomState,
  pageDataUrl: string
): RoomState | null {
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

  const relayState = room.game.modeState as RelayModeState;
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
