import type { Camera } from "./Camera";

interface Point {
  x: number;
  y: number;
}

export class Renderer {
  private readonly drawingCanvas: HTMLCanvasElement;
  private readonly drawingContext: CanvasRenderingContext2D;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    worldWidth = ctx.canvas.width,
    worldHeight = ctx.canvas.height
  ) {
    this.drawingCanvas = ctx.canvas.ownerDocument.createElement("canvas");
    this.drawingCanvas.width = worldWidth;
    this.drawingCanvas.height = worldHeight;
    this.drawingContext = this.drawingCanvas.getContext("2d")!;
  }

  clear(width: number, height: number): void {
    this.drawingContext.clearRect(0, 0, width, height);
  }

  beginPath(): void {
    this.drawingContext.beginPath();
  }

  moveTo(point: Point): void {
    this.drawingContext.moveTo(point.x, point.y);
  }

  lineTo(point: Point): void {
    this.drawingContext.lineTo(point.x, point.y);
  }

  drawDot(point: Point, radius: number, color: string): void {
    this.drawingContext.beginPath();
    this.drawingContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.drawingContext.fillStyle = color;
    this.drawingContext.fill();
  }

  stroke(color: string, width: number): void {
    this.drawingContext.strokeStyle = color;
    this.drawingContext.lineWidth = width;
    this.drawingContext.lineCap = "round";
    this.drawingContext.lineJoin = "round";
    this.drawingContext.stroke();
  }

  erase(from: Point, to: Point, size: number): void {
    this.drawingContext.save();
    this.drawingContext.globalCompositeOperation = "destination-out";
    this.drawingContext.beginPath();
    this.drawingContext.moveTo(from.x, from.y);
    this.drawingContext.lineTo(to.x, to.y);
    this.drawingContext.lineWidth = size;
    this.drawingContext.lineCap = "round";
    this.drawingContext.stroke();
    this.drawingContext.restore();
  }

  drawImage(image: CanvasImageSource, x: number, y: number): void {
    this.drawingContext.drawImage(image, x, y);
  }

  render(camera: Camera): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.setTransform(
      camera.zoom,
      0,
      0,
      camera.zoom,
      -camera.x * camera.zoom,
      -camera.y * camera.zoom
    );
    this.ctx.drawImage(this.drawingCanvas, 0, 0);
    this.ctx.restore();
  }

  renderTo(
    context: CanvasRenderingContext2D,
    backgroundColor: string
  ): void {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(this.drawingCanvas, 0, 0);
    context.restore();
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
