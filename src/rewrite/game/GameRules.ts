import {
  TOTAL_ROUNDS,
  type Player,
  type RoomState,
} from "../domain";

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

export function nextRoundState(
  room: RoomState,
  pageDataUrl: string
): RoomState | null {
  if (room.phase !== "playing") return null;
  if (!room.currentPlayerId) return null;

  const players = orderPlayers(room.players);
  if (players.length === 0) return null;

  const currentIndex = players.findIndex(
    (player) => player.id === room.currentPlayerId
  );

  if (currentIndex < 0) return null;

  const pages = {
    ...(room.pages ?? {}),
    [String(room.currentRound)]: pageDataUrl,
  };

  const isLastRound = room.currentRound >= TOTAL_ROUNDS;

  if (isLastRound) {
    return {
      ...room,
      pages,
      currentPlayerId: null,
      phase: "review",
    };
  }

  const nextPlayer =
    players[(currentIndex + 1) % players.length];

  return {
    ...room,
    pages,
    currentRound: room.currentRound + 1,
    currentPlayerId: nextPlayer.id,
  };
}
