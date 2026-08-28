export type GameModeId = "relay-30" | "world";

export type GameModeProgress = "pages" | "world";

export interface GameMode {
  id: GameModeId;
  label: string;
  progress: GameModeProgress;
  totalRounds: number | null;
}

const GAME_MODES: Record<GameModeId, GameMode> = {
  "relay-30": {
    id: "relay-30",
    label: "30頁接力",
    progress: "pages",
    totalRounds: 30,
  },
  world: {
    id: "world",
    label: "世界模式",
    progress: "world",
    totalRounds: null,
  },
};

export const DEFAULT_GAME_MODE: GameModeId = "relay-30";

export function getGameMode(modeId: GameModeId | undefined): GameMode {
  return GAME_MODES[modeId ?? DEFAULT_GAME_MODE];
}

export function isFiniteRoundMode(modeId: GameModeId | undefined): boolean {
  return getGameMode(modeId).totalRounds !== null;
}

export function getTotalRounds(modeId: GameModeId | undefined): number | null {
  return getGameMode(modeId).totalRounds;
}
