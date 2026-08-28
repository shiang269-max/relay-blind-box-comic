import type { GameMode } from "./GameMode";
import type {
  GameFlow,
  GameFlowContext,
  GameFlowTransition,
} from "./GameFlow";

/**
 * 接力盲盒漫畫流程。
 *
 * 只有這個類別知道「上一頁」與「下一頁」的概念。
 * 共用繪圖引擎與未來世界模式不依賴這些規則。
 */
export class RelayFlow implements GameFlow {
  constructor(
    public readonly mode: GameMode
  ) {}

  getPreviousDrawingKey(
    context: GameFlowContext
  ): string | null {
    if (context.currentRound <= 1) return null;
    return String(context.currentRound - 1);
  }

  getNextState(
    context: GameFlowContext
  ): GameFlowTransition {
    const nextRound = context.currentRound + 1;

    if (
      this.mode.totalRounds !== null &&
      nextRound > this.mode.totalRounds
    ) {
      return {
        phase: "review",
        currentRound: context.currentRound,
        currentPlayerId: null,
      };
    }

    const playerIds = context.playerIds;

    if (playerIds.length === 0) {
      return {
        phase: "playing",
        currentRound: nextRound,
        currentPlayerId: null,
      };
    }

    const currentIndex = context.currentPlayerId
      ? Math.max(0, playerIds.indexOf(context.currentPlayerId))
      : -1;

    return {
      phase: "playing",
      currentRound: nextRound,
      currentPlayerId:
        playerIds[(currentIndex + 1) % playerIds.length],
    };
  }
}
