export class Camera {
  constructor(
    public x = 0,
    public y = 0,
    public zoom = 1
  ) {}

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  }
}