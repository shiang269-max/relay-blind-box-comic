import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";
import { getWorldTimeProgress, type MapType, type TimeOfDay } from "../domain";
import { WorldRenderer } from "../visuals/WorldRenderer";

export interface Brush { color: string; size: number; eraser: boolean; }
export interface SurfaceOptions { worldWidth: number; worldHeight: number; map: MapType; time: TimeOfDay; round?: number; }
const EXPORT_MAX_WIDTH = 1800;
const EXPORT_MAX_HEIGHT = 2400;
const WORLD_ANIMATION_INTERVAL = 180;
const MIN_PREVIEW_DISTANCE = 0.35;

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
  private viewportLeft = 0;
  private viewportTop = 0;
  private viewportCssWidth = 1;
  private viewportCssHeight = 1;
  private lastPoint: Point | null = null;
  private renderFrame: number | null = null;
  private animationTimer: number | null = null;
  private destroyed = false;
  private interactionActive = false;

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
    const rect = this.viewportCanvas.getBoundingClientRect();
    this.viewportLeft = rect.left;
    this.viewportTop = rect.top;
    this.viewportCssWidth = Math.max(1, rect.width);
    this.viewportCssHeight = Math.max(1, rect.height);
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
    return {
      x: (event.clientX - this.viewportLeft) * this.cssWidth / this.viewportCssWidth,
      y: (event.clientY - this.viewportTop) * this.cssHeight / this.viewportCssHeight,
    };
  }

  eventToWorld(event: PointerEvent): Point {
    return this.camera.screenToWorld(this.eventToScreen(event));
  }

  setInteractionActive(active: boolean): void {
    if (this.destroyed) return;
    this.interactionActive = active;
    if (active) this.cancelRender();
  }

  startStroke(point: Point, brush: Brush): boolean {
    if (!this.camera.isInsideWorld(point)) return false;
    this.interactionActive = true;
    this.lastPoint = point;
    this.drawDot(point, brush);
    if (brush.eraser) this.requestRender();
    else this.drawDotToViewport(point, brush);
    return true;
  }

  continueStroke(point: Point, brush: Brush): void {
    if (!this.lastPoint) return;
    const from = this.lastPoint;
    const distance = Math.hypot(point.x - from.x, point.y - from.y);
    if (distance < MIN_PREVIEW_DISTANCE) return;
    this.drawSegment(from, point, brush);
    this.lastPoint = point;
    if (!brush.eraser) {
      this.drawSegmentToViewport(from, point, brush);
      return;
    }
    this.requestRender();
  }

  endStroke(): void {
    this.lastPoint = null;
    this.interactionActive = false;
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
    ctx.fillStyle = this.options.map === "space" ? "#030711" : "#cbd8d2";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    const view = this.getVisibleWorldRect();
    this.drawWorldLayer(this.worldBackgroundCanvas, view);

    if (!this.interactionActive) {
      ctx.save();
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -this.camera.x * dpr * zoom, -this.camera.y * dpr * zoom);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      this.clipWorldViewport(ctx, view);
      this.worldRenderer.paintDynamic(ctx, this.camera, performance.now());
      ctx.restore();
    }

    this.drawWorldLayer(this.baseCanvas, view);
    this.drawWorldLayer(this.strokeCanvas, view);
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
      if (this.destroyed || this.interactionActive) return;
      this.requestRender();
    }, WORLD_ANIMATION_INTERVAL);
  }

  private getVisibleWorldRect(): { sourceX: number; sourceY: number; sourceWidth: number; sourceHeight: number; destX: number; destY: number; destWidth: number; destHeight: number } {
    const zoom = this.camera.zoom;
    const visibleWidth = this.cssWidth / zoom;
    const visibleHeight = this.cssHeight / zoom;
    const sourceWidth = Math.min(this.options.worldWidth, visibleWidth);
    const sourceHeight = Math.min(this.options.worldHeight, visibleHeight);
    const sourceX = visibleWidth >= this.options.worldWidth ? 0 : Math.max(0, Math.min(this.camera.x, this.options.worldWidth - sourceWidth));
    const sourceY = visibleHeight >= this.options.worldHeight ? 0 : Math.max(0, Math.min(this.camera.y, this.options.worldHeight - sourceHeight));
    const destWidth = sourceWidth * zoom;
    const destHeight = sourceHeight * zoom;
    return { sourceX, sourceY, sourceWidth, sourceHeight, destX: (this.cssWidth - destWidth) / 2, destY: (this.cssHeight - destHeight) / 2, destWidth, destHeight };
  }

  private drawWorldLayer(canvas: HTMLCanvasElement, view: ReturnType<DrawingSurface["getVisibleWorldRect"]>): void {
    const ctx = this.viewportContext;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(canvas, view.sourceX, view.sourceY, view.sourceWidth, view.sourceHeight, view.destX, view.destY, view.destWidth, view.destHeight);
  }

  private clipWorldViewport(ctx: CanvasRenderingContext2D, view: ReturnType<DrawingSurface["getVisibleWorldRect"]>): void {
    ctx.beginPath();
    ctx.rect(view.sourceX, view.sourceY, view.sourceWidth, view.sourceHeight);
    ctx.clip();
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

  private drawDotToViewport(point: Point, brush: Brush): void {
    const ctx = this.viewportContext;
    ctx.setTransform(this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom, -this.camera.x * this.dpr * this.camera.zoom, -this.camera.y * this.dpr * this.camera.zoom);
    this.configureBrush(ctx, brush);
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(brush.size / 2, 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    ctx.setTransform(this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom, -this.camera.x * this.dpr * this.camera.zoom, -this.camera.y * this.dpr * this.camera.zoom);
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
