import { useEffect, useRef } from "react";
import { Camera } from "../engine2/Camera";
import { DrawingEngine } from "../engine2/DrawingEngine";
import { Pointer } from "../engine2/Pointer";
import { Renderer } from "../engine2/Renderer";

export default function Engine2Test() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const camera = new Camera();
    const renderer = new Renderer(context);
    const pointer = new Pointer();

    new DrawingEngine(camera, renderer, pointer);

    // 測試 Renderer
    renderer.drawDot(
      { x: 200, y: 200 },
      20,
      "red"
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