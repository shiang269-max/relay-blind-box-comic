import type {
  Player,
  RoomState,
} from "../domain";
import { getGameFlow } from "./getGameFlow";

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
  room: RoomState | null
): string | null {
  return orderPlayers(room?.players)[0]?.id ?? null;
}

export function canStartGame(
  room: RoomState | null,
  playerId: string
): boolean {
  if (!room) return false;
  if (room.phase !== "lobby") return false;

  return getHostId(room) === playerId;
}

export function canSubmitRound(
  room: RoomState | null,
  playerId: string
): boolean {
  if (!room) return false;
  if (room.phase !== "playing") return false;

  return room.currentPlayerId === playerId;
}

/**
 * 寫入目前繪圖結果後，由模式流程決定下一個狀態。
 *
 * RoomRepository 不再知道 30 頁、上一頁、輪替玩家等模式規則。
 */
export function nextRoundState(
  room: RoomState,
  pageDataUrl: string
): RoomState | null {
  if (room.phase !== "playing") return null;

  const players = orderPlayers(room.players);
  if (players.length === 0) return null;

  const flow = getGameFlow(room.mode);

  const next = flow.getNextState({
    currentRound: room.currentRound,
    currentPlayerId: room.currentPlayerId,
    playerIds: players.map((player) => player.id),
  });

  const pages = {
    ...(room.pages ?? {}),
    [String(room.currentRound)]: pageDataUrl,
  };

  return {
    ...room,
    pages,
    phase: next.phase,
    currentRound: next.currentRound,
    currentPlayerId: next.currentPlayerId,
  };
}
