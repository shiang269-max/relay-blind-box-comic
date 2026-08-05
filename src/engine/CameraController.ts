import { Camera } from "./Camera";

export class CameraController {
  private camera: Camera;
  private container: HTMLDivElement | null = null;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(camera: Camera, canvasWidth: number, canvasHeight: number) {
    this.camera = camera;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  public setContainer(container: HTMLDivElement | null) {
    this.container = container;
  }

  public get cameraState() {
    return this.camera;
  }

  public handleScroll() {
    if (!this.container) return;

    this.camera.setPosition(
      this.container.scrollLeft,
      this.container.scrollTop
    );
  }

  public initializeCameraPosition() {
    if (!this.container) return;

    this.container.scrollLeft =
      (this.container.scrollWidth - this.container.clientWidth) / 2;

    this.container.scrollTop =
      (this.container.scrollHeight - this.container.clientHeight) / 2;

    this.updateCamera();
  }

  private clampScroll() {
    if (!this.container) return;

    const maxScrollLeft = Math.max(
      0,
      this.container.scrollWidth - this.container.clientWidth
    );

    const maxScrollTop = Math.max(
      0,
      this.container.scrollHeight - this.container.clientHeight
    );

    this.container.scrollLeft = Math.max(
      0,
      Math.min(this.container.scrollLeft, maxScrollLeft)
    );

    this.container.scrollTop = Math.max(
      0,
      Math.min(this.container.scrollTop, maxScrollTop)
    );
  }

  private updateCamera() {
    if (!this.container) return;

    this.clampScroll();

    this.camera.setPosition(
      this.container.scrollLeft,
      this.container.scrollTop
    );
  }

  public handleZoom(
    e: WheelEvent,
    setZoom: React.Dispatch<React.SetStateAction<number>>
  ) {
    if (!e.ctrlKey || !this.container) return;

    e.preventDefault();

    setZoom((z) => {
      const next =
        e.deltaY < 0
          ? Math.min(z + 0.1, 3)
          : Math.max(z - 0.1, 0.2);

      const oldZoom = z;

      const mouseX =
        e.clientX - this.container!.getBoundingClientRect().left;
      const mouseY =
        e.clientY - this.container!.getBoundingClientRect().top;

      const worldX =
        (this.container!.scrollLeft + mouseX) / oldZoom;
      const worldY =
        (this.container!.scrollTop + mouseY) / oldZoom;

      requestAnimationFrame(() => {
        const maxScrollLeft =
          this.canvasWidth * next - this.container!.clientWidth;

        const maxScrollTop =
          this.canvasHeight * next - this.container!.clientHeight;

        this.container!.scrollLeft = Math.max(
          0,
          Math.min(worldX * next - mouseX, maxScrollLeft)
        );

        this.container!.scrollTop = Math.max(
          0,
          Math.min(worldY * next - mouseY, maxScrollTop)
        );

        this.updateCamera();
      });

      this.camera.setZoom(next);

      return next;
    });
  }

  public startMoveMode(
    e: React.PointerEvent<HTMLCanvasElement>,
    lastScrollPos: React.MutableRefObject<{
      x: number;
      y: number;
    } | null>
  ) {
    if (!this.container) return;

    lastScrollPos.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  public endMoveMode(
    lastScrollPos: React.MutableRefObject<{
      x: number;
      y: number;
    } | null>
  ) {
    lastScrollPos.current = null;
  }

  public handleMoveMode(
    e: React.PointerEvent<HTMLCanvasElement>,
    lastScrollPos: React.MutableRefObject<{
      x: number;
      y: number;
    } | null>
  ) {
    if (!this.container || !lastScrollPos.current) return;

    const dx = e.clientX - lastScrollPos.current.x;
    const dy = e.clientY - lastScrollPos.current.y;

    this.container.scrollLeft -= dx;
    this.container.scrollTop -= dy;

    this.updateCamera();

    lastScrollPos.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }
}