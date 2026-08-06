import { Camera } from "./Camera";
import { Point } from "./Coordinate";

export class CameraController {
  constructor(
    private readonly camera: Camera
  ) {}

  pan(delta: Point): void {
    this.camera.move(
      delta.x,
      delta.y
    );
  }

  zoom(
    zoom: number
  ): void {
    this.camera.setZoom(zoom);
  }

  reset(): void {
    this.camera.reset();
  }

  getCamera(): Camera {
    return this.camera;
  }
}