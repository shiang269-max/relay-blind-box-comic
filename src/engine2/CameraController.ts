import type { Camera } from "./Camera";
import type { Point } from "./Coordinate";

export class CameraController {
  private lastMovePoint: Point | null = null;

  constructor(
    private readonly camera: Camera
  ) {}

  pan(
    dx: number,
    dy: number
  ): void {
    this.camera.move(dx, dy);
  }

  zoom(
    factor: number
  ): void {
    this.camera.setZoom(
      this.camera.zoom * factor
    );
  }

  zoomAt(point: Point, factor: number): void {
    this.camera.zoomToWorldPoint(point, factor);
  }

  startMove(point: Point): void {
    this.lastMovePoint = point;
  }

  move(point: Point): void {
    if (!this.lastMovePoint) {
      return;
    }

    const previousX = this.camera.x;
    const previousY = this.camera.y;
    this.camera.move(
      this.lastMovePoint.x - point.x,
      this.lastMovePoint.y - point.y
    );
    this.lastMovePoint = {
      x: point.x + this.camera.x - previousX,
      y: point.y + this.camera.y - previousY,
    };
  }

  endMove(): void {
    this.lastMovePoint = null;
  }

  reset(): void {
    this.camera.reset();
  }

  getCamera(): Camera {
    return this.camera;
  }
}
