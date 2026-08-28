import { Camera } from "./Camera";
import { Renderer } from "./Renderer";
import { Pointer } from "./Pointer";
import type { Point } from "./Coordinate";

export class DrawingEngine {
  private isDrawing = false;
  private lastPoint: Point | null = null;

  constructor(
    private readonly camera: Camera,
    private readonly renderer: Renderer,
    private readonly pointer: Pointer
  ) {
    void this.pointer;
  }

  // ===== Drawing =====

  startDrawing(point: Point): void {
    this.isDrawing = true;
    this.lastPoint = point;
  }

  draw(
    point: Point,
    color: string,
    size: number,
    isEraser: boolean
  ): void {
    if (!this.isDrawing || this.lastPoint === null) {
      return;
    }

    if (isEraser) {
      this.renderer.erase(this.lastPoint, point, size);
    } else {
      this.renderer.beginPath();
      this.renderer.moveTo(this.lastPoint);
      this.renderer.lineTo(point);
      this.renderer.stroke(color, size);
    }

    this.lastPoint = point;
    this.render();
  }

  endDrawing(): void {
    this.isDrawing = false;
    this.lastPoint = null;
  }

  clear(
    width: number,
    height: number
  ): void {
    this.renderer.clear(width, height);
    this.render();
  }

  drawImage(image: CanvasImageSource, x: number, y: number): void {
    this.renderer.drawImage(image, x, y);
    this.render();
  }

  render(): void {
    this.renderer.render(this.camera);
  }

  // ===== Camera =====

  getCamera(): Camera {
    return this.camera;
  }

  // ===== State =====

  reset(): void {
    this.isDrawing = false;
    this.lastPoint = null;
    this.camera.reset();
    this.render();
  }
}
