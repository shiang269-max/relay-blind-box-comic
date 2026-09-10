import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";
import { getWorldTimeProgress, type MapType, type TimeOfDay } from "../domain";
import { WorldRenderer } from "../visuals/WorldRenderer";

export interface Brush { color: string; size: number; eraser: boolean; }
export interface SurfaceOptions { worldWidth: number; worldHeight: number; map: MapType; time: TimeOfDay; round?: number; }
const EXPORT_MAX_WIDTH = 1800;
const EXPORT_MAX_HEIGHT = 2400;
const WORLD_ANIMATION_INTERVAL = 120;

export class DrawingSurface {
  readonly camera: Camera;
  private readonly worldBackgroundCanvas: HTMLCanvasElement;
  private readonly worldBackgroundContext: CanvasRenderingContext2D;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly baseContext: CanvasRenderingContext2D;
  private readonly strokeCanvas: HTMLCanvasElement;
  private readonly strokeContext: CanvasRenderingContext2D;
  private readonly viewportContext: CanvasRenderingContext2D;
  private readonly worldRenderer: WorldRenderer;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private lastPoint: Point | null = null;
  private renderFrame: number | null = null;
  private animationTimer: number | null = null;
  private destroyed = false;

  constructor(private readonly viewportCanvas: HTMLCanvasElement, private readonly options: SurfaceOptions) {
    const context = viewportCanvas.getContext("2d", { alpha: false });
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
    this.worldRenderer = new WorldRenderer({ map: options.map, progress: getWorldTimeProgress(options.round ?? 1) });
    this.paintWorldBackground();
    this.camera = new Camera({ width: options.worldWidth, height: options.worldHeight });
    this.startWorldAnimation();
  }

  resize(cssWidth: number, cssHeight: number): void {
    if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) return;
    const nextWidth = Math.max(1, Math.round(cssWidth));
    const nextHeight = Math.max(1, Math.round(cssHeight));
    const nextDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    if (nextWidth === this.cssWidth && nextHeight === this.cssHeight && nextDpr === this.dpr) return;

    this.cancelRender();
    this.cssWidth = nextWidth;
    this.cssHeight = nextHeight;
    this.dpr = nextDpr;
    const backingWidth = Math.max(1, Math.round(this.cssWidth * this.dpr));
    const backingHeight = Math.max(1, Math.round(this.cssHeight * this.dpr));
    if (this.viewportCanvas.width !== backingWidth) this.viewportCanvas.width = backingWidth;
    if (this.viewportCanvas.height !== backingHeight) this.viewportCanvas.height = backingHeight;
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
    this.cancelRender();
    this.render();
    return true;
  }

  continueStroke(point: Point, brush: Brush): void {
    if (!this.lastPoint) return;
    const from = this.lastPoint;
    this.drawSegment(from, point, brush);
    this.lastPoint = point;

    if (!brush.eraser) this.drawSegmentToViewport(from, point, brush);
    else this.requestRender();
  }

  endStroke(): void {
    this.lastPoint = null;
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
    const worldWidth = this.options.worldWidth;
    const worldHeight = this.options.worldHeight;

    // One rendering coordinate system: CSS viewport -> DPR -> camera world.
    // All world layers use the same transform; this avoids mixing crop coordinates
    // with camera coordinates during the same composite pass.
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.options.map === "space" ? "#030711" : "#cbd8d2";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.save();
    ctx.setTransform(
      dpr * zoom,
      0,
      0,
      dpr * zoom,
      -this.camera.x * dpr * zoom,
      -this.camera.y * dpr * zoom,
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";

    // Only the actual world may receive world layers. The camera may expose
    // negative world coordinates at fit zoom; those areas remain the viewport fill.
    ctx.beginPath();
    ctx.rect(0, 0, worldWidth, worldHeight);
    ctx.clip();

    ctx.drawImage(this.worldBackgroundCanvas, 0, 0, worldWidth, worldHeight);
    this.worldRenderer.paintDynamic(ctx, this.camera, performance.now());
    ctx.drawImage(this.baseCanvas, 0, 0, worldWidth, worldHeight);
    ctx.drawImage(this.strokeCanvas, 0, 0, worldWidth, worldHeight);
    ctx.restore();

    ctx.globalCompositeOperation = "source-over";
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
    this.cancelRender();
    if (this.animationTimer !== null) {
      window.clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
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

  private startWorldAnimation(): void {
    this.animationTimer = window.setInterval(() => {
      if (this.destroyed || this.lastPoint !== null) return;
      this.requestRender();
    }, WORLD_ANIMATION_INTERVAL);
  }

  private createWorldCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.options.worldWidth;
    canvas.height = this.options.worldHeight;
    return canvas;
  }

  private paintWorldBackground(): void {
    this.worldRenderer.paintStatic(this.worldBackgroundContext, this.options.worldWidth, this.options.worldHeight);
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

  private drawDot(point: Point, brush: Brush): void {
    this.configureBrush(this.strokeContext, brush);
    this.strokeContext.beginPath();
    this.strokeContext.arc(point.x, point.y, Math.max(brush.size / 2, 0.5), 0, Math.PI * 2);
    this.strokeContext.fill();
  }

  private drawSegment(from: Point, to: Point, brush: Brush): void {
    this.configureBrush(this.strokeContext, brush);
    this.strokeContext.beginPath();
    this.strokeContext.moveTo(from.x, from.y);
    this.strokeContext.lineTo(to.x, to.y);
    this.strokeContext.stroke();
  }

  private drawSegmentToViewport(from: Point, to: Point, brush: Brush): void {
    const ctx = this.viewportContext;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(
      this.dpr * this.camera.zoom,
      0,
      0,
      this.dpr * this.camera.zoom,
      -this.camera.x * this.dpr * this.camera.zoom,
      -this.camera.y * this.dpr * this.camera.zoom,
    );
    this.configureBrush(ctx, brush);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private configureBrush(ctx: CanvasRenderingContext2D, brush: Brush): void {
    ctx.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = brush.color;
    ctx.fillStyle = brush.color;
    ctx.lineWidth = brush.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  private cancelRender(): void {
    if (this.renderFrame === null) return;
    window.cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
  }
}
