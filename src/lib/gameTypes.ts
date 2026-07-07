export type MapType = 'earth' | 'space';
export type TimeOfDay = 'day' | 'dusk' | 'night';

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

export interface RoomState {
  map: MapType;
  currentRound: number; // 1-30
  currentPlayerId: string | null;
  pages: Record<string, string>; // round (1-30) -> dataURL
  players: Record<string, Player>;
  phase: 'lobby' | 'playing' | 'review';
  createdAt: number;
}

export function getTimeOfDay(round: number): TimeOfDay {
  const cycle = ((round - 1) % 6) + 1;
  if (cycle <= 2) return 'day';
  if (cycle <= 4) return 'dusk';
  return 'night';
}

export function getBackgroundStyle(map: MapType, timeOfDay: TimeOfDay): string {
  if (map === 'space') {
    if (timeOfDay === 'day') return 'bg-gradient-to-b from-indigo-950 via-purple-950 to-black';
    if (timeOfDay === 'dusk') return 'bg-gradient-to-b from-purple-950 via-pink-950 to-black';
    return 'bg-gradient-to-b from-black via-slate-950 to-black';
  }
  // earth
  if (timeOfDay === 'day') return 'bg-gradient-to-b from-sky-400 via-sky-200 to-green-300';
  if (timeOfDay === 'dusk') return 'bg-gradient-to-b from-orange-400 via-rose-300 to-purple-400';
  return 'bg-gradient-to-b from-slate-900 via-blue-950 to-slate-800';
}

export interface Comic {
  id: string;
  title: string;
  createdAt: number;
  pages: Record<string, string>;
}

export function generateComicId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function generatePlayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
