export interface Point {
  x: number;
  y: number;
}

export class Coordinate {
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
