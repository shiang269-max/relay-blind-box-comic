import type { Brush } from "./DrawingSurface";
import type { Stroke, StrokePoint } from "./Stroke";

/**
 * Engine 與外部儲存層之間唯一允許傳遞的筆劃格式。
 * 不把 Engine 內部物件、class 或 Canvas 物件直接交給 Firebase。
 */
export interface SerializedStroke {
  id: string;
  brush: {
    color: string;
    size: number;
    eraser: boolean;
  };
  points: Array<{
    x: number;
    y: number;
    t: number;
  }>;
}

export interface StrokeDecodeResult {
  stroke: Stroke | null;
  errors: string[];
}

export function serializeStroke(stroke: Stroke): SerializedStroke {
  return {
    id: stroke.id,
    brush: { ...stroke.brush },
    points: stroke.points.map((point) => ({ ...point })),
  };
}

export function serializeStrokes(strokes: readonly Stroke[]): SerializedStroke[] {
  return strokes.map(serializeStroke);
}

export function deserializeStroke(value: unknown): StrokeDecodeResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { stroke: null, errors: ["Stroke 必須是物件"] };
  }

  const id = value.id;
  const brush = value.brush;
  const points = value.points;

  if (typeof id !== "string" || id.length === 0) errors.push("Stroke id 無效");
  const decodedBrush = decodeBrush(brush, errors);
  const decodedPoints = decodePoints(points, errors);

  if (errors.length > 0 || !decodedBrush || !decodedPoints || typeof id !== "string") {
    return { stroke: null, errors };
  }

  return {
    stroke: {
      id,
      brush: decodedBrush,
      points: decodedPoints,
    },
    errors: [],
  };
}

export function deserializeStrokes(value: unknown): StrokeDecodeResult[] {
  if (!Array.isArray(value)) {
    return [{ stroke: null, errors: ["Stroke 列表必須是陣列"] }];
  }

  return value.map(deserializeStroke);
}

function decodeBrush(value: unknown, errors: string[]): Brush | null {
  if (!isRecord(value)) {
    errors.push("Brush 必須是物件");
    return null;
  }

  if (typeof value.color !== "string") errors.push("Brush color 無效");
  if (!isFiniteNumber(value.size) || value.size <= 0) errors.push("Brush size 無效");
  if (typeof value.eraser !== "boolean") errors.push("Brush eraser 無效");

  if (
    typeof value.color !== "string" ||
    !isFiniteNumber(value.size) ||
    value.size <= 0 ||
    typeof value.eraser !== "boolean"
  ) {
    return null;
  }

  return {
    color: value.color,
    size: value.size,
    eraser: value.eraser,
  };
}

function decodePoints(value: unknown, errors: string[]): StrokePoint[] | null {
  if (!Array.isArray(value)) {
    errors.push("Stroke points 必須是陣列");
    return null;
  }

  const points: StrokePoint[] = [];

  value.forEach((point, index) => {
    if (!isRecord(point)) {
      errors.push(`Point ${index} 無效`);
      return;
    }

    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(point.t)) {
      errors.push(`Point ${index} 座標或時間無效`);
      return;
    }

    points.push({ x: point.x, y: point.y, t: point.t });
  });

  return errors.length === 0 ? points : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
