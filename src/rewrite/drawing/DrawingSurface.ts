import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";

export interface Brush {
  color: string;
  size: number;
  eraser: boolean;
}

export interface SurfaceOptions {
  worldWidth: number;
  worldHeight: number;
  background: string;
}

/** 唯一負責畫布座標、世界像素與渲染的 Surface。 */
export class DrawingSurface {
  readonly camera: Camera;
  private readonly worldCanvas: HTMLCanvasElement;
  private readonly worldContext: CanvasRenderingContext2D;
  private readonly viewportContext: CanvasRenderingContext2D;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private lastPoint: Point | null = null;

  constructor(
    private readonly viewportCanvas: HTMLCanvasElement,
    private readonly options: SurfaceOptions
  ) {
    const context = viewportCanvas.getContext("2d");
    if (!context) throw new Error("無法建立 viewport context");
    this.viewportContext = context;

    this.worldCanvas = document.createElement("canvas");
    this.worldCanvas.width = options.worldWidth;
    this.worldCanvas.height = options.worldHeight;

    const worldContext = this.worldCanvas.getContext("2d");
    if (!worldContext) throw new Error("無法建立 world context");
    this.worldContext = worldContext;

    this.camera = new Camera({ width: options.worldWidth, height: options.worldHeight });
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, Math.round(cssWidth));
    this.cssHeight = Math.max(1, Math.round(cssHeight));
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.viewportCanvas.width = Math.round(this.cssWidth * this.dpr);
    this.viewportCanvas.height = Math.round(this.cssHeight * this.dpr);
    this.viewportCanvas.style.width = `${this.cssWidth}px`;
    this.viewportCanvas.style.height = `${this.cssHeight}px`;
    this.camera.setViewport(this.cssWidth, this.cssHeight);
    this.render();
  }

  eventToScreen(event: PointerEvent | WheelEvent): Point {
    const rect = this.viewportCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * this.cssWidth / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * this.cssHeight / Math.max(1, rect.height),
    };
  }

  eventToWorld(event: PointerEvent): Point {
    return this.camera.screenToWorld(this.eventToScreen(event));
  }

  startStroke(point: Point, brush: Brush): boolean {
    if (!this.camera.isInsideWorld(point)) return false;
    this.lastPoint = point;
    this.drawDot(point, brush);
    this.render();
    return true;
  }

  continueStroke(point: Point, brush: Brush): void {
    if (!this.lastPoint) return;
    this.drawSegment(this.lastPoint, point, brush);
    this.lastPoint = point;
    this.render();
  }

  endStroke(): void {
    this.lastPoint = null;
  }

  clear(): void {
    this.endStroke();
    this.worldContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
    this.render();
  }

  redraw(strokes: readonly Stroke[]): void {
    this.endStroke();
    this.worldContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
    for (const stroke of strokes) this.drawStroke(stroke);
    this.render();
  }

  async loadImage(source: string): Promise<void> {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("上一頁圖片載入失敗"));
      image.src = source;
    });
    this.endStroke();
    this.worldContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
    this.worldContext.drawImage(image, 0, 0, this.options.worldWidth, this.options.worldHeight);
    this.render();
  }

  render(): void {
    const ctx = this.viewportContext;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.fillStyle = this.options.background;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.setTransform(
      this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom,
      -this.camera.x * this.dpr * this.camera.zoom,
      -this.camera.y * this.dpr * this.camera.zoom
    );
    ctx.drawImage(this.worldCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  exportPng(): string {
    this.endStroke();
    const output = document.createElement("canvas");
    output.width = this.options.worldWidth;
    output.height = this.options.worldHeight;
    const ctx = output.getContext("2d");
    if (!ctx) throw new Error("無法建立輸出畫布");
    ctx.fillStyle = this.options.background;
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(this.worldCanvas, 0, 0);
    return output.toDataURL("image/png");
  }

  private drawStroke(stroke: Stroke): void {
    const [first, ...rest] = stroke.points;
    if (!first) return;
    this.drawDot(first, stroke.brush);
    let previous = first;
    for (const point of rest) {
      this.drawSegment(previous, point, stroke.brush);
      previous = point;
    }
  }

  private drawSegment(from: Point, to: Point, brush: Brush): void {
    this.worldContext.save();
    this.worldContext.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    this.worldContext.strokeStyle = brush.color;
    this.worldContext.lineWidth = brush.size;
    this.worldContext.lineCap = "round";
    this.worldContext.lineJoin = "round";
    this.worldContext.beginPath();
    this.worldContext.moveTo(from.x, from.y);
    this.worldContext.lineTo(to.x, to.y);
    this.worldContext.stroke();
    this.worldContext.restore();
  }

  private drawDot(point: Point, brush: Brush): void {
    this.worldContext.save();
    this.worldContext.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    this.worldContext.fillStyle = brush.color;
    this.worldContext.beginPath();
    this.worldContext.arc(point.x, point.y, brush.size / 2, 0, Math.PI * 2);
    this.worldContext.fill();
    this.worldContext.restore();
  }
}
