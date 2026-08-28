import type { Camera } from "./Camera";
import type { Point } from "../types/Point";

export class CameraController {
  private lastMovePoint: Point | null = null;

  constructor(
    private readonly camera: Camera
  ) {}

  startMove(point: Point): void {
    this.lastMovePoint = point;
  }

  move(point: Point): void {
    if (!this.lastMovePoint) {
      return;
    }

    const dx =
      this.lastMovePoint.x - point.x;

    const dy =
      this.lastMovePoint.y - point.y;

    const previousX = this.camera.x;
    const previousY = this.camera.y;

    this.camera.move(dx, dy);

    this.lastMovePoint = {
      x:
        point.x +
        this.camera.x -
        previousX,

      y:
        point.y +
        this.camera.y -
        previousY,
    };
  }

  endMove(): void {
    this.lastMovePoint = null;
  }

  pan(dx: number, dy: number): void {
    this.camera.move(dx, dy);
  }

  zoom(factor: number): void {
    this.camera.setZoom(
      this.camera.zoom * factor
    );
  }

  zoomAt(
    screenPoint: Point,
    factor: number
  ): void {
    this.camera.zoomAtScreenPoint(
      screenPoint,
      factor
    );
  }

  reset(): void {
    this.lastMovePoint = null;
    this.camera.reset();
  }

  getCamera(): Camera {
    return this.camera;
  }
}