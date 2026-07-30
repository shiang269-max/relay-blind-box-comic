import { Camera } from './Camera';

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
    return { x: this.camera.x, y: this.camera.y, scale: this.camera.scale };
  }

  public handleScroll() {
    if (this.container) {
      this.camera.x = this.container.scrollLeft;
      this.camera.y = this.container.scrollTop;
    }
  }

  public initializeCameraPosition() {
    if (this.container) {
      this.container.scrollLeft = (this.container.scrollWidth - this.container.clientWidth) / 2;
      this.container.scrollTop = (this.container.scrollHeight - this.container.clientHeight) / 2;
      this.handleScroll(); // Update camera position after initial scroll
    }
  }

  public handleZoom(e: WheelEvent, setZoom: React.Dispatch<React.SetStateAction<number>>) {
    if (!e.ctrlKey || !this.container) return;

    e.preventDefault();

    setZoom((z) => {
      const next = e.deltaY < 0 ? Math.min(z + 0.1, 3) : Math.max(z - 0.1, 0.2);
      const oldZoom = z;

      const mouseX = e.clientX - this.container!.getBoundingClientRect().left;
      const mouseY = e.clientY - this.container!.getBoundingClientRect().top;

      const worldX = (this.container!.scrollLeft + mouseX) / oldZoom;
      const worldY = (this.container!.scrollTop + mouseY) / oldZoom;

      requestAnimationFrame(() => {
        const maxScrollLeft = this.canvasWidth * next - this.container!.clientWidth;
        const maxScrollTop = this.canvasHeight * next - this.container!.clientHeight;

        this.container!.scrollLeft = Math.max(
          0,
          Math.min(worldX * next - mouseX, maxScrollLeft)
        );
        this.container!.scrollTop = Math.max(
          0,
          Math.min(worldY * next - mouseY, maxScrollTop)
        );
      });

      this.camera.zoom(next);
      return next;
    });
  }

  public startMoveMode(
    e: React.PointerEvent<HTMLCanvasElement>,
    lastScrollPos: React.MutableRefObject<{ x: number; y: number } | null>
  ) {
    if (!this.container) return;

    lastScrollPos.current = { x: e.clientX, y: e.clientY };
  }

  public endMoveMode(
    lastScrollPos: React.MutableRefObject<{ x: number; y: number } | null>
  ) {
    lastScrollPos.current = null;
  }

  public handleMoveMode(e: React.PointerEvent<HTMLCanvasElement>, lastScrollPos: React.MutableRefObject<{ x: number; y: number } | null>) {
    if (!this.container || !lastScrollPos.current) return;

    const dx = e.clientX - lastScrollPos.current.x;
    const dy = e.clientY - lastScrollPos.current.y;

    this.container.scrollLeft -= dx;
    this.container.scrollTop -= dy;

    this.handleScroll(); // Update camera position

    lastScrollPos.current = { x: e.clientX, y: e.clientY };
  }
}
