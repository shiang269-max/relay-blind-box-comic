import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Palette,
  Minus,
  Plus,
  Eraser,
  Check,
  Flag,
} from "lucide-react";
import {
  getTimeOfDay,
  type MapType,
  type TimeOfDay,
} from "../lib/gameTypes";

import { Camera } from "../engine/camera/Camera";
import { CameraController } from "../engine/camera/CameraController";
import { DrawingEngine } from "../engine/drawing/DrawingEngine";
import { Pointer } from "../engine/input/Pointer";
import { Renderer } from "../engine/render/Renderer";

const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 5000;

interface DrawingPageProps {
  round: number;
  totalRounds: number;
  map: MapType;
  playerName: string;
  onSubmit: (dataUrl: string) => void;
  prevPageUrl: string | null;
  onDevReview: () => void;
}

const COLORS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#6b7280",
  "#92400e",
  "#1e3a5f",
  "#fde68a",
  "#bbf7d0",
];

function getCanvasBgColor(map: MapType, time: TimeOfDay): string {
  if (map === "earth") {
    if (time === "day") return "#bfefff";
    if (time === "dusk") return "#ffd580";
    return "#1a2744";
  }

  if (time === "day") return "#0d1b4b";
  if (time === "dusk") return "#2d0a3e";
  return "#050a14";
}

function getHeaderColors(map: MapType, time: TimeOfDay) {
  if (map === "earth") {
    if (time === "day") {
      return { bg: "rgba(14,116,144,0.85)", text: "#ffffff" };
    }
    if (time === "dusk") {
      return { bg: "rgba(154,52,18,0.85)", text: "#ffffff" };
    }
    return { bg: "rgba(15,23,42,0.90)", text: "#e2e8f0" };
  }

  if (time === "day") {
    return { bg: "rgba(13,27,75,0.90)", text: "#c7d2fe" };
  }
  if (time === "dusk") {
    return { bg: "rgba(45,10,62,0.90)", text: "#f0abfc" };
  }
  return { bg: "rgba(5,10,20,0.95)", text: "#94a3b8" };
}

export default function DrawingPage({
  round,
  totalRounds,
  map,
  playerName,
  onSubmit,
  prevPageUrl,
  onDevReview,
}: DrawingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(new Camera(CANVAS_WIDTH, CANVAS_HEIGHT));
  const cameraControllerRef = useRef(
    new CameraController(cameraRef.current)
  );
  const rendererRef = useRef<Renderer | null>(null);
  const drawingEngineRef = useRef<DrawingEngine | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [showPrev, setShowPrev] = useState(false);
  const [moveMode, setMoveMode] = useState(false);

  const timeOfDay = getTimeOfDay(round);
  const canvasBg = getCanvasBgColor(map, timeOfDay);
  const headerColors = getHeaderColors(map, timeOfDay);

  const getScreenPos = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return Pointer.getScreenPosition(e.nativeEvent, canvas);
    },
    []
  );

  const getWorldPos = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return Pointer.getWorldPosition(
        e.nativeEvent,
        canvas,
        cameraRef.current
      );
    },
    []
  );

  const render = useCallback(() => {
    drawingEngineRef.current?.render();
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    canvas.width = width;
    canvas.height = height;

    cameraRef.current.setViewport(width, height);
    render();
  }, [render]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!rendererRef.current || !drawingEngineRef.current) {
      const renderer = new Renderer(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      rendererRef.current = renderer;
      drawingEngineRef.current = new DrawingEngine(
        cameraRef.current,
        renderer
      );
    }

    resizeCanvas();
  }, [resizeCanvas]);

  useEffect(() => {
    initCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [initCanvas, resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };

    canvas.addEventListener("wheel", preventBrowserZoom, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("wheel", preventBrowserZoom);
    };
  }, []);

  useEffect(() => {
    const engine = drawingEngineRef.current;
    if (!engine) return;

    if (prevPageUrl) {
      const image = new Image();
      image.onload = () => {
        drawingEngineRef.current?.drawImage(image, 0, 0);
      };
      image.src = prevPageUrl;
      return;
    }

    engine.clear();
  }, [prevPageUrl]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const canvas = e.currentTarget;
      canvas.setPointerCapture(e.pointerId);

      if (moveMode) {
        const screenPoint = getScreenPos(e);
        if (!screenPoint) return;
        cameraControllerRef.current.startMove(screenPoint);
        return;
      }

      const worldPoint = getWorldPos(e);
      if (!worldPoint) return;

      setIsDrawing(true);
      drawingEngineRef.current?.startDrawing(
        worldPoint,
        color,
        brushSize,
        isEraser
      );
    },
    [moveMode, getScreenPos, getWorldPos, color, brushSize, isEraser]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      if (moveMode) {
        const screenPoint = getScreenPos(e);
        if (!screenPoint) return;

        cameraControllerRef.current.move(screenPoint);
        render();
        return;
      }

      if (!isDrawing) return;

      const worldPoint = getWorldPos(e);
      if (!worldPoint) return;

      drawingEngineRef.current?.draw(
        worldPoint,
        color,
        brushSize,
        isEraser
      );
    },
    [
      moveMode,
      isDrawing,
      getScreenPos,
      getWorldPos,
      color,
      brushSize,
      isEraser,
      render,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const canvas = e.currentTarget;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (moveMode) {
        cameraControllerRef.current.endMove();
        return;
      }

      drawingEngineRef.current?.endDrawing();
      setIsDrawing(false);
    },
    [moveMode]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!e.ctrlKey) return;

      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const screenPoint = Pointer.getCanvasPosition(
        e.nativeEvent as unknown as PointerEvent,
        canvas
      );

      cameraControllerRef.current.zoomAt(
        screenPoint,
        e.deltaY < 0 ? 1.1 : 0.9
      );

      render();
    },
    [render]
  );

  const handleClear = useCallback(() => {
    drawingEngineRef.current?.clear();
  }, []);

  const handleSubmit = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const flat = document.createElement("canvas");
    flat.width = CANVAS_WIDTH;
    flat.height = CANVAS_HEIGHT;

    const context = flat.getContext("2d");
    if (!context) return;

    renderer.renderTo(context, canvasBg);
    onSubmit(flat.toDataURL("image/png"));
  }, [canvasBg, onSubmit]);

  const timeLabel =
    timeOfDay === "day"
      ? "白天"
      : timeOfDay === "dusk"
        ? "黃昏"
        : "夜晚";

  return (
    <div className="flex flex-col w-full h-screen" style={{ touchAction: "none" }}>
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0 backdrop-blur-sm"
        style={{
          background: headerColors.bg,
          color: headerColors.text,
          paddingTop: "calc(0.5rem + env(safe-area-inset-top))",
        }}
      >
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight truncate">{playerName} 的回合</div>
          <div className="text-xs opacity-70">第 {round}/{totalRounds} 頁 · {timeLabel}</div>
        </div>

        <div className="flex-1 mx-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white/70 rounded-full transition-all duration-500" style={{ width: `${(round / totalRounds) * 100}%` }} />
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          {prevPageUrl && (
            <button
              onPointerDown={() => setShowPrev(true)}
              onPointerUp={() => setShowPrev(false)}
              onPointerLeave={() => setShowPrev(false)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-white/25 bg-white/10 active:bg-white/20"
            >
              上頁
            </button>
          )}

          <button onClick={handleClear} className="text-xs px-2.5 py-1.5 rounded-lg border border-white/25 bg-white/10 active:bg-white/20">清除</button>
          <button onClick={handleSubmit} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-500 text-white font-semibold flex items-center gap-1 active:bg-green-400"><Check size={13} />送出</button>
          <button onClick={onDevReview} title="DEV: 直接查看成果" className="text-xs px-2 py-1.5 rounded-lg border border-white/25 bg-white/10">成果</button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ background: canvasBg }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        />

        {showPrev && prevPageUrl && (
          <img src={prevPageUrl} alt="上一頁" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-80" />
        )}
      </div>

      <div className="flex items-center gap-2 p-2 flex-shrink-0 overflow-x-auto bg-slate-950/85 text-white" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
        <button onClick={() => { setMoveMode((value) => !value); setIsEraser(false); }} className={`min-h-11 min-w-11 rounded-xl flex items-center justify-center ${moveMode ? "bg-blue-500" : "bg-white/10"}`} title="移動畫面"><Flag size={18} /></button>
        <button onClick={() => { setIsEraser((value) => !value); setMoveMode(false); }} className={`min-h-11 min-w-11 rounded-xl flex items-center justify-center ${isEraser ? "bg-orange-500" : "bg-white/10"}`} title="橡皮擦"><Eraser size={18} /></button>
        <button onClick={() => setBrushSize((value) => Math.max(1, value - 2))} className="min-h-11 min-w-10 rounded-xl bg-white/10"><Minus size={18} /></button>
        <span className="min-w-8 text-center text-sm">{brushSize}</span>
        <button onClick={() => setBrushSize((value) => Math.min(100, value + 2))} className="min-h-11 min-w-10 rounded-xl bg-white/10"><Plus size={18} /></button>
        <Palette size={18} />
        {COLORS.map((item) => (
          <button key={item} onClick={() => { setColor(item); setIsEraser(false); setMoveMode(false); }} className={`h-9 w-9 shrink-0 rounded-full border-2 ${color === item && !isEraser ? "border-white scale-110" : "border-white/25"}`} style={{ backgroundColor: item }} aria-label={`選擇顏色 ${item}`} />
        ))}
      </div>
    </div>
  );
}
