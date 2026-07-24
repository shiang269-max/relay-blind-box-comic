export class Camera {
  constructor(
    public x = 0,
    public y = 0,
    public scale = 1
  ) {}

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  move(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  zoom(scale: number) {
    this.scale = scale;
  }
}