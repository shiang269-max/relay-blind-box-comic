import { Camera } from "./Camera";
import { Renderer } from "./Renderer";
import { Pointer } from "./Pointer";
import { Point } from "./Coordinate";

export class DrawingEngine {
  constructor(
    private readonly camera: Camera,
    private readonly renderer: Renderer,
    private readonly pointer: Pointer
  ) {}

  // ===== Drawing =====

  startDrawing(point: Point): void {}

  draw(
    point: Point,
    color: string,
    size: number,
    isEraser: boolean
  ): void {}

  endDrawing(): void {}

  clear(
    width: number,
    height: number
  ): void {}

  // ===== Camera =====

  getCamera(): Camera {
    return this.camera;
  }

  // ===== State =====

  reset(): void {}
}