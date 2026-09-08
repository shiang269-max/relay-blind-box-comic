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

  constructor(private readonly viewportCanvas: HTMLCanvasElement, private readonly options: SurfaceOptions) {
    const context = viewportCanvas.getContext("2d"); if (!context) throw new Error("無法建立 viewport context");
    this.viewportContext = context;
    this.worldBackgroundCanvas = this.createWorldCanvas(); const bg = this.worldBackgroundCanvas.getContext("2d"); if (!bg) throw new Error("無法建立世界背景 context"); this.worldBackgroundContext = bg;
    this.baseCanvas = this.createWorldCanvas(); const base = this.baseCanvas.getContext("2d"); if (!base) throw new Error("無法建立 base context"); this.baseContext = base;
    this.strokeCanvas = this.createWorldCanvas(); const stroke = this.strokeCanvas.getContext("2d"); if (!stroke) throw new Error("無法建立 stroke context"); this.strokeContext = stroke;
    this.paintWorldBackground();
    this.camera = new Camera({ width: options.worldWidth, height: options.worldHeight });
  }
  resize(cssWidth: number, cssHeight: number): void { this.cssWidth = Math.max(1, Math.round(cssWidth)); this.cssHeight = Math.max(1, Math.round(cssHeight)); this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2)); this.viewportCanvas.width = Math.round(this.cssWidth * this.dpr); this.viewportCanvas.height = Math.round(this.cssHeight * this.dpr); this.viewportCanvas.style.width = `${this.cssWidth}px`; this.viewportCanvas.style.height = `${this.cssHeight}px`; this.camera.setViewport(this.cssWidth, this.cssHeight); this.render(); }
  eventToScreen(event: PointerEvent | WheelEvent): Point { const rect = this.viewportCanvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * this.cssWidth / Math.max(1, rect.width), y: (event.clientY - rect.top) * this.cssHeight / Math.max(1, rect.height) }; }
  eventToWorld(event: PointerEvent): Point { return this.camera.screenToWorld(this.eventToScreen(event)); }
  startStroke(point: Point, brush: Brush): boolean { if (!this.camera.isInsideWorld(point)) return false; this.lastPoint = point; this.drawDot(point, brush); this.render(); return true; }
  continueStroke(point: Point, brush: Brush): void { if (!this.lastPoint) return; this.drawSegment(this.lastPoint, point, brush); this.lastPoint = point; this.render(); }
  endStroke(): void { this.lastPoint = null; }
  clear(): void { this.endStroke(); this.strokeContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight); this.render(); }
  redraw(strokes: readonly Stroke[]): void { this.endStroke(); this.strokeContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight); for (const stroke of strokes) this.drawStroke(stroke); this.render(); }
  async loadImage(source: string): Promise<void> { const image = new Image(); image.decoding = "async"; await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("上一頁圖片載入失敗")); image.src = source; }); this.endStroke(); this.baseContext.clearRect(0, 0, this.options.worldWidth, this.options.worldHeight); this.baseContext.drawImage(image, 0, 0, this.options.worldWidth, this.options.worldHeight); this.render(); }
  render(): void { const ctx = this.viewportContext; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.cssWidth, this.cssHeight); ctx.setTransform(this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom, -this.camera.x * this.dpr * this.camera.zoom, -this.camera.y * this.dpr * this.camera.zoom); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "medium"; ctx.drawImage(this.worldBackgroundCanvas, 0, 0); ctx.drawImage(this.baseCanvas, 0, 0); ctx.drawImage(this.strokeCanvas, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
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
  exportPng(): string { this.endStroke(); const scale = Math.min(1, EXPORT_MAX_WIDTH / this.options.worldWidth, EXPORT_MAX_HEIGHT / this.options.worldHeight); const width = Math.max(1, Math.round(this.options.worldWidth * scale)); const height = Math.max(1, Math.round(this.options.worldHeight * scale)); const output = document.createElement("canvas"); output.width = width; output.height = height; const ctx = output.getContext("2d"); if (!ctx) throw new Error("無法建立輸出畫布"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.clearRect(0, 0, width, height); ctx.drawImage(this.baseCanvas, 0, 0, width, height); ctx.drawImage(this.strokeCanvas, 0, 0, width, height); return output.toDataURL("image/png"); }
  private createWorldCanvas(): HTMLCanvasElement { const canvas = document.createElement("canvas"); canvas.width = this.options.worldWidth; canvas.height = this.options.worldHeight; return canvas; }
  private paintWorldBackground(): void {
    const ctx = this.worldBackgroundContext;
    const { worldWidth: width, worldHeight: height, map, time } = this.options;
    ctx.clearRect(0, 0, width, height);
    const colors = this.getWorldColors();
    const sky = ctx.createLinearGradient(0, 0, width, height);
    sky.addColorStop(0, colors.top); sky.addColorStop(0.45, colors.middle); sky.addColorStop(1, colors.bottom);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    if (map === "earth") this.paintEarthBackground(ctx, width, height, time);
    else this.paintSpaceBackground(ctx, width, height, time);
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.1, width * 0.5, height * 0.5, Math.max(width, height) * 0.82);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(2,6,23,0.32)"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  }
  private paintEarthBackground(ctx: CanvasRenderingContext2D, width: number, height: number, time: TimeOfDay): void {
    const sunX = width * 0.18, sunY = height * 0.18, sunRadius = Math.min(width, height) * 0.07;
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 2.8);
    sun.addColorStop(0, "rgba(255,252,220,.95)"); sun.addColorStop(.25, "rgba(255,230,150,.5)"); sun.addColorStop(1, "rgba(255,210,120,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, width, height);
    const radius = Math.max(width, height) * 0.44, centerX = width * 0.5, centerY = height * 1.02;
    const planet = ctx.createRadialGradient(centerX - radius * 0.18, centerY - radius * 0.72, radius * 0.02, centerX, centerY, radius);
    planet.addColorStop(0, time === "night" ? "rgba(80,145,210,.7)" : "rgba(185,238,255,.9)"); planet.addColorStop(.28, time === "dusk" ? "rgba(22,105,120,.98)" : "rgba(14,126,151,.98)"); planet.addColorStop(.68, "rgba(7,48,72,.99)"); planet.addColorStop(1, "rgba(2,6,23,1)");
    ctx.fillStyle = planet; ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(centerX, centerY, radius * .998, 0, Math.PI * 2); ctx.clip();
    const land = (points: Point[]) => { ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y); ctx.closePath(); ctx.fill(); };
    ctx.fillStyle = time === "night" ? "rgba(48,105,72,.65)" : "rgba(76,145,83,.86)";
    land([{x:width*.25,y:height*.75},{x:width*.31,y:height*.67},{x:width*.39,y:height*.7},{x:width*.43,y:height*.79},{x:width*.36,y:height*.86},{x:width*.27,y:height*.84}]);
    land([{x:width*.57,y:height*.64},{x:width*.65,y:height*.6},{x:width*.73,y:height*.66},{x:width*.7,y:height*.76},{x:width*.61,y:height*.8},{x:width*.55,y:height*.73}]);
    land([{x:width*.77,y:height*.82},{x:width*.84,y:height*.77},{x:width*.91,y:height*.82},{x:width*.87,y:height*.9},{x:width*.79,y:height*.92}]);
    ctx.fillStyle = "rgba(255,255,255,.16)"; for (let i = 0; i < 7; i += 1) { const cloudX = width * (.16 + i * .12), cloudY = height * (.34 + (i % 3) * .06); ctx.beginPath(); ctx.ellipse(cloudX, cloudY, width*.075, height*.018, -.08, 0, Math.PI*2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = "rgba(180,235,255,.35)"; ctx.lineWidth = Math.max(10, radius*.018); ctx.beginPath(); ctx.arc(centerX, centerY, radius*.99, Math.PI*1.02, Math.PI*1.98); ctx.stroke();
  }
  private paintSpaceBackground(ctx: CanvasRenderingContext2D, width: number, height: number, time: TimeOfDay): void {
    const nebula = ctx.createRadialGradient(width*.28, height*.48, 0, width*.28, height*.48, width*.72);
    nebula.addColorStop(0, time === "night" ? "rgba(67,56,202,.32)" : "rgba(99,102,241,.28)"); nebula.addColorStop(.5, "rgba(14,165,233,.1)"); nebula.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = nebula; ctx.fillRect(0,0,width,height);
    this.paintStars(ctx, width, height, 320);
    const radius = Math.max(width, height) * .19, centerX = width*.78, centerY = height*.15;
    const planet = ctx.createRadialGradient(centerX-radius*.3, centerY-radius*.35, radius*.02, centerX, centerY, radius);
    planet.addColorStop(0,"#e0f2fe"); planet.addColorStop(.1,"#38bdf8"); planet.addColorStop(.45,"#0369a1"); planet.addColorStop(1,"#020617"); ctx.fillStyle=planet; ctx.beginPath(); ctx.arc(centerX,centerY,radius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(186,230,253,.35)"; ctx.lineWidth=Math.max(8,radius*.035); ctx.beginPath(); ctx.ellipse(centerX,centerY,radius*1.55,radius*.36,-.2,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,.22)"; for(let i=0;i<35;i+=1){ const x=(i*197)%width, y=(i*331)%height; ctx.beginPath(); ctx.arc(x,y,1.5+(i%3),0,Math.PI*2); ctx.fill(); }
  }
  private getWorldColors(): { top: string; middle: string; bottom: string } { const { map, time } = this.options; if (map === "space") { if (time === "day") return { top: "#132d5c", middle: "#091a38", bottom: "#02040c" }; if (time === "dusk") return { top: "#4c1d68", middle: "#24123f", bottom: "#08040e" }; return { top: "#101827", middle: "#030712", bottom: "#000000" }; } if (time === "day") return { top: "#79d8f7", middle: "#36b9e8", bottom: "#12305a" }; if (time === "dusk") return { top: "#fff0b7", middle: "#fb8b4a", bottom: "#30256e" }; return { top: "#14275a", middle: "#1d1949", bottom: "#020617" }; }
  private paintStars(ctx: CanvasRenderingContext2D, width: number, height: number, count: number): void { let seed = this.options.map === "space" ? 9137 : 4219; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; }; ctx.save(); for (let index = 0; index < count; index += 1) { const x = random() * width, y = random() * height, radius = 0.7 + random() * 2.2, alpha = 0.18 + random() * 0.7; ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  private drawStroke(stroke: Stroke): void { const [first, ...rest] = stroke.points; if (!first) return; this.drawDot(first, stroke.brush); let previous = first; for (const point of rest) { this.drawSegment(previous, point, stroke.brush); previous = point; } }
  private drawSegment(from: Point, to: Point, brush: Brush): void { this.strokeContext.save(); this.strokeContext.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over"; this.strokeContext.strokeStyle = brush.color; this.strokeContext.lineWidth = brush.size; this.strokeContext.lineCap = "round"; this.strokeContext.lineJoin = "round"; this.strokeContext.beginPath(); this.strokeContext.moveTo(from.x, from.y); this.strokeContext.lineTo(to.x, to.y); this.strokeContext.stroke(); this.strokeContext.restore(); }
  private drawDot(point: Point, brush: Brush): void { this.strokeContext.save(); this.strokeContext.globalCompositeOperation = brush.eraser ? "destination-out" : "source-over"; this.strokeContext.fillStyle = brush.color; this.strokeContext.beginPath(); this.strokeContext.arc(point.x, point.y, brush.size / 2, 0, Math.PI * 2); this.strokeContext.fill(); this.strokeContext.restore(); }
}
