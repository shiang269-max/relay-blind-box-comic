import { useEffect, useRef } from "react";
import { Camera } from "../engine2/Camera";
import { CameraController } from "../engine2/CameraController";
import { DrawingEngine } from "../engine2/DrawingEngine";
import { Pointer } from "../engine2/Pointer";
import { Renderer } from "../engine2/Renderer";

export default function Engine2Test() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const camera = new Camera();
    const renderer = new Renderer(ctx);
    const pointer = new Pointer();

    new CameraController(camera);

    engineRef.current = new DrawingEngine(
      camera,
      renderer,
      pointer
    );
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !engineRef.current) return;

    const point = Pointer.getCanvasPosition(
      e.nativeEvent,
      canvasRef.current
    );

    engineRef.current.startDrawing(point);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !engineRef.current) return;

    const point = Pointer.getCanvasPosition(
      e.nativeEvent,
      canvasRef.current
    );

    engineRef.current.draw(
      point,
      "#000000",
      5,
      false
    );
  };

  const handlePointerUp = () => {
    engineRef.current?.endDrawing();
  };

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={1000}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        border: "1px solid #ccc",
        touchAction: "none",
      }}
    />
  );
}