import { Camera, type Point } from "./Camera";
import type { Stroke } from "./Stroke";
import type { MapType, TimeOfDay } from "../domain";

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
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private lastPoint: Point | null = null;
  private renderFrame: number | null = null;

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
   * Paint the actual world surface once. It stays in the existing transformed
   * world layer, so zoom/pan continue to work exactly as before and pointer
   * handling never touches this artwork.
   */
  private paintWorldBackground(): void {
    const ctx = this.worldBackgroundContext;
    const width = this.options.worldWidth;
    const height = this.options.worldHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    if (this.options.map === "space") {
      this.paintSpaceSurface(ctx, width, height);
    } else {
      this.paintEarthSurface(ctx, width, height);
    }

    ctx.restore();
  }

  private paintEarthSurface(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const time = this.options.time;
    const palette = time === "night"
      ? ["rgba(13,31,46,.72)", "rgba(26,55,67,.62)", "rgba(7,20,28,.78)"]
      : time === "dusk"
        ? ["rgba(72,74,83,.62)", "rgba(117,77,78,.54)", "rgba(28,42,49,.74)"]
        : ["rgba(47,84,83,.54)", "rgba(70,111,101,.48)", "rgba(25,49,53,.72)"];

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, palette[0]);
    sky.addColorStop(.48, palette[1]);
    sky.addColorStop(1, palette[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const light = ctx.createRadialGradient(width * .78, height * .14, 0, width * .78, height * .14, width * .52);
    light.addColorStop(0, time === "dusk" ? "rgba(255,181,120,.28)" : "rgba(255,231,166,.24)");
    light.addColorStop(.35, "rgba(255,255,255,.055)");
    light.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);

    // A restrained paper/paint grain. It is deterministic, so it costs nothing
    // during pointer movement and does not flicker between renders.
    const grain = ctx.createRadialGradient(width * .5, height * .42, width * .08, width * .5, height * .42, width * .8);
    grain.addColorStop(0, "rgba(255,255,255,.025)");
    grain.addColorStop(.72, "rgba(255,255,255,0)");
    grain.addColorStop(1, "rgba(0,0,0,.22)");
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);

    const horizon = height * .68;
    this.drawMountainLayer(ctx, width, height, horizon + height * .015, "rgba(24,53,55,.54)", .09, .17, 0.5);
    this.drawMountainLayer(ctx, width, height, horizon + height * .07, "rgba(18,45,48,.66)", .13, .24, 1.8);
    this.drawMountainLayer(ctx, width, height, horizon + height * .15, "rgba(11,32,35,.78)", .18, .32, 3.1);

    const ground = ctx.createLinearGradient(0, horizon + height * .08, 0, height);
    ground.addColorStop(0, "rgba(19,49,47,.48)");
    ground.addColorStop(.5, "rgba(8,31,31,.68)");
    ground.addColorStop(1, "rgba(3,16,20,.84)");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);

    ctx.strokeStyle = "rgba(165,215,190,.12)";
    ctx.lineWidth = Math.max(8, width * .002);
    for (let i = 0; i < 8; i += 1) {
      const y = horizon + height * (.09 + i * .075);
      ctx.beginPath();
      ctx.moveTo(width * (.08 + (i % 2) * .12), y);
      ctx.bezierCurveTo(width * .34, y - height * .035, width * .66, y + height * .025, width * .94, y - height * .02);
      ctx.stroke();
    }

    // A large foreground silhouette gives the world a deliberate visual anchor.
    ctx.fillStyle = "rgba(4,22,25,.82)";
    for (let i = 0; i < 12; i += 1) {
      const x = width * (0.035 + i * .085);
      const h = height * (.055 + (i % 3) * .022);
      this.drawTree(ctx, x, height, h, width * .022);
    }

    const edge = ctx.createRadialGradient(width / 2, height / 2, width * .28, width / 2, height / 2, width * .82);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(.76, "rgba(0,0,0,.03)");
    edge.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }

  private paintSpaceSurface(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const time = this.options.time;
    const sky = ctx.createRadialGradient(width * .27, height * .48, 0, width * .27, height * .48, width * .82);
    sky.addColorStop(0, time === "dusk" ? "rgba(67,40,107,.88)" : "rgba(34,48,104,.86)");
    sky.addColorStop(.36, "rgba(11,21,53,.9)");
    sky.addColorStop(.72, "rgba(4,8,24,.96)");
    sky.addColorStop(1, "rgba(1,3,9,.99)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const nebula = ctx.createRadialGradient(width * .25, height * .55, 0, width * .25, height * .55, width * .62);
    nebula.addColorStop(0, "rgba(104,87,226,.18)");
    nebula.addColorStop(.35, "rgba(38,151,204,.08)");
    nebula.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    this.paintStars(ctx, width, height, 420);

    const planetX = width * .78;
    const planetY = height * .19;
    const radius = Math.min(width, height) * .18;
    const glow = ctx.createRadialGradient(planetX, planetY, radius * .55, planetX, planetY, radius * 2.1);
    glow.addColorStop(0, "rgba(82,193,244,.16)");
    glow.addColorStop(1, "rgba(82,193,244,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(planetX, planetY);
    ctx.rotate(-0.12);
    ctx.strokeStyle = "rgba(185,220,244,.28)";
    ctx.lineWidth = Math.max(8, radius * .055);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.72, radius * .42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const planet = ctx.createRadialGradient(planetX - radius * .35, planetY - radius * .42, radius * .04, planetX, planetY, radius);
    planet.addColorStop(0, "rgba(229,250,255,.96)");
    planet.addColorStop(.12, "rgba(100,205,240,.94)");
    planet.addColorStop(.42, "rgba(30,126,177,.96)");
    planet.addColorStop(.75, "rgba(12,51,103,.98)");
    planet.addColorStop(1, "rgba(1,7,22,1)");
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(planetX, planetY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(planetX, planetY, radius * .99, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(184,229,255,.13)";
    ctx.lineWidth = Math.max(7, radius * .045);
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse(planetX, planetY + i * radius * .22, radius * .9, radius * .1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const edge = ctx.createRadialGradient(width / 2, height / 2, width * .25, width / 2, height / 2, width * .86);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(.72, "rgba(0,0,0,.03)");
    edge.addColorStop(1, "rgba(0,0,0,.34)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }

  private drawMountainLayer(ctx: CanvasRenderingContext2D, width: number, height: number, baseY: number, color: string, min: number, max: number, seed: number): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseY + height * .12);
    for (let i = 0; i <= 12; i += 1) {
      const x = width * (i / 12);
      const wave = Math.sin(i * 1.73 + seed) * (max - min) + min;
      const y = baseY - height * (.08 + wave);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number, width: number): void {
    ctx.fillRect(x - width * .08, baseY - height * .12, width * .16, height * .14);
    for (let i = 0; i < 3; i += 1) {
      const y = baseY - height * (.25 + i * .27);
      ctx.beginPath();
      ctx.moveTo(x, y - height * .3);
      ctx.lineTo(x - width * (.72 - i * .1), y + height * .16);
      ctx.lineTo(x + width * (.72 - i * .1), y + height * .16);
      ctx.closePath();
      ctx.fill();
    }
  }

  private paintStars(ctx: CanvasRenderingContext2D, width: number, height: number, count: number): void {
    let seed = 9137;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    ctx.save();
    for (let index = 0; index < count; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = .7 + random() * 2.2;
      const alpha = .18 + random() * .7;
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
