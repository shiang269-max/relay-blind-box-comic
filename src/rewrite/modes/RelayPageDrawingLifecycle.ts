import { DrawingSession } from "../drawing/DrawingSession";
import type { RelayPageDrawingAdapter } from "./RelayPageDrawingAdapter";

export class RelayPageDrawingLifecycle {
  private loading = false;
  private ready = false;
  constructor(private readonly session: DrawingSession, private readonly adapter: RelayPageDrawingAdapter) {}

  async initialize(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.ready = false;
    try {
      this.session.replaceStrokes(await this.adapter.load());
      this.ready = true;
    } finally { this.loading = false; }
  }

  async saveSnapshot(): Promise<void> {
    if (!this.ready) throw new Error("繪圖頁面尚未完成初始化");
    await this.adapter.save(this.session.getStrokes());
  }

  async undo(): Promise<boolean> {
    if (!this.ready) throw new Error("繪圖頁面尚未完成初始化");
    const changed = this.session.undo();
    if (changed) await this.adapter.save(this.session.getStrokes());
    return changed;
  }

  async clear(): Promise<void> {
    if (!this.ready) throw new Error("繪圖頁面尚未完成初始化");
    this.session.clear();
    await this.adapter.clear();
  }

  isReady(): boolean { return this.ready; }
  isLoading(): boolean { return this.loading; }
}
