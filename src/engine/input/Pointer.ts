import type { Camera } from "../camera/Camera";
import type { Point } from "../types/Point";

export class Pointer {
  static getCanvasPosition(
    event: PointerEvent,
    canvas: HTMLCanvasElement
  ): Point {
    const rect =
      canvas.getBoundingClientRect();

    const scaleX =
      rect.width > 0
        ? canvas.width / rect.width
        : 1;

    const scaleY =
      rect.height > 0
        ? canvas.height / rect.height
        : 1;

    return {
      x:
        (event.clientX - rect.left) *
        scaleX,

      y:
        (event.clientY - rect.top) *
        scaleY,
    };
  }

  static getWorldPosition(
    event: PointerEvent,
    canvas: HTMLCanvasElement,
    camera: Camera
  ): Point {
    const screenPoint =
      this.getCanvasPosition(
        event,
        canvas
      );

    return camera.screenToWorld(
      screenPoint
    );
  }

  static getScreenPosition(
    event: PointerEvent,
    canvas: HTMLCanvasElement
  ): Point {
    return this.getCanvasPosition(
      event,
      canvas
    );
  }

  static distance(
    a: Point,
    b: Point
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    return Math.sqrt(
      dx * dx +
      dy * dy
    );
  }

  static midpoint(
    a: Point,
    b: Point
  ): Point {
    return {
      x:
        (a.x + b.x) / 2,

      y:
        (a.y + b.y) / 2,
    };
  }
}
