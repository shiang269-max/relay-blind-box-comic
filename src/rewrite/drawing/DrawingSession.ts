import type { Brush, DrawingSurface } from "./DrawingSurface";
import type { Point } from "./Camera";

/**
 * 共用繪圖 Session。
 *
 * 不知道目前是 30 頁接力還是世界模式，只負責：
 * - 管理目前是否有未結束的筆劃
 * - 將 input point 交給 DrawingSurface
 * - 匯出目前世界畫布
 *
 * 模式流程、回合、頁數、Firebase 都不屬於這一層。
 */
export class DrawingSession {
  private active = false;

  constructor(
    private readonly surface: DrawingSurface
  ) {}

  begin(point: Point, brush: Brush): boolean {
    if (this.active) {
      this.surface.endStroke();
    }

    this.active = this.surface.startStroke(point, brush);
    return this.active;
  }

  move(point: Point, brush: Brush): void {
    if (!this.active) return;
    this.surface.continueStroke(point, brush);
  }

  end(): void {
    this.active = false;
    this.surface.endStroke();
  }

  cancel(): void {
    this.end();
  }

  clear(): void {
    this.end();
    this.surface.clear();
  }

  exportPng(): string {
    this.end();
    return this.surface.exportPng();
  }
}
