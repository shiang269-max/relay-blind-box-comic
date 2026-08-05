interface Point {
  x: number;
  y: number;
}

export class Renderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  clear(width: number, height: number): void {
    this.ctx.clearRect(0, 0, width, height);
  }

  beginPath(): void {
    this.ctx.beginPath();
  }

  moveTo(point: Point): void {
    this.ctx.moveTo(point.x, point.y);
  }

  lineTo(point: Point): void {
    this.ctx.lineTo(point.x, point.y);
  }

  drawDot(point: Point, radius: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  stroke(color: string, width: number): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.stroke();
  }

  erase(from: Point, to: Point, size: number): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.lineWidth = size;
    this.ctx.lineCap = "round";
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawImage(image: CanvasImageSource, x: number, y: number): void {
    this.ctx.drawImage(image, x, y);
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
