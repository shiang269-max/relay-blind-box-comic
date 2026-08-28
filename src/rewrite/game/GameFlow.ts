import type { GameMode } from "./GameMode";

/**
 * 遊戲流程共用介面。
 *
 * 模式只決定「遊戲如何進行」，不直接依賴 React、Firebase 或繪圖 UI。
 * 30 頁模式與未來世界模式可各自實作不同流程。
 */
export interface GameFlowContext {
  currentRound: number;
  currentPlayerId: string | null;
  playerIds: string[];
}

export interface GameFlowTransition {
  phase: "playing" | "review";
  currentRound: number;
  currentPlayerId: string | null;
}

export interface GameFlow {
  readonly mode: GameMode;

  getPreviousDrawingKey(context: GameFlowContext): string | null;

  getNextState(context: GameFlowContext): GameFlowTransition;
}
