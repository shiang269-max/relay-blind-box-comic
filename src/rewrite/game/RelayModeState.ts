/**
 * 30頁接力模式專屬小型狀態。
 *
 * 大型頁面影像不再放入 GameState.modeState，
 * 正式資料儲存在 relayPages/{gameId}/{turn}。
 */
export interface RelayModeState {
  pages: Record<string, never>;
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
