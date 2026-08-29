/**
 * 30頁接力模式專屬狀態。
 *
 * 大型頁面影像不再放入 GameState.modeState。
 * 正式頁面資料統一存放於 relayPages/{gameId}/{turn}。
 */
export interface RelayModeState {}

export function createRelayModeState(): RelayModeState {
  return {};
}

export function getRelayPreviousPageKey(
  currentTurn: number
): string | null {
  if (currentTurn <= 1) return null;
  return String(currentTurn - 1);
}
