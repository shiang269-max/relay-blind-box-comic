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

export function canSubmitRound(
  game: GameState | null,
  playerId: string
): boolean {
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
    return participantIds.find((playerId) => activePlayerIds.has(playerId)) ?? null;
  }

  const currentIndex = participantIds.indexOf(currentPlayerId);

  if (currentIndex < 0) {
    throw new Error("currentPlayerId 不存在於 game.participantIds");
  }

  for (let offset = 1; offset <= participantIds.length; offset += 1) {
    const playerId = participantIds[
      (currentIndex + offset) % participantIds.length
    ];

    if (activePlayerIds.has(playerId)) {
      return playerId;
    }
  }

  return null;
}

export function recoverMissingCurrentPlayer(
  game: GameState,
  activePlayerIds: ReadonlySet<string>
): GameState | null {
  if (game.phase !== "playing") return null;

  const currentPlayerId = game.currentPlayerId;

  if (
    currentPlayerId !== null &&
    activePlayerIds.has(currentPlayerId)
  ) {
    return null;
  }

  const nextPlayerId = findNextActiveParticipant(
    game.participantIds,
    currentPlayerId,
    activePlayerIds
  );

  if (nextPlayerId === currentPlayerId) return null;

  return {
    ...game,
    currentPlayerId: nextPlayerId,
  };
}

/**
 * 正常回合推進只依固定 participantIds 決定順序。
 * 在線狀態與缺席恢復由 recoverMissingCurrentPlayer() 處理。
 */
export function nextRoundState(game: GameState): GameState | null {
  if (game.phase !== "playing") return null;
  if (game.participantIds.length === 0) return null;

  const mode = game.mode ?? "relay-30";
  const flow = getGameFlow(mode);
  const next = flow.getNextState({
    currentRound: game.currentTurn,
    currentPlayerId: game.currentPlayerId,
    playerIds: game.participantIds,
  });

  if (mode !== "relay-30") {
    throw new Error("目前尚未實作此模式的送出規則");
  }

  const enteringReview = next.phase === "review";

  return {
    ...game,
    mode,
    phase: next.phase,
    currentTurn: next.currentRound,
    currentPlayerId: next.currentPlayerId,
    completedAt:
      enteringReview && game.completedAt === null
        ? Date.now()
        : game.completedAt,
  };
}

/**
 * Transitional reader retained until GameRouter and relay page storage finish
 * moving fully to game-scoped paths.
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
