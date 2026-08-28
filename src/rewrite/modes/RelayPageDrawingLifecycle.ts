import { DrawingSession } from "../drawing/DrawingSession";
import type { RelayPageDrawingAdapter } from "./RelayPageDrawingAdapter";

/**
 * 30 頁模式與 DrawingSession 的生命週期協調器。
 *
 * 進入頁面：load -> validate -> replaceStrokes -> redraw
 * 離開頁面：由模式決定何時 save；此類別提供明確 saveSnapshot()
 */
export class RelayPageDrawingLifecycle {
  private loading = false;
  private ready = false;

  constructor(
    private readonly session: DrawingSession,
    private readonly adapter: RelayPageDrawingAdapter
  ) {}

  async initialize(): Promise<void> {
    if (this.loading) return;

    this.loading = true;
    this.ready = false;

    try {
      const strokes = await this.adapter.load();
      this.session.replaceStrokes(strokes);
      this.ready = true;
    } finally {
      this.loading = false;
    }
  }

  async saveSnapshot(): Promise<void> {
    if (!this.ready) {
      throw new Error("繪圖頁面尚未完成初始化");
    }

    await this.adapter.save(this.session.getStrokes());
  }

  async clear(): Promise<void> {
    if (!this.ready) {
      throw new Error("繪圖頁面尚未完成初始化");
    }

    this.session.clear();
    await this.adapter.clear();
  }

  isReady(): boolean {
    return this.ready;
  }

  isLoading(): boolean {
    return this.loading;
  }
}
