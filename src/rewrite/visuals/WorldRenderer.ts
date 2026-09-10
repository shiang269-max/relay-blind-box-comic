import type { MapType } from "../domain";
import type { Camera } from "../drawing/Camera";

const TAU = Math.PI * 2;
const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 2400;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgba(r: number, g: number, b: number, a = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

function smoothstep(t: number): number {
  const value = clamp(t, 0, 1);
  return value * value * (3 - 2 * value);
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WorldRendererOptions {
  map: MapType;
  progress: number;
}

/**
 * The world is rendered once into the cached world canvas. Animation is deliberately
 * drawn as a handful of world-space objects on the existing viewport canvas, so the
 * player never pays for another 1800x2400 animation surface.
 */
export class WorldRenderer {
  private readonly map: MapType;
  private readonly progress: number;
  private animationStart = performance.now();

  constructor(options: WorldRendererOptions) {
    this.map = options.map;
    this.progress = clamp(options.progress, 0, 1);
  }

  paintStatic(ctx: CanvasRenderingContext2D, width = WORLD_WIDTH, height = WORLD_HEIGHT): void {
    ctx.clearRect(0, 0, width, height);
    if (this.map === "earth") this.paintEarth(ctx, width, height);
    else this.paintSpace(ctx, width, height);
  }

  paintDynamic(ctx: CanvasRenderingContext2D, _camera: Camera, now: number): void {
    const elapsed = (now - this.animationStart) / 1000;
    if (this.map === "earth") this.paintEarthMotion(ctx, elapsed);
    else this.paintSpaceMotion(ctx, elapsed);
  }

  private paintEarth(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const p = smoothstep(this.progress);
    const night = smoothstep((p - 0.64) / 0.36);
    const dusk = smoothstep(1 - Math.abs(p - 0.58) / 0.18);

    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.72);
    sky.addColorStop(0, rgba(mix(184, 24, night), mix(222, 35, night), mix(241, 61, night)));
    sky.addColorStop(0.48, rgba(mix(224, 237, night), mix(235, 108, night), mix(222, 118, night)));
    sky.addColorStop(1, rgba(mix(246, 233, night), mix(202, 87, night), mix(171, 98, night)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (dusk > 0.01) {
      const duskGlow = ctx.createRadialGradient(width * 0.78, height * 0.43, 30, width * 0.78, height * 0.43, width * 0.48);
      duskGlow.addColorStop(0, rgba(255, 218, 166, 0.28 * dusk));
      duskGlow.addColorStop(1, rgba(255, 218, 166, 0));
      ctx.fillStyle = duskGlow;
      ctx.fillRect(0, 0, width, height * 0.72);
    }

    if (night > 0.02) this.paintEarthStars(ctx, width, height, night);

    this.drawMountainRange(ctx, width, height, 0.43, 0.06, rgba(99, 119, 119, 0.44 + night * 0.16), 17);
    this.drawMountainRange(ctx, width, height, 0.53, 0.09, rgba(73, 91, 84, 0.58 + night * 0.14), 31);
    this.drawMountainRange(ctx, width, height, 0.63, 0.075, rgba(48, 70, 62, 0.78 + night * 0.08), 73);

    const ground = ctx.createLinearGradient(0, height * 0.56, 0, height);
    ground.addColorStop(0, rgba(mix(117, 42, night), mix(139, 60, night), mix(111, 70, night)));
    ground.addColorStop(0.35, rgba(mix(94, 112, night), mix(122, 78, night), mix(86, 79, night)));
    ground.addColorStop(1, rgba(mix(64, 34, night), mix(89, 51, night), mix(62, 49, night)));
    ctx.fillStyle = ground;
    ctx.fillRect(0, height * 0.57, width, height * 0.43);

    ctx.fillStyle = rgba(237, 222, 177, 0.09 + dusk * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.bezierCurveTo(width * 0.22, height * 0.67, width * 0.38, height * 0.75, width * 0.58, height * 0.70);
    ctx.bezierCurveTo(width * 0.75, height * 0.66, width * 0.88, height * 0.73, width, height * 0.68);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    this.paintEarthTrees(ctx, width, height, night);
    this.paintEarthPath(ctx, width, height, night);

    const vignette = ctx.createRadialGradient(width / 2, height * 0.48, height * 0.16, width / 2, height * 0.48, height * 0.78);
    vignette.addColorStop(0, rgba(0, 0, 0, 0));
    vignette.addColorStop(1, rgba(17, 28, 27, 0.2 + night * 0.14));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private paintEarthStars(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number): void {
    const random = mulberry32(9182);
    ctx.save();
    ctx.fillStyle = rgba(244, 239, 220, 0.34 * strength);
    for (let i = 0; i < 42; i += 1) {
      const starX = random() * width;
      const starY = random() * height * 0.38;
      const r = 1.2 + random() * 1.5;
      ctx.beginPath();
      ctx.arc(starX, starY, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMountainRange(ctx: CanvasRenderingContext2D, width: number, height: number, baseline: number, amplitude: number, fill: string, seed: number): void {
    const random = mulberry32(seed);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, height * baseline);
    for (let i = 0; i <= 12; i += 1) {
      const peak = height * (baseline - amplitude * (0.55 + random() * 0.75));
      const nextX = width * ((i + 0.5) / 12);
      const nextPeak = height * (baseline - amplitude * (0.35 + random() * 0.65));
      ctx.quadraticCurveTo(nextX, peak, width * ((i + 1) / 12), nextPeak);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private paintEarthTrees(ctx: CanvasRenderingContext2D, width: number, height: number, night: number): void {
    const trees = [
      [0.08, 0.62, 0.72], [0.15, 0.59, 0.55], [0.25, 0.64, 0.42],
      [0.73, 0.61, 0.48], [0.82, 0.58, 0.68], [0.91, 0.64, 0.52],
    ];
    ctx.save();
    ctx.fillStyle = rgba(35, 57, 48, 0.82 + night * 0.1);
    for (const [xRatio, yRatio, scale] of trees) {
      const x = width * xRatio;
      const y = height * yRatio;
      const h = 180 * scale;
      ctx.fillRect(x - 7 * scale, y, 14 * scale, h * 0.34);
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.72);
      ctx.lineTo(x - h * 0.25, y - h * 0.25);
      ctx.lineTo(x - h * 0.17, y - h * 0.25);
      ctx.lineTo(x - h * 0.34, y + h * 0.02);
      ctx.lineTo(x + h * 0.34, y + h * 0.02);
      ctx.lineTo(x + h * 0.17, y - h * 0.25);
      ctx.lineTo(x + h * 0.25, y - h * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private paintEarthPath(ctx: CanvasRenderingContext2D, width: number, height: number, night: number): void {
    ctx.save();
    ctx.fillStyle = rgba(211, 188, 141, 0.17 - night * 0.05);
    ctx.beginPath();
    ctx.moveTo(width * 0.49, height);
    ctx.bezierCurveTo(width * 0.51, height * 0.87, width * 0.54, height * 0.74, width * 0.49, height * 0.61);
    ctx.bezierCurveTo(width * 0.47, height * 0.55, width * 0.48, height * 0.5, width * 0.5, height * 0.45);
    ctx.bezierCurveTo(width * 0.56, height * 0.58, width * 0.58, height * 0.76, width * 0.54, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private paintSpace(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const p = smoothstep(this.progress);
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, rgba(8, 14, 32));
    base.addColorStop(0.55, rgba(12, 18, 39));
    base.addColorStop(1, rgba(3, 7, 18));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const nebula = ctx.createRadialGradient(width * 0.2, height * 0.36, 20, width * 0.2, height * 0.36, width * 0.62);
    nebula.addColorStop(0, rgba(74, 116, 151, 0.14));
    nebula.addColorStop(0.48, rgba(48, 72, 113, 0.07));
    nebula.addColorStop(1, rgba(15, 24, 46, 0));
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    this.paintSpaceStars(ctx, width, height, p);
    this.paintPlanet(ctx, width, height, p);

    const edge = ctx.createRadialGradient(width / 2, height / 2, height * 0.18, width / 2, height / 2, height * 0.8);
    edge.addColorStop(0, rgba(0, 0, 0, 0));
    edge.addColorStop(1, rgba(0, 0, 8, 0.42));
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }

  private paintSpaceStars(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number): void {
    const random = mulberry32(4417);
    ctx.save();
    for (let i = 0; i < 118; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const depth = random();
      const radius = depth > 0.84 ? 2.4 : depth > 0.56 ? 1.6 : 1;
      const alpha = 0.26 + depth * 0.48;
      ctx.fillStyle = rgba(216 + progress * 25, 226 + progress * 12, 255, alpha);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private paintPlanet(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number): void {
    const x = width * 0.73;
    const y = height * 0.32;
    const radius = width * 0.145;
    const glow = ctx.createRadialGradient(x - radius * 0.18, y - radius * 0.18, radius * 0.15, x, y, radius * 1.55);
    glow.addColorStop(0, rgba(121, 177, 214, 0.16));
    glow.addColorStop(0.62, rgba(78, 117, 167, 0.07));
    glow.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius * 1.6, y - radius * 1.6, radius * 3.2, radius * 3.2);

    const planet = ctx.createRadialGradient(x - radius * 0.34, y - radius * 0.4, radius * 0.05, x, y, radius);
    planet.addColorStop(0, rgba(103, 159, 185));
    planet.addColorStop(0.55, rgba(55, 93, 121));
    planet.addColorStop(1, rgba(20, 36, 59));
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.985, 0, TAU);
    ctx.clip();
    ctx.fillStyle = rgba(177, 204, 201, 0.13 + progress * 0.04);
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.14, y - radius * 0.12, radius * 0.72, radius * 0.12, -0.22, 0, TAU);
    ctx.ellipse(x + radius * 0.2, y + radius * 0.26, radius * 0.56, radius * 0.1, 0.18, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = rgba(154, 193, 222, 0.24);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.34, radius * 0.36, -0.12, 0, TAU);
    ctx.stroke();
  }

  private paintEarthMotion(ctx: CanvasRenderingContext2D, elapsed: number): void {
    const drift = (elapsed * 10) % 2400;
    const clouds = [
      { x: 310, y: 360, scale: 1.05, speed: 1 },
      { x: 1040, y: 500, scale: 0.78, speed: 0.72 },
      { x: 1460, y: 290, scale: 0.58, speed: 0.48 },
    ];
    ctx.save();
    for (const cloud of clouds) {
      const x = ((cloud.x + drift * cloud.speed) % 2200) - 200;
      const y = cloud.y + Math.sin(elapsed * 0.18 + cloud.x) * 8;
      this.drawCloud(ctx, x, y, cloud.scale);
    }
    ctx.restore();
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.fillStyle = "rgba(255, 255, 250, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y, 88 * scale, 26 * scale, 0, 0, TAU);
    ctx.ellipse(x - 46 * scale, y + 3 * scale, 48 * scale, 22 * scale, 0, 0, TAU);
    ctx.ellipse(x + 42 * scale, y + 1 * scale, 56 * scale, 25 * scale, 0, 0, TAU);
    ctx.fill();
  }

  private paintSpaceMotion(ctx: CanvasRenderingContext2D, elapsed: number): void {
    const cycle = elapsed % 9;
    if (cycle > 2.1) return;
    const progress = cycle / 2.1;
    const x = -120 + progress * 2150;
    const y = 470 + progress * 780;
    ctx.save();
    ctx.globalAlpha = 0.52 * (1 - progress) * Math.min(1, progress * 4);
    ctx.strokeStyle = "rgba(222, 239, 255, 0.9)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 105, y - 38);
    ctx.stroke();
    ctx.restore();
  }
}
