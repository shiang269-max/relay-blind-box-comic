export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * 唯一 Camera：背景、上一頁內容與本回合筆劃共用同一世界座標。
 *
 * 縮小用於總覽，放大用於作畫；不再把低解析世界放大到 8 倍。
 */
export class Camera {
  private viewport: Size = { width: 1, height: 1 };
  private position: Point = { x: 0, y: 0 };
  private _zoom = 1;
  private initialized = false;

  constructor(
    private readonly world: Size,
    private readonly maxZoom = 2.5,
    private readonly initialZoom = 1
  ) {}

  get x(): number { return this.position.x; }
  get y(): number { return this.position.y; }
  get zoom(): number { return this._zoom; }
  get minimumZoom(): number { return this.fitZoom(); }
  get maximumZoom(): number { return Math.max(this.fitZoom(), this.maxZoom); }
  get viewportWidth(): number { return this.viewport.width; }
  get viewportHeight(): number { return this.viewport.height; }

  setViewport(width: number, height: number): void {
    const nextViewport = { width: Math.max(1, width), height: Math.max(1, height) };
    if (!this.initialized) {
      this.viewport = nextViewport;
      this.initialized = true;
      this.reset();
      return;
    }
    const oldCenter = this.screenToWorld({ x: this.viewport.width / 2, y: this.viewport.height / 2 });
    this.viewport = nextViewport;
    this._zoom = this.clampZoom(this._zoom);
    this.position = {
      x: oldCenter.x - this.viewport.width / (2 * this._zoom),
      y: oldCenter.y - this.viewport.height / (2 * this._zoom),
    };
    this.clamp();
  }

  fitToWorld(): void {
    this._zoom = this.fitZoom();
    this.centerOn({ x: this.world.width / 2, y: this.world.height / 2 });
  }

  reset(): void {
    this._zoom = this.clampZoom(this.initialZoom);
    this.centerOn({ x: this.world.width / 2, y: this.world.height / 2 });
  }

  setZoom(zoom: number): void {
    if (!Number.isFinite(zoom)) return;
    this._zoom = this.clampZoom(zoom);
    this.clamp();
  }

  setPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.position = { x, y };
    this.clamp();
  }

  panByScreen(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.setPosition(this.position.x - dx / this._zoom, this.position.y - dy / this._zoom);
  }

  zoomAt(screen: Point, factor: number): void {
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y) || !Number.isFinite(factor) || factor <= 0) return;
    const anchor = this.screenToWorld(screen);
    const nextZoom = this.clampZoom(this._zoom * factor);
    if (Math.abs(nextZoom - this._zoom) < 1e-9) return;
    this._zoom = nextZoom;
    this.position = { x: anchor.x - screen.x / this._zoom, y: anchor.y - screen.y / this._zoom };
    this.clamp();
  }

  screenToWorld(point: Point): Point {
    return { x: point.x / this._zoom + this.position.x, y: point.y / this._zoom + this.position.y };
  }

  worldToScreen(point: Point): Point {
    return { x: (point.x - this.position.x) * this._zoom, y: (point.y - this.position.y) * this._zoom };
  }

  isInsideWorld(point: Point): boolean {
    return point.x >= 0 && point.y >= 0 && point.x <= this.world.width && point.y <= this.world.height;
  }

  private centerOn(point: Point): void {
    this.position = {
      x: point.x - this.viewport.width / (2 * this._zoom),
      y: point.y - this.viewport.height / (2 * this._zoom),
    };
    this.clamp();
  }

  private fitZoom(): number {
    return Math.min(this.viewport.width / this.world.width, this.viewport.height / this.world.height);
  }

  private clampZoom(zoom: number): number {
    const minimum = this.fitZoom();
    const maximum = Math.max(minimum, this.maxZoom);
    return Math.max(minimum, Math.min(maximum, zoom));
  }

  private clamp(): void {
    const visibleWidth = this.viewport.width / this._zoom;
    const visibleHeight = this.viewport.height / this._zoom;
    if (visibleWidth >= this.world.width) this.position.x = (this.world.width - visibleWidth) / 2;
    else this.position.x = Math.max(0, Math.min(this.position.x, Math.max(0, this.world.width - visibleWidth)));
    if (visibleHeight >= this.world.height) this.position.y = (this.world.height - visibleHeight) / 2;
    else this.position.y = Math.max(0, Math.min(this.position.y, Math.max(0, this.world.height - visibleHeight)));
  }
}
