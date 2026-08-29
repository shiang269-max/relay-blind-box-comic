import {
  DEFAULT_GAME_MODE,
  type GameModeId,
} from "./game/GameMode";

/**
 * 標準接力模式採用 3:4 直式世界。
 * 這是世界座標與實際繪圖解析度，不是初始螢幕顯示尺寸。
 */
export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 2400;
export const TOTAL_ROUNDS = 30;

export type MapType = "earth" | "space";
export type TimeOfDay = "day" | "dusk" | "night";

export interface Player { id: string; name: string; joinedAt: number; }
export interface LobbyConfig { selectedMode: GameModeId; selectedMap: MapType; }
export interface RoomState { players: Record<string, Player>; currentGameId: string | null; lobby: LobbyConfig; createdAt: number; }
export interface Comic { id: string; title: string; createdAt: number; pages: Record<string, string>; map?: MapType; }

function createRandomIdSource(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID().replace(/-/g, "");
    if (typeof crypto.getRandomValues === "function") {
      const values = new Uint32Array(4);
      crypto.getRandomValues(values);
      return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
    }
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function generateId(length: number): string {
  let value = "";
  while (value.length < length) value += createRandomIdSource();
  return value.slice(0, length);
}
export function generateRoomId(): string { return generateId(6).toUpperCase(); }
export function generatePlayerId(): string { return generateId(12); }
export function generateGameId(): string { return generateId(20); }
export function generateComicId(): string { return generateId(16); }
export function getDefaultGameMode(): GameModeId { return DEFAULT_GAME_MODE; }
export function createDefaultLobbyConfig(): LobbyConfig { return { selectedMode: DEFAULT_GAME_MODE, selectedMap: "earth" }; }

export function getTimeOfDay(round: number, participantCount = 1): TimeOfDay {
  const turnsPerPhase = Math.max(1, Math.floor(participantCount));
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
