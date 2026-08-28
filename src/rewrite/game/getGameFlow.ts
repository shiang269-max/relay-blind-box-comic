import type { GameModeId } from "./GameMode";
import { getGameMode } from "./GameMode";
import type { GameFlow } from "./GameFlow";
import { RelayFlow } from "./RelayFlow";

/**
 * 依模式取得流程策略。
 *
 * 未來世界模式會在這裡接上自己的 WorldFlow，
 * 不需要修改共用繪圖層。
 */
export function getGameFlow(
  modeId: GameModeId | undefined
): GameFlow {
  const mode = getGameMode(modeId);

  switch (mode.id) {
    case "relay-30":
      return new RelayFlow(mode);

    case "world":
      throw new Error(
        "世界模式流程尚未實作"
      );
  }
}
