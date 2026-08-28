import type { Point } from "./Coordinate";

export class Camera {
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(
    public x = 0,
    public y = 0,
    public zoom = 1,
    private readonly worldWidth = 3000,
    private readonly worldHeight = 5000
  ) {}

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.zoom = this.clampZoom(this.zoom);
    this.clampPosition();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.clampPosition();
  }

  move(dx: number, dy: number): void {
    this.setPosition(this.x + dx, this.y + dy);
  }

  setZoom(zoom: number): void {
    this.zoom = this.clampZoom(zoom);
    this.clampPosition();
  }

  screenToWorld(point: Point): Point {
    return {
      x: point.x / this.zoom + this.x,
      y: point.y / this.zoom + this.y,
    };
  }

  worldToScreen(point: Point): Point {
    return {
      x: (point.x - this.x) * this.zoom,
      y: (point.y - this.y) * this.zoom,
    };
  }

  zoomToWorldPoint(point: Point, factor: number): void {
    const screen = this.worldToScreen(point);
    this.setZoom(this.zoom * factor);
    this.setPosition(
      point.x - screen.x / this.zoom,
      point.y - screen.y / this.zoom
    );
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.setZoom(1);
  }

  private clampZoom(zoom: number): number {
    return Math.max(this.minimumZoom(), Math.min(10, zoom));
  }

  private minimumZoom(): number {
    if (this.viewportWidth === 0 || this.viewportHeight === 0) {
      return 0.2;
    }

    return Math.min(
      this.viewportWidth / this.worldWidth,
      this.viewportHeight / this.worldHeight
    );
  }

  private clampPosition(): void {
    const visibleWidth = this.viewportWidth / this.zoom;
    const visibleHeight = this.viewportHeight / this.zoom;

    this.x = Math.max(0, Math.min(this.x, this.worldWidth - visibleWidth));
    this.y = Math.max(0, Math.min(this.y, this.worldHeight - visibleHeight));
  }
}
