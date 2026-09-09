import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";
import type { MapType, TimeOfDay } from "../domain";
import "../visuals/worldCamera.css";

export interface Brush { color: string; size: number; eraser: boolean; }
export interface SurfaceOptions { worldWidth: number; worldHeight: number; map: MapType; time: TimeOfDay; }
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
  private readonly atmosphereRoot: HTMLElement | null;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private lastPoint: Point | null = null;
  private renderFrame: number | null = null;
  private syncedCamera = { x: Number.NaN, y: Number.NaN, zoom: Number.NaN };

  constructor(private readonly viewportCanvas: HTMLCanvasElement, private readonly options: SurfaceOptions) {
    const context = viewportCanvas.getContext("2d");
    if (!context) throw new Error("無法建立 viewport context");
    this.viewportContext = context;
    this.atmosphereRoot = document.querySelector<HTMLElement>(".game-atmosphere--overlay");
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
    this.cancelRender();
    this.cssWidth = Math.max(1, Math.round(cssWidth));
    this.cssHeight = Math.max(1, Math.round(cssHeight));
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
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
    this.requestRender();
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
    this.cancelRender();
    this.syncAtmosphereCamera();
    const ctx = this.viewportContext;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.setTransform(
      this.dpr * this.camera.zoom,
      0,
      0,
      this.dpr * this.camera.zoom,
      -this.camera.x * this.dpr * this.camera.zoom,
      -this.camera.y * this.dpr * this.camera.zoom,
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(this.worldBackgroundCanvas, 0, 0);
    ctx.drawImage(this.baseCanvas, 0, 0);
    ctx.drawImage(this.strokeCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private syncAtmosphereCamera(): void {
    if (!this.atmosphereRoot) return;
    const { x, y, zoom } = this.camera;
    if (x === this.syncedCamera.x && y === this.syncedCamera.y && zoom === this.syncedCamera.zoom) return;
    this.syncedCamera = { x, y, zoom };
    this.atmosphereRoot.style.setProperty("--camera-zoom", `${zoom}`);
    this.atmosphereRoot.style.setProperty("--camera-tx", `${-x * zoom}px`);
    this.atmosphereRoot.style.setProperty("--camera-ty", `${-y * zoom}px`);
  }

  private requestRender(): void {
    if (this.renderFrame !== null) return;
    this.renderFrame = window.requestAnimationFrame(() => {
      this.renderFrame = null;
      this.render();
    });
  }

  private cancelRender(): void {
    if (this.renderFrame === null) return;
    window.cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
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

  /**
   * The animated world atmosphere owns the visual background. Keep this
   * layer transparent so it can move independently without entering the
   * interactive drawing render path.
   */
  private paintWorldBackground(): void {
    this.worldBackgroundContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight);
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
    this.strokeContext.save();
    this.strokeContext.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    this.strokeContext.strokeStyle = brush.color;
    this.strokeContext.lineWidth = brush.size;
    this.strokeContext.lineCap = "round";
    this.strokeContext.lineJoin = "round";
    this.strokeContext.beginPath();
    this.strokeContext.moveTo(from.x, from.y);
    this.strokeContext.lineTo(to.x, to.y);
    this.strokeContext.stroke();
    this.strokeContext.restore();
  }

  private drawDot(point: Point, brush: Brush): void {
    this.strokeContext.save();
    this.strokeContext.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over";
    this.strokeContext.fillStyle = brush.color;
    this.strokeContext.beginPath();
    this.strokeContext.arc(point.x, point.y, Math.max(brush.size / 2, 0.5), 0, Math.PI * 2);
    this.strokeContext.fill();
    this.strokeContext.restore();
  }
}
