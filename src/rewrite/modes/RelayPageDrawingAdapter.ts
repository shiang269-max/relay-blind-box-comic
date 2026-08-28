import type { DrawingPersistence } from "./DrawingPersistence";
import { deserializeStrokes, serializeStrokes } from "../drawing/StrokeCodec";
import type { Stroke } from "../drawing/Stroke";

/**
 * 30 頁接力模式的繪圖資料 Adapter。
 *
 * Drawing Engine 不知道 room / page / Firebase 的存在。
 * 這一層才把遊戲模式的 page identity 轉換成持久化資料。
 */
export interface RelayPageDrawingAdapterOptions {
  roomId: string;
  pageIndex: number;
  persistence: DrawingPersistence;
}

export class RelayPageDrawingAdapter {
  private readonly scope: string;

  constructor(
    private readonly options: RelayPageDrawingAdapterOptions
  ) {
    if (!options.roomId) {
      throw new Error("roomId 不可為空");
    }

    if (!Number.isInteger(options.pageIndex) || options.pageIndex < 0) {
      throw new Error("pageIndex 必須是非負整數");
    }

    this.scope = `relay:${options.roomId}:page:${options.pageIndex}`;
  }

  async load(): Promise<Stroke[]> {
    const raw = await this.options.persistence.load(this.scope);
    return deserializeStrokes(raw);
  }

  async save(strokes: readonly Stroke[]): Promise<void> {
    await this.options.persistence.save(
      this.scope,
      serializeStrokes(strokes)
    );
  }

  async clear(): Promise<void> {
    await this.options.persistence.clear(this.scope);
  }
}
