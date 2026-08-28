import {
  DEFAULT_GAME_MODE,
  type GameModeId,
} from "./game/GameMode";

export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 5000;
export const TOTAL_ROUNDS = 30;

export type MapType = "earth" | "space";
export type TimeOfDay = "day" | "dusk" | "night";
export type RoomPhase = "lobby" | "playing" | "review";

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

export interface RoomState {
  map: MapType;
  mode?: GameModeId;
  phase: RoomPhase;
  currentRound: number;
  currentPlayerId: string | null;
  pages: Record<string, string>;
  players: Record<string, Player>;
  createdAt: number;
}

export interface Comic {
  id: string;
  title: string;
  createdAt: number;
  pages: Record<string, string>;
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

export function getTimeOfDay(round: number): TimeOfDay {
  const cycle = ((round - 1) % 6) + 1;
  if (cycle <= 2) return "day";
  if (cycle <= 4) return "dusk";
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
