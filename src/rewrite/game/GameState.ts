import type { GameModeId } from "./GameMode";

/**
 * 模式無關的遊戲執行狀態。
 *
 * 這一層不保存任何特定模式的作品資料。
 * 接力模式的 pages、世界模式的 world data 都各自放在 modeState。
 */
export interface GameState {
  mode: GameModeId;
  phase: "lobby" | "playing" | "review";
  currentTurn: number;
  currentPlayerId: string | null;
  modeState: Record<string, unknown>;
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
