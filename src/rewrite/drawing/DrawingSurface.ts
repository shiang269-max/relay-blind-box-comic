import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";
import type { MapType, TimeOfDay } from "../domain";

export interface Brush { color: string; size: number; eraser: boolean; }
export interface SurfaceOptions { worldWidth: number; worldHeight: number; map: MapType; time: TimeOfDay; round?: number; }
const EXPORT_MAX_WIDTH = 1800;
const EXPORT_MAX_HEIGHT = 2400;

export class DrawingSurface {
  readonly camera: Camera;
  private readonly worldBackgroundCanvas: HTMLCanvasElement;
  private readonly worldBackgroundContext: CanvasRenderingContext2D;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly baseContext: CanvasRenderingContext2D;
  private readonly strokeCanvas: HTMLCanvasElement;
  private readonly strokeContext: CanvasRenderingContext2D;
  private readonly viewportContext: CanvasRenderingContext2D;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private canvasLeft = 0;
  private canvasTop = 0;
  private canvasRectWidth = 1;
  private canvasRectHeight = 1;
  private lastPoint: Point | null = null;
  private livePoints: Point[] = [];
  private liveBrush: Brush | null = null;
  private renderFrame: number | null = null;
  private destroyed = false;

  constructor(private readonly viewportCanvas: HTMLCanvasElement, private readonly options: SurfaceOptions) {
    const context = viewportCanvas.getContext("2d");
    if (!context) throw new Error("無法建立 viewport context");
    this.viewportContext = context;
    this.worldBackgroundCanvas = this.createWorldCanvas();
    const bg = this.worldBackgroundCanvas.getContext("2d");
    if (!bg) throw new Error("無法建立世界背景 context");
    this.worldBackgroundContext = bg;
    this.baseCanvas = this.createWorldCanvas();
    const base = this.baseCanvas.getContext("2d");
    if (!base) throw new Error("無法建立 base context");
    this.baseContext = base;
    this.strokeCanvas = this.createWorldCanvas();
    const stroke = this.strokeCanvas.getContext("2d");
    if (!stroke) throw new Error("無法建立 stroke context");
    this.strokeContext = stroke;
    this.paintWorldBackground();
    this.camera = new Camera({ width: options.worldWidth, height: options.worldHeight });
  }

  resize(cssWidth: number, cssHeight: number): void {
    if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) return;
    this.cancelRender();
    this.cssWidth = Math.max(1, Math.round(cssWidth));
    this.cssHeight = Math.max(1, Math.round(cssHeight));
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.viewportCanvas.style.width = `${this.cssWidth}px`;
    this.viewportCanvas.style.height = `${this.cssHeight}px`;
    this.refreshCanvasRect();
    const backingWidth = Math.max(1, Math.round(this.cssWidth * this.dpr));
    const backingHeight = Math.max(1, Math.round(this.cssHeight * this.dpr));
    if (this.viewportCanvas.width !== backingWidth) this.viewportCanvas.width = backingWidth;
    if (this.viewportCanvas.height !== backingHeight) this.viewportCanvas.height = backingHeight;
    this.camera.setViewport(this.cssWidth, this.cssHeight);
    this.render();
  }

  eventToScreen(event: PointerEvent | WheelEvent, refreshLayout = false): Point {
    if (refreshLayout) this.refreshCanvasRect();
    return {
      x: (event.clientX - this.canvasLeft) * this.cssWidth / this.canvasRectWidth,
      y: (event.clientY - this.canvasTop) * this.cssHeight / this.canvasRectHeight,
    };
  }

  eventToWorld(event: PointerEvent, refreshLayout = false): Point {
    return this.camera.screenToWorld(this.eventToScreen(event, refreshLayout));
  }

  startStroke(point: Point, brush: Brush): boolean {
    if (!this.camera.isInsideWorld(point)) return false;
    this.lastPoint = point;
    this.livePoints = [point];
    this.liveBrush = { ...brush };
    this.beginLiveViewport(brush);
    this.drawDotToViewport(point, brush);
    return true;
  }

  continueStroke(point: Point, brush: Brush): void {
    if (!this.lastPoint) return;
    const from = this.lastPoint;
    this.lastPoint = point;
    this.livePoints.push(point);
    this.drawLiveSegment(from, point, brush);
  }

  endStroke(): void {
    if (this.lastPoint && this.livePoints.length > 0 && this.liveBrush) {
      this.commitLiveStroke();
    }
    this.lastPoint = null;
    this.livePoints = [];
    this.liveBrush = null;
    this.resetViewportTransform();
    this.cancelRender();
    this.render();
  }

  clear(): void {
    this.endStroke();
    this.strokeContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
    this.render();
  }

  redraw(strokes: readonly Stroke[]): void {
    this.endStroke();
    this.strokeContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
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
    this.baseContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
    this.baseContext.drawImage(image, 0, 0, this.options.worldWidth, this.options.worldHeight);
    this.render();
  }

  render(): void {
    if (this.destroyed) return;
    const ctx = this.viewportContext;
    const dpr = this.dpr;
    const zoom = this.camera.zoom;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.fillStyle = this.options.map === "space" ? "#030711" : "#d8e1dc";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -this.camera.x * dpr * zoom, -this.camera.y * dpr * zoom);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(this.worldBackgroundCanvas, 0, 0);
    ctx.drawImage(this.baseCanvas, 0, 0);
    ctx.drawImage(this.strokeCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  requestRender(): void {
    if (this.destroyed || this.renderFrame !== null) return;
    this.renderFrame = window.requestAnimationFrame(() => {
      this.renderFrame = null;
      this.render();
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.lastPoint = null;
    this.livePoints = [];
    this.liveBrush = null;
    this.cancelRender();
  }

  getStrokeCoverageScore(): number {
    const step = 6;
    const width = this.options.worldWidth;
    const height = this.options.worldHeight;
    const pixels = this.strokeContext.getImageData(0, 0, width, height).data;
    let occupied = 0;
    let sampled = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        sampled += 1;
        if (pixels[(y * width + x) * 4 + 3] > 24) occupied += 1;
      }
    }
    if (!occupied || !sampled) return 0;
    return Math.max(1, Math.min(100, Math.round(Math.sqrt(occupied / sampled) * 100)));
  }

  exportPng(): string {
    this.endStroke();
    const scale = Math.min(1, EXPORT_MAX_WIDTH / this.options.worldWidth, EXPORT_MAX_HEIGHT / this.options.worldHeight);
    const width = Math.max(1, Math.round(this.options.worldWidth * scale));
    const height = Math.max(1, Math.round(this.options.worldHeight * scale));
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d");
    if (!ctx) throw new Error("無法建立輸出畫布");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.baseCanvas, 0, 0, width, height);
    ctx.drawImage(this.strokeCanvas, 0, 0, width, height);
    return output.toDataURL("image/png");
  }

  private createWorldCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.options.worldWidth;
    canvas.height = this.options.worldHeight;
    return canvas;
  }

  private paintWorldBackground(): void {
    this.worldBackgroundContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
  }

  private refreshCanvasRect(): void {
    const rect = this.viewportCanvas.getBoundingClientRect();
    this.canvasLeft = rect.left;
    this.canvasTop = rect.top;
    this.canvasRectWidth = Math.max(1, rect.width);
    this.canvasRectHeight = Math.max(1, rect.height);
  }

  private beginLiveViewport(brush: Brush): void {
    const ctx = this.viewportContext;
    ctx.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    ctx.setTransform(this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom, -this.camera.x * this.dpr * this.camera.zoom, -this.camera.y * this.dpr * this.camera.zoom);
    this.configureBrush(ctx, brush);
  }

  private drawDotToViewport(point: Point, brush: Brush): void {
    const ctx = this.viewportContext;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(brush.size / 2, 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLiveSegment(from: Point, to: Point, brush: Brush): void {
    const ctx = this.viewportContext;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    if (brush.eraser) this.drawSegment(this.strokeContext, from, to, brush);
  }

  private commitLiveStroke(): void {
    const brush = this.liveBrush;
    if (!brush) return;
    if (brush.eraser) return;
    const first = this.livePoints[0];
    if (!first) return;
    this.configureBrush(this.strokeContext, brush);
    this.strokeContext.beginPath();
    this.strokeContext.moveTo(first.x, first.y);
    for (let i = 1; i < this.livePoints.length; i += 1) {
      const point = this.livePoints[i];
      this.strokeContext.lineTo(point.x, point.y);
    }
    this.strokeContext.stroke();
    this.drawDot(this.strokeContext, first, brush);
  }

  private drawStroke(stroke: Stroke): void {
    const [first, ...rest] = stroke.points;
    if (!first) return;
    this.drawDot(this.strokeContext, first, stroke.brush);
    if (rest.length === 0) return;
    this.configureBrush(this.strokeContext, stroke.brush);
    this.strokeContext.beginPath();
    this.strokeContext.moveTo(first.x, first.y);
    for (const point of rest) this.strokeContext.lineTo(point.x, point.y);
    this.strokeContext.stroke();
  }

  private drawSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point, brush: Brush): void {
    this.configureBrush(ctx, brush);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  private drawDot(ctx: CanvasRenderingContext2D, point: Point, brush: Brush): void {
    this.configureBrush(ctx, brush);
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(brush.size / 2, 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  private configureBrush(ctx: CanvasRenderingContext2D, brush: Brush): void {
    ctx.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = brush.color;
    ctx.fillStyle = brush.color;
    ctx.lineWidth = brush.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  private resetViewportTransform(): void {
    this.viewportContext.globalCompositeOperation = "source-over";
    this.viewportContext.setTransform(1, 0, 0, 1, 0, 0);
  }

  private cancelRender(): void {
    if (this.renderFrame === null) return;
    window.cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
  }
}
