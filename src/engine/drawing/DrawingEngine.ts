import type { Camera } from "../camera/Camera";
import type { Pointer } from "../input/Pointer";
import type { Renderer } from "../render/Renderer";
import type { Point } from "../types/Point";

export class DrawingEngine {
  private isDrawing = false;
  private lastPoint: Point | null = null;

  constructor(
    private readonly camera: Camera,
    private readonly renderer: Renderer,
    pointer?: Pointer
  ) {
    void pointer;
  }

  startDrawing(
    point: Point,
    color?: string,
    size?: number,
    isEraser?: boolean
  ): void {
    this.isDrawing = true;
    this.lastPoint = point;

    if (
      color === undefined ||
      size === undefined
    ) {
      return;
    }

    if (isEraser) {
      this.renderer.erase(
        point,
        point,
        size
      );
    } else {
      this.renderer.drawDot(
        point,
        size / 2,
        color
      );
    }

    this.render();
  }

  draw(
    point: Point,
    color: string,
    size: number,
    isEraser: boolean
  ): void {
    if (
      !this.isDrawing ||
      this.lastPoint === null
    ) {
      return;
    }

    if (isEraser) {
      this.renderer.erase(
        this.lastPoint,
        point,
        size
      );
    } else {
      this.renderer.beginPath();

      this.renderer.moveTo(
        this.lastPoint
      );

      this.renderer.lineTo(
        point
      );

      this.renderer.stroke(
        color,
        size
      );
    }

    this.lastPoint = point;

    this.render();
  }

  endDrawing(): void {
    this.isDrawing = false;
    this.lastPoint = null;
  }

  clear(): void {
    this.renderer.clear();
    this.render();
  }

  drawImage(
    image: CanvasImageSource,
    x = 0,
    y = 0
  ): void {
    this.renderer.drawImage(
      image,
      x,
      y
    );

    this.render();
  }

  render(): void {
    this.renderer.render(
      this.camera
    );
  }

  getCamera(): Camera {
    return this.camera;
  }

  reset(): void {
    this.isDrawing = false;
    this.lastPoint = null;

    this.camera.reset();

    this.render();
  }
}