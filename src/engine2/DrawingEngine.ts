import { Camera } from "./Camera";
import { Renderer } from "./Renderer";
import { Pointer } from "./Pointer";

export class DrawingEngine {
  constructor(
    private readonly camera: Camera,
    private readonly renderer: Renderer,
    private readonly pointer: Pointer
  ) {}

  // ===== Drawing =====

  startDrawing(): void {}

  draw(): void {}

  endDrawing(): void {}

  clear(): void {}

  // ===== Camera =====

  setZoom(_zoom: number): void {}

  moveCamera(_dx: number, _dy: number): void {}

  // ===== State =====

  reset(): void {}
}