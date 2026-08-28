import type { SerializedStroke } from "../drawing/StrokeCodec";

/**
 * Drawing Engine 與外部資料來源的邊界。
 * scope 由遊戲模式決定；Engine 不知道 room/page/world/Firebase。
 */
export interface DrawingPersistence {
  load(scope: string): Promise<SerializedStroke[]>;
  save(scope: string, strokes: readonly SerializedStroke[]): Promise<void>;
  clear(scope: string): Promise<void>;
}

/**
 * 未來世界模式可使用增量筆劃同步，而 30 頁模式目前維持整頁快照。
 */
export interface IncrementalDrawingPersistence extends DrawingPersistence {
  append(scope: string, stroke: SerializedStroke): Promise<void>;
}
