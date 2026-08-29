import type { DrawingPersistence } from "./DrawingPersistence";
import { deserializeStrokes, serializeStrokes, type SerializedStroke } from "../drawing/StrokeCodec";
import type { Stroke } from "../drawing/Stroke";

export interface RelayPageDrawingAdapterOptions {
  roomId: string;
  gameId: string;
  pageIndex: number;
  persistence: DrawingPersistence;
}

export class RelayPageDrawingAdapter {
  private readonly scope: string;

  constructor(private readonly options: RelayPageDrawingAdapterOptions) {
    if (!options.roomId) throw new Error("roomId 不可為空");
    if (!options.gameId) throw new Error("gameId 不可為空");
    if (!Number.isInteger(options.pageIndex) || options.pageIndex < 0) {
      throw new Error("pageIndex 必須是非負整數");
    }
    this.scope = `relay:${options.roomId}:game:${options.gameId}:page:${options.pageIndex}`;
  }

  async load(): Promise<Stroke[]> {
    const raw = await this.options.persistence.load(this.scope);
    const decoded = deserializeStrokes(raw);
    const invalid = decoded.filter((result) => result.stroke === null);
    if (invalid.length > 0) {
      throw new Error(`繪圖暫存資料格式無效：${invalid.flatMap((result) => result.errors).join("；")}`);
    }
    return decoded.flatMap((result) => result.stroke ? [result.stroke] : []);
  }

  async save(strokes: readonly Stroke[]): Promise<void> {
    const serialized: SerializedStroke[] = serializeStrokes(strokes);
    await this.options.persistence.save(this.scope, serialized);
  }

  async clear(): Promise<void> {
    await this.options.persistence.clear(this.scope);
  }
}
