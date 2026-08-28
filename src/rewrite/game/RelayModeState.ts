/**
 * 30頁接力模式專屬資料。
 *
 * 不放進共用 RoomState / GameState，避免未來世界模式被 pages 結構綁住。
 */
export interface RelayModeState {
  pages: Record<string, string>;
}

export function createRelayModeState(): RelayModeState {
  return {
    pages: {},
  };
}

export function getRelayPreviousPageKey(
  currentTurn: number
): string | null {
  if (currentTurn <= 1) return null;
  return String(currentTurn - 1);
}

export function appendRelayPage(
  state: RelayModeState,
  turn: number,
  pageDataUrl: string
): RelayModeState {
  return {
    ...state,
    pages: {
      ...state.pages,
      [String(turn)]: pageDataUrl,
    },
  };
}
