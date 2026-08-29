import {
  DEFAULT_GAME_MODE,
  type GameModeId,
} from "./game/GameMode";
import type { GameState } from "./game/GameState";

export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 5000;
export const TOTAL_ROUNDS = 30;

export type MapType = "earth" | "space";
export type TimeOfDay = "day" | "dusk" | "night";

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

/**
 * 房間只保存房間本身的共用資料。
 * 遊戲執行狀態集中在 game，模式專屬資料集中在 game.modeState。
 */
export interface RoomState {
  map: MapType;
  game: GameState;
  players: Record<string, Player>;
  createdAt: number;
}

/**
 * 已完成的漫畫成果。
 * map 保存在成果資料本身，讓歷史作品不需要依賴已經不存在的房間。
 */
export interface Comic {
  id: string;
  title: string;
  createdAt: number;
  pages: Record<string, string>;
  map?: MapType;
}

export function generateId(length: number): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

export function generateRoomId(): string {
  return generateId(6).toUpperCase();
}

export function generatePlayerId(): string {
  return generateId(12);
}

export function generateComicId(): string {
  return generateId(16);
}

export function getDefaultGameMode(): GameModeId {
  return DEFAULT_GAME_MODE;
}

/**
 * 時段以「完整玩家輪」為單位推進。
 *
 * 例如 2 人：1-2 白天、3-4 黃昏、5-6 夜晚。
 * 3 人：1-3 白天、4-6 黃昏、7-9 夜晚。
 * 1 人測試時則每頁切換一次時段。
 */
export function getTimeOfDay(round: number, playerCount = 1): TimeOfDay {
  const turnsPerPhase = Math.max(1, Math.floor(playerCount));
  const phaseIndex = Math.floor(Math.max(0, round - 1) / turnsPerPhase) % 3;

  if (phaseIndex === 0) return "day";
  if (phaseIndex === 1) return "dusk";
  return "night";
}

export function getBackgroundColor(map: MapType, time: TimeOfDay): string {
  if (map === "earth") {
    if (time === "day") return "#bfefff";
    if (time === "dusk") return "#ffd580";
    return "#1a2744";
  }

  if (time === "day") return "#0d1b4b";
  if (time === "dusk") return "#2d0a3e";
  return "#050a14";
}
