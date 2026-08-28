import type { Stroke } from "../drawing/Stroke";
import type { SerializedStroke } from "../drawing/StrokeCodec";

/**
 * 模式層定義的持久化邊界。
 * 30頁模式與未來世界模式都可以各自實作，不依賴 DrawingSession。
 */
export interface DrawingPersistence {
  load(): Promise<SerializedStroke[]>;
  save(strokes: SerializedStroke[]): Promise<void>;
}

/**
 * 可選的增量同步能力。
 * 世界模式可實作 append，而完整頁面模式可以只使用 save。
 */
export interface IncrementalDrawingPersistence extends DrawingPersistence {
  append(stroke: SerializedStroke): Promise<void>;
}

export interface DrawingSnapshot {
  strokes: readonly Stroke[];
  version?: number;
}
