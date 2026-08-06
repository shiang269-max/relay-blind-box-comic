import { useEffect, useRef } from "react";
import { Camera } from "../engine2/Camera";
import { DrawingEngine } from "../engine2/DrawingEngine";
import { Pointer } from "../engine2/Pointer";
import { Renderer } from "../engine2/Renderer";

export default function Engine2Test() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const camera = new Camera();
    const renderer = new Renderer(context);
    const pointer = new Pointer();

    engineRef.current = new DrawingEngine(
      camera,
      renderer,
      pointer
    );
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={1000}
      style={{
        border: "1px solid #ccc",
      }}
    />
  );
}