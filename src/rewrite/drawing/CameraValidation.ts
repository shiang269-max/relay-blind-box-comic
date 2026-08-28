import { Camera, type Point } from "./Camera";

export interface CameraValidationCase {
  name: string;
  passed: boolean;
  expected?: Point;
  actual?: Point;
}

export function validateCameraInvariants(): CameraValidationCase[] {
  const results: CameraValidationCase[] = [];
  const camera = new Camera({ width: 3000, height: 5000 });
  camera.setViewport(390, 640);

  const samples: Point[] = [
    { x: 0, y: 0 },
    { x: 195, y: 320 },
    { x: 390, y: 640 },
    { x: 32, y: 608 },
    { x: 358, y: 48 },
  ];

  const roundTrip = (name: string, point: Point) => {
    const world = camera.screenToWorld(point);
    const screen = camera.worldToScreen(world);
    results.push({
      name,
      passed: closePoint(point, screen),
      expected: point,
      actual: screen,
    });
  };

  for (const point of samples) roundTrip("初始畫面座標往返", point);

  camera.zoomAt({ x: 195, y: 320 }, 3.2);
  camera.panByScreen(-120, 85);
  for (const point of samples) roundTrip("縮放平移後座標往返", point);

  camera.zoomAt({ x: 358, y: 48 }, 0.08);
  for (const point of samples) roundTrip("最小縮放附近座標往返", point);

  camera.zoomAt({ x: 32, y: 608 }, 300);
  for (const point of samples) roundTrip("最大縮放附近座標往返", point);

  camera.setViewport(430, 932);
  for (const point of samples) roundTrip("手機直向尺寸變更後座標往返", point);

  return results;
}

export function assertCameraInvariants(): void {
  const failures = validateCameraInvariants().filter((result) => !result.passed);
  if (failures.length > 0) {
    throw new Error(
      `Camera 座標驗證失敗：${failures.map((failure) => failure.name).join("、")}`
    );
  }
}

function closePoint(a: Point, b: Point, tolerance = 0.0001): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}
