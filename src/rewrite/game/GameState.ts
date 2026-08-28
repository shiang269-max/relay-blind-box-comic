import type { GameModeId } from "./GameMode";

export interface GameState {
  mode: GameModeId;
  phase: "lobby" | "playing" | "review";
  currentTurn: number;
  currentPlayerId: string | null;
  modeState: unknown;
}

export function createGameState(
  mode: GameModeId,
  currentPlayerId: string | null
): GameState {
  return {
    mode,
    phase: "lobby",
    currentTurn: 0,
    currentPlayerId,
    modeState: {},
  };
}
