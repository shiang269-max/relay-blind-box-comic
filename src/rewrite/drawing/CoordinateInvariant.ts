import type { Point } from "./Camera";

/**
 * 繪圖引擎的座標不變條件。
 *
 * screen -> world -> screen 往返後，必須回到同一個 CSS screen point。
 * 這個規則未來可作為單元測試與除錯基準。
 */
export function isCoordinateRoundTripValid(
  screen: Point,
  world: Point,
  returnedScreen: Point,
  tolerance = 0.01
): boolean {
  const worldError = Math.abs(screen.x - returnedScreen.x) + Math.abs(screen.y - returnedScreen.y);

  return (
    Number.isFinite(world.x) &&
    Number.isFinite(world.y) &&
    worldError <= tolerance
  );
}
