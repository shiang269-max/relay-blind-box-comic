import { Camera } from "./Camera";

export class CameraController {
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

  reset(): void {
    this.camera.reset();
  }

  getCamera(): Camera {
    return this.camera;
  }
}