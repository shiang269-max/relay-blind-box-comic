import type { MapType } from "../domain";
import type { GameModeId } from "./GameMode";

export type GamePhase = "playing" | "review";

export interface ClearVoteState {
  requestedBy: string;
  requestedAt: number;
  votes: Record<string, true>;
}

export interface GameState {
  gameId: string;
  roomId: string;
  mode: GameModeId;
  map: MapType;
  phase: GamePhase;
  participantIds: string[];
  currentTurn: number;
  currentPlayerId: string | null;
  createdAt: number;
  completedAt: number | null;
  savedComicId: string | null;
  clearVote: ClearVoteState | null;
  modeState: unknown;
}

export interface CreateGameStateInput {
  gameId: string;
  roomId: string;
  mode: GameModeId;
  map: MapType;
  participantIds: string[];
  currentPlayerId: string | null;
  createdAt?: number;
  modeState?: unknown;
}

export function createGameState(
  input: CreateGameStateInput
): GameState {
  return {
    gameId: input.gameId,
    roomId: input.roomId,
    mode: input.mode,
    map: input.map,
    phase: "playing",
    participantIds: [...input.participantIds],
    currentTurn: 1,
    currentPlayerId: input.currentPlayerId,
    createdAt: input.createdAt ?? Date.now(),
    completedAt: null,
    savedComicId: null,
    clearVote: null,
    modeState: input.modeState ?? {},
  };
}
