import type { Brush, DrawingSurface } from "./DrawingSurface";
import type { Point } from "./Camera";
import {
  appendStrokePoint,
  createStroke,
  type Stroke,
} from "./Stroke";

export type DrawingSessionListener = (stroke: Stroke) => void;

/**
 * 共用繪圖 Session。
 *
 * 職責固定為：
 * - 管理目前筆劃
 * - 將 world point 交給 DrawingSurface 即時渲染
 * - 保留可序列化 Stroke，供 Firebase 同步與未來重播使用
 *
 * Session 不知道目前是 30 頁接力還是世界模式。
 */
export class DrawingSession {
  private activeStroke: Stroke | null = null;
  private readonly strokes: Stroke[] = [];
  private readonly listeners = new Set<DrawingSessionListener>();
  private nextStrokeId = 1;

  constructor(
    private readonly surface: DrawingSurface
  ) {}

  begin(point: Point, brush: Brush): boolean {
    this.end();

    if (!this.surface.startStroke(point, brush)) {
      return false;
    }

    this.activeStroke = createStroke(
      this.createStrokeId(),
      brush,
      point
    );

    return true;
  }

  move(point: Point, brush: Brush): void {
    if (!this.activeStroke) return;

    this.surface.continueStroke(point, brush);
    appendStrokePoint(this.activeStroke, point);
  }

  end(): void {
    if (!this.activeStroke) {
      this.surface.endStroke();
      return;
    }

    const completed = this.activeStroke;
    this.activeStroke = null;
    this.surface.endStroke();

    this.strokes.push(completed);
    this.emit(completed);
  }

  cancel(): void {
    this.activeStroke = null;
    this.surface.endStroke();
  }

  clear(): void {
    this.activeStroke = null;
    this.strokes.length = 0;
    this.surface.clear();
  }

  getStrokes(): readonly Stroke[] {
    return this.strokes;
  }

  subscribe(listener: DrawingSessionListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  exportPng(): string {
    this.end();
    return this.surface.exportPng();
  }

  private emit(stroke: Stroke): void {
    for (const listener of this.listeners) {
      listener(stroke);
    }
  }

  private createStrokeId(): string {
    const id = this.nextStrokeId;
    this.nextStrokeId += 1;
    return `stroke-${Date.now()}-${id}`;
  }
}
