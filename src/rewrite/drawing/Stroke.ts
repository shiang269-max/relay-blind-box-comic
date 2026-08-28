import type { Point } from "./Camera";
import type { Brush } from "./DrawingSurface";

export interface StrokePoint extends Point {
  t: number;
}

/**
 * 可序列化的筆劃資料。
 * 畫面渲染只是 Stroke 的投影；真正可同步、可重播、可儲存的單位是 Stroke。
 */
export interface Stroke {
  id: string;
  brush: Brush;
  points: StrokePoint[];
}

export function createStroke(id: string, brush: Brush, point: Point): Stroke {
  return {
    id,
    brush: { ...brush },
    points: [{ ...point, t: Date.now() }],
  };
}

export function appendStrokePoint(stroke: Stroke, point: Point): StrokePoint {
  const next: StrokePoint = { ...point, t: Date.now() };
  stroke.points.push(next);
  return next;
}
