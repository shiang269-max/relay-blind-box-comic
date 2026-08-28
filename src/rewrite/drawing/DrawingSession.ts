import type { Brush, DrawingSurface } from "./DrawingSurface";
import type { Point } from "./Camera";
import { appendStrokePoint, createStroke, type Stroke } from "./Stroke";

export type DrawingSessionListener = (stroke: Stroke) => void;

export class DrawingSession {
  private activeStroke: Stroke | null = null;
  private readonly strokes: Stroke[] = [];
  private readonly listeners = new Set<DrawingSessionListener>();
  private nextStrokeId = 1;

  constructor(private readonly surface: DrawingSurface) {}

  begin(point: Point, brush: Brush): boolean {
    this.end();
    if (!this.surface.startStroke(point, brush)) return false;
    this.activeStroke = createStroke(this.createStrokeId(), brush, point);
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

  replaceStrokes(strokes: readonly Stroke[]): void {
    this.activeStroke = null;
    this.surface.endStroke();
    this.strokes.length = 0;
    this.strokes.push(...strokes.map(cloneStroke));
    this.surface.redraw(this.strokes);
  }

  getStrokes(): readonly Stroke[] {
    return this.strokes.map(cloneStroke);
  }

  subscribe(listener: DrawingSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  exportPng(): string {
    this.end();
    return this.surface.exportPng();
  }

  private emit(stroke: Stroke): void {
    const snapshot = cloneStroke(stroke);
    for (const listener of this.listeners) listener(snapshot);
  }

  private createStrokeId(): string {
    const id = this.nextStrokeId++;
    return `stroke-${Date.now()}-${id}`;
  }
}

function cloneStroke(stroke: Stroke): Stroke {
  return {
    id: stroke.id,
    brush: { ...stroke.brush },
    points: stroke.points.map((point) => ({ ...point })),
  };
}
