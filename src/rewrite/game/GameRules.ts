import type { Player, RoomState } from "../domain";
import type { GameState } from "./GameState";
import { getGameFlow } from "./getGameFlow";
import {
  createRelayModeState,
  type RelayModeState,
} from "./RelayModeState";

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
  if (!room || room.currentGameId !== null) return false;
  return getHostId(room) === playerId;
}

export function canSubmitRound(game: GameState | null, playerId: string): boolean {
  if (!game || game.phase !== "playing") return false;
  return game.currentPlayerId === playerId;
}

export function findNextActiveParticipant(
  participantIds: readonly string[],
  currentPlayerId: string | null,
  activePlayerIds: ReadonlySet<string>
): string | null {
  if (participantIds.length === 0) return null;
  if (currentPlayerId === null) {
    return participantIds.find((id) => activePlayerIds.has(id)) ?? null;
  }
  const currentIndex = participantIds.indexOf(currentPlayerId);
  if (currentIndex < 0) {
    throw new Error("currentPlayerId 不存在於 game.participantIds");
  }
  for (let offset = 1; offset <= participantIds.length; offset += 1) {
    const id = participantIds[(currentIndex + offset) % participantIds.length];
    if (activePlayerIds.has(id)) return id;
  }
  return null;
}

export function recoverMissingCurrentPlayer(
  game: GameState,
  activePlayerIds: ReadonlySet<string>
): GameState | null {
  if (game.phase !== "playing") return null;
  const currentPlayerId = game.currentPlayerId;
  if (currentPlayerId !== null && activePlayerIds.has(currentPlayerId)) return null;
  const nextPlayerId = findNextActiveParticipant(
    game.participantIds,
    currentPlayerId,
    activePlayerIds
  );
  if (nextPlayerId === currentPlayerId) return null;
  return { ...game, currentPlayerId: nextPlayerId };
}

export function getClearVoteRequiredCount(game: GameState): number {
  return game.participantIds.length;
}

export function hasClearVotePassed(game: GameState): boolean {
  const vote = game.clearVote;
  if (!vote) return false;
  const participantSet = new Set(game.participantIds);
  const validVotes = Object.keys(vote.votes).filter((id) => participantSet.has(id));
  return validVotes.length >= getClearVoteRequiredCount(game);
}

export function requestClearVote(game: GameState, playerId: string): GameState | null {
  if (game.phase !== "playing") return null;
  if (!game.participantIds.includes(playerId)) return null;
  if (game.clearVote) return null;
  return {
    ...game,
    clearVote: {
      requestedBy: playerId,
      requestedAt: Date.now(),
      pageIndex: Math.max(0, game.currentTurn - 1),
      votes: { [playerId]: true },
    },
  };
}

export function castClearVote(game: GameState, playerId: string): GameState | null {
  if (game.phase !== "playing") return null;
  if (!game.clearVote) return null;
  if (!game.participantIds.includes(playerId)) return null;
  if (game.clearVote.votes[playerId]) return null;
  return {
    ...game,
    clearVote: {
      ...game.clearVote,
      votes: { ...game.clearVote.votes, [playerId]: true },
    },
  };
}

export function cancelClearVote(game: GameState, playerId: string): GameState | null {
  if (!game.clearVote) return null;
  if (game.clearVote.requestedBy !== playerId) return null;
  return { ...game, clearVote: null };
}

export function nextRoundState(game: GameState): GameState | null {
  if (game.phase !== "playing") return null;
  if (game.participantIds.length === 0) return null;
  const mode = game.mode;
  const flow = getGameFlow(mode);
  const next = flow.getNextState({
    currentRound: game.currentTurn,
    currentPlayerId: game.currentPlayerId,
    playerIds: game.participantIds,
  });
  if (mode !== "relay-30") throw new Error("目前尚未實作此模式的送出規則");
  return {
    ...game,
    phase: next.phase,
    currentTurn: next.currentRound,
    currentPlayerId: next.currentPlayerId,
    clearVote: null,
    completedAt:
      next.phase === "review" && game.completedAt === null
        ? Date.now()
        : game.completedAt,
  };
}

export function asRelayModeState(game: GameState): RelayModeState {
  return game.modeState && typeof game.modeState === "object" && !Array.isArray(game.modeState)
    ? (game.modeState as RelayModeState)
    : createRelayModeState();
}
