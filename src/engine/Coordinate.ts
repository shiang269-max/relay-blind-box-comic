export interface Point {
  x: number;
  y: number;
}

export class Coordinate {
  static screenToWorld(
    screen: Point,
    cameraX: number,
    cameraY: number,
    zoom: number
  ): Point {
    return {
      x: screen.x / zoom + cameraX,
      y: screen.y / zoom + cameraY,
    };
  }

  static worldToScreen(
    world: Point,
    cameraX: number,
    cameraY: number,
    zoom: number
  ): Point {
    return {
      x: (world.x - cameraX) * zoom,
      y: (world.y - cameraY) * zoom,
    };
  }

  static worldToCanvas(world: Point): Point {
    return {
      x: world.x,
      y: world.y,
    };
  }

  static canvasToWorld(canvas: Point): Point {
    return {
      x: canvas.x,
      y: canvas.y,
    };
  }

  static screenToCanvas(
    screen: Point,
    rect: DOMRect,
    canvasWidth: number,
    canvasHeight: number
  ): Point {
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    return {
      x: screen.x * scaleX,
      y: screen.y * scaleY,
    };
  }
}