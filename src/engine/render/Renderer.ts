import type { Camera } from "../camera/Camera";
import type { Point } from "../types/Point";

export class Renderer {
  private readonly drawingCanvas: HTMLCanvasElement;
  private readonly drawingContext: CanvasRenderingContext2D;

  constructor(
    private readonly viewportContext: CanvasRenderingContext2D,
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {
    this.drawingCanvas =
      viewportContext.canvas.ownerDocument.createElement(
        "canvas"
      );

    this.drawingCanvas.width =
      worldWidth;

    this.drawingCanvas.height =
      worldHeight;

    const context =
      this.drawingCanvas.getContext("2d");

    if (!context) {
      throw new Error(
        "無法建立世界畫布 Context"
      );
    }

    this.drawingContext = context;
  }

  clear(): void {
    this.drawingContext.clearRect(
      0,
      0,
      this.worldWidth,
      this.worldHeight
    );
  }

  beginPath(): void {
    this.drawingContext.beginPath();
  }

  moveTo(point: Point): void {
    this.drawingContext.moveTo(
      point.x,
      point.y
    );
  }

  lineTo(point: Point): void {
    this.drawingContext.lineTo(
      point.x,
      point.y
    );
  }

  stroke(
    color: string,
    width: number
  ): void {
    this.drawingContext.strokeStyle =
      color;

    this.drawingContext.lineWidth =
      width;

    this.drawingContext.lineCap =
      "round";

    this.drawingContext.lineJoin =
      "round";

    this.drawingContext.stroke();
  }

  drawDot(
    point: Point,
    radius: number,
    color: string
  ): void {
    this.drawingContext.beginPath();

    this.drawingContext.arc(
      point.x,
      point.y,
      radius,
      0,
      Math.PI * 2
    );

    this.drawingContext.fillStyle =
      color;

    this.drawingContext.fill();
  }

  erase(
    from: Point,
    to: Point,
    size: number
  ): void {
    this.drawingContext.save();

    this.drawingContext.globalCompositeOperation =
      "destination-out";

    this.drawingContext.beginPath();

    this.drawingContext.moveTo(
      from.x,
      from.y
    );

    this.drawingContext.lineTo(
      to.x,
      to.y
    );

    this.drawingContext.lineWidth =
      size;

    this.drawingContext.lineCap =
      "round";

    this.drawingContext.lineJoin =
      "round";

    this.drawingContext.stroke();

    this.drawingContext.restore();
  }

  drawImage(
    image: CanvasImageSource,
    x = 0,
    y = 0
  ): void {
    this.drawingContext.drawImage(
      image,
      x,
      y
    );
  }

  render(camera: Camera): void {
    const canvas =
      this.viewportContext.canvas;

    this.viewportContext.save();

    this.viewportContext.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    this.viewportContext.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    this.viewportContext.setTransform(
      camera.zoom,
      0,
      0,
      camera.zoom,
      -camera.x * camera.zoom,
      -camera.y * camera.zoom
    );

    this.viewportContext.drawImage(
      this.drawingCanvas,
      0,
      0
    );

    this.viewportContext.restore();
  }

  renderTo(
    context: CanvasRenderingContext2D,
    backgroundColor: string
  ): void {
    context.save();

    context.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    context.fillStyle =
      backgroundColor;

    context.fillRect(
      0,
      0,
      context.canvas.width,
      context.canvas.height
    );

    context.drawImage(
      this.drawingCanvas,
      0,
      0
    );

    context.restore();
  }

  getWorldCanvas(): HTMLCanvasElement {
    return this.drawingCanvas;
  }

  getWorldWidth(): number {
    return this.worldWidth;
  }

  getWorldHeight(): number {
    return this.worldHeight;
  }
}