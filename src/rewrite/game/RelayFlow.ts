import type { GameMode } from "./GameMode";
import type {
  GameFlow,
  GameFlowContext,
  GameFlowTransition,
} from "./GameFlow";

/**
 * 接力盲盒漫畫固定流程。
 * participantIds 由本局開始時凍結，RelayFlow 不負責處理玩家缺席。
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

    if (context.currentPlayerId === null) {
      return {
        phase: "playing",
        currentRound: nextRound,
        currentPlayerId: playerIds[0],
      };
    }

    const currentIndex = playerIds.indexOf(context.currentPlayerId);

    if (currentIndex < 0) {
      throw new Error(
        "currentPlayerId 不存在於固定 participantIds"
      );
    }

    return {
      phase: "playing",
      currentRound: nextRound,
      currentPlayerId:
        playerIds[(currentIndex + 1) % playerIds.length],
    };
  }
}
