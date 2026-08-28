import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";
import type { MapType, TimeOfDay } from "../domain";

export interface Brush {
  color: string;
  size: number;
  eraser: boolean;
}

export interface SurfaceOptions {
  worldWidth: number;
  worldHeight: number;
  map: MapType;
  time: TimeOfDay;
}

/**
 * 唯一負責畫布座標、世界像素與渲染的 Surface。
 *
 * worldBackground 只負責目前遊戲世界的視覺，不會被寫進接力圖片。
 * baseCanvas + strokeCanvas 才是需要跨回合傳遞與保存的漫畫內容。
 */
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
  private lastPoint: Point | null = null;

  constructor(
    private readonly viewportCanvas: HTMLCanvasElement,
    private readonly options: SurfaceOptions
  ) {
    const context = viewportCanvas.getContext("2d");
    if (!context) throw new Error("無法建立 viewport context");
    this.viewportContext = context;

    this.worldBackgroundCanvas = document.createElement("canvas");
    this.worldBackgroundCanvas.width = options.worldWidth;
    this.worldBackgroundCanvas.height = options.worldHeight;
    const worldBackgroundContext = this.worldBackgroundCanvas.getContext("2d");
    if (!worldBackgroundContext) throw new Error("無法建立世界背景 context");
    this.worldBackgroundContext = worldBackgroundContext;

    this.baseCanvas = document.createElement("canvas");
    this.baseCanvas.width = options.worldWidth;
    this.baseCanvas.height = options.worldHeight;
    const baseContext = this.baseCanvas.getContext("2d");
    if (!baseContext) throw new Error("無法建立 base context");
    this.baseContext = baseContext;

    this.strokeCanvas = document.createElement("canvas");
    this.strokeCanvas.width = options.worldWidth;
    this.strokeCanvas.height = options.worldHeight;
    const strokeContext = this.strokeCanvas.getContext("2d");
    if (!strokeContext) throw new Error("無法建立 stroke context");
    this.strokeContext = strokeContext;

    this.paintWorldBackground();
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
    const ctx = this.viewportContext;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.setTransform(
      this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom,
      -this.camera.x * this.dpr * this.camera.zoom,
      -this.camera.y * this.dpr * this.camera.zoom
    );
    ctx.drawImage(this.worldBackgroundCanvas, 0, 0);
    ctx.drawImage(this.baseCanvas, 0, 0);
    ctx.drawImage(this.strokeCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * 接力圖片只保存漫畫內容，背景由目前世界即時渲染。
   * 這避免上一頁把舊時間的背景烘焙進圖片，造成換時段後出現色塊或看似被清除。
   */
  exportPng(): string {
    this.endStroke();
    const output = document.createElement("canvas");
    output.width = this.options.worldWidth;
    output.height = this.options.worldHeight;
    const ctx = output.getContext("2d");
    if (!ctx) throw new Error("無法建立輸出畫布");
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.drawImage(this.baseCanvas, 0, 0);
    ctx.drawImage(this.strokeCanvas, 0, 0);
    return output.toDataURL("image/png");
  }

  private paintWorldBackground(): void {
    const ctx = this.worldBackgroundContext;
    const { worldWidth: width, worldHeight: height, map, time } = this.options;

    ctx.clearRect(0, 0, width, height);

    const colors = this.getWorldColors();
    const sky = ctx.createLinearGradient(0, 0, width, height);
    sky.addColorStop(0, colors.top);
    sky.addColorStop(0.45, colors.middle);
    sky.addColorStop(1, colors.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (time === "dusk") {
      const haze = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.max(width, height) * 0.7);
      haze.addColorStop(0, "rgba(255,240,210,0.38)");
      haze.addColorStop(1, "rgba(255,170,100,0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);
    }

    if (map === "space" || time === "night") {
      this.paintStars(ctx, width, height, map === "space" ? 260 : 140);
    } else {
      this.paintStars(ctx, width, height, 90);
    }

    if (map === "earth") {
      const radius = Math.max(width, height) * 0.44;
      const centerX = width * 0.5;
      const centerY = height * 1.02;
      const planet = ctx.createRadialGradient(centerX - radius * 0.18, centerY - radius * 0.72, radius * 0.02, centerX, centerY, radius);
      planet.addColorStop(0, time === "night" ? "rgba(90,150,210,0.62)" : "rgba(180,235,255,0.78)");
      planet.addColorStop(0.28, time === "dusk" ? "rgba(22,110,125,0.95)" : "rgba(16,125,150,0.96)");
      planet.addColorStop(0.66, "rgba(8,48,73,0.98)");
      planet.addColorStop(1, "rgba(2,6,23,1)");
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const radius = Math.max(width, height) * 0.22;
      const centerX = width * 0.77;
      const centerY = height * 0.14;
      const planet = ctx.createRadialGradient(centerX - radius * 0.25, centerY - radius * 0.3, radius * 0.02, centerX, centerY, radius);
      planet.addColorStop(0, "#e0f2fe");
      planet.addColorStop(0.1, "#38bdf8");
      planet.addColorStop(0.45, "#0369a1");
      planet.addColorStop(1, "#020617");
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.1, width * 0.5, height * 0.5, Math.max(width, height) * 0.8);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(2,6,23,0.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private getWorldColors(): { top: string; middle: string; bottom: string } {
    const { map, time } = this.options;

    if (map === "space") {
      if (time === "day") return { top: "#0f274f", middle: "#08152f", bottom: "#030712" };
      if (time === "dusk") return { top: "#4c1d5f", middle: "#21123d", bottom: "#090611" };
      return { top: "#111827", middle: "#030712", bottom: "#000000" };
    }

    if (time === "day") return { top: "#7dd3fc", middle: "#38bdf8", bottom: "#172554" };
    if (time === "dusk") return { top: "#fef3c7", middle: "#fb7185", bottom: "#312e81" };
    return { top: "#172554", middle: "#1e1b4b", bottom: "#020617" };
  }

  private paintStars(ctx: CanvasRenderingContext2D, width: number, height: number, count: number): void {
    let seed = this.options.map === "space" ? 9137 : 4219;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    ctx.save();
    for (let index = 0; index < count; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 0.7 + random() * 2.2;
      const alpha = 0.18 + random() * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
    this.strokeContext.arc(point.x, point.y, brush.size / 2, 0, Math.PI * 2);
    this.strokeContext.fill();
    this.strokeContext.restore();
  }
}