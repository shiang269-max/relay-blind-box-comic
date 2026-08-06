import { Point } from "./Coordinate";

export class Pointer {
  static getCanvasPosition(
    e: PointerEvent,
    canvas: HTMLCanvasElement
  ): Point {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  static getScreenPosition(
    e: PointerEvent
  ): Point {
    return {
      x: e.clientX,
      y: e.clientY,
    };
  }

  static distance(
    a: Point,
    b: Point
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  static midpoint(
    a: Point,
    b: Point
  ): Point {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }
}