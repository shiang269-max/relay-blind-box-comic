import type { Point } from "../types/Point";

export class Camera {
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(
    private readonly worldWidth = 3000,
    private readonly worldHeight = 5000,
    public x = 0,
    public y = 0,
    public zoom = 1
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
    this.setPosition(
      this.x + dx,
      this.y + dy
    );
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

  zoomAtScreenPoint(
    screenPoint: Point,
    factor: number
  ): void {
    const worldPoint = this.screenToWorld(screenPoint);

    this.setZoom(this.zoom * factor);

    this.setPosition(
      worldPoint.x - screenPoint.x / this.zoom,
      worldPoint.y - screenPoint.y / this.zoom
    );
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = this.minimumZoom();

    this.clampPosition();
  }

  getWorldWidth(): number {
    return this.worldWidth;
  }

  getWorldHeight(): number {
    return this.worldHeight;
  }

  getViewportWidth(): number {
    return this.viewportWidth;
  }

  getViewportHeight(): number {
    return this.viewportHeight;
  }

  private clampZoom(zoom: number): number {
    return Math.max(
      this.minimumZoom(),
      Math.min(10, zoom)
    );
  }

  private minimumZoom(): number {
    if (
      this.viewportWidth === 0 ||
      this.viewportHeight === 0
    ) {
      return 0.2;
    }

    return Math.min(
      this.viewportWidth / this.worldWidth,
      this.viewportHeight / this.worldHeight
    );
  }

  private clampPosition(): void {
    if (
      this.viewportWidth === 0 ||
      this.viewportHeight === 0
    ) {
      return;
    }

    const visibleWidth =
      this.viewportWidth / this.zoom;

    const visibleHeight =
      this.viewportHeight / this.zoom;

    const maxX = Math.max(
      0,
      this.worldWidth - visibleWidth
    );

    const maxY = Math.max(
      0,
      this.worldHeight - visibleHeight
    );

    this.x = Math.max(
      0,
      Math.min(this.x, maxX)
    );

    this.y = Math.max(
      0,
      Math.min(this.y, maxY)
    );
  }
}