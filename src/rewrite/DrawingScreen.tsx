import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eraser, Minus, Move, Palette, Plus, RotateCcw } from "lucide-react";
import {
  getBackgroundColor,
  getTimeOfDay,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type MapType,
} from "./domain";
import type { GameMode } from "./game/GameMode";
import { DrawingSurface, type Brush } from "./drawing/DrawingSurface";

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface DrawingScreenProps {
  mode: GameMode;
  round: number;
  map: MapType;
  playerName: string;
  previousPage: string | null;
  onSubmit: (dataUrl: string) => Promise<void> | void;
}

export default function DrawingScreen({
  mode,
  round,
  map,
  playerName,
  previousPage,
  onSubmit,
}: DrawingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<DrawingSurface | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
  const panPoint = useRef<{ x: number; y: number } | null>(null);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(8);
  const [eraser, setEraser] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const time = getTimeOfDay(round);
  const background = getBackgroundColor(map, time);

  const brush = useCallback((): Brush => ({ color, size, eraser }), [color, size, eraser]);

  const resize = useCallback(() => {
    const element = containerRef.current;
    const surface = surfaceRef.current;
    if (!element || !surface) return;
    surface.resize(element.clientWidth, element.clientHeight);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const surface = new DrawingSurface(canvas, {
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      background,
    });
    surfaceRef.current = surface;
    resize();

    if (previousPage) {
      void surface.loadImage(previousPage);
    }

    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [background, previousPage, resize]);

  const getPinchDistance = () => {
    const points = [...activePointers.current.values()];
    if (points.length < 2) return null;
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);

    const surface = surfaceRef.current;
    if (!surface) return;
    const screen = surface.eventToScreen(event.nativeEvent);
    activePointers.current.set(event.pointerId, screen);

    if (activePointers.current.size >= 2) {
      surface.endStroke();
      setDrawing(false);
      pinchDistance.current = getPinchDistance();
      return;
    }

    if (moveMode) {
      panPoint.current = screen;
      return;
    }

    const world = surface.eventToWorld(event.nativeEvent);
    if (surface.startStroke(world, brush())) setDrawing(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;

    const screen = surface.eventToScreen(event.nativeEvent);
    if (activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, screen);
    }

    if (activePointers.current.size >= 2) {
      const next = getPinchDistance();
      const previous = pinchDistance.current;
      if (next && previous) {
        const factor = next / previous;
        const points = [...activePointers.current.values()];
        surface.camera.zoomAt({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, factor);
        surface.render();
      }
      pinchDistance.current = next;
      return;
    }

    if (moveMode) {
      if (panPoint.current) {
        surface.camera.panByScreen(screen.x - panPoint.current.x, screen.y - panPoint.current.y);
        panPoint.current = screen;
        surface.render();
      }
      return;
    }

    if (!drawing) return;
    surface.continueStroke(surface.eventToWorld(event.nativeEvent), brush());
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) pinchDistance.current = null;
    if (activePointers.current.size === 0) panPoint.current = null;
    surfaceRef.current?.endStroke();
    setDrawing(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;
    const screen = surface.eventToScreen(event.nativeEvent);
    surface.camera.zoomAt(screen, Math.exp(-event.deltaY * 0.0015));
    surface.render();
  };

  const handleSubmit = async () => {
    const surface = surfaceRef.current;
    if (!surface || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(surface.exportPng());
    } finally {
      setSubmitting(false);
    }
  };

  const progress = mode.totalRounds === null
    ? null
    : Math.min(100, (round / mode.totalRounds) * 100);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background }}>
      <header className="flex shrink-0 items-center gap-3 bg-black/30 px-3 py-2 text-white backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{playerName} 的回合</div>
          <div className="text-xs text-white/70">
            {mode.label} · {mode.totalRounds === null ? `第 ${round} 回合` : `第 ${round}/${mode.totalRounds} 頁`}
          </div>
        </div>
        {progress !== null && (
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/20">
            <div className="h-full rounded bg-white/80" style={{ width: `${progress}%` }} />
          </div>
        )}
        <button onClick={() => surfaceRef.current?.clear()} className="rounded bg-white/10 px-2 py-1 text-xs">清除</button>
        <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-1 rounded bg-green-500 px-2 py-1 text-xs font-bold disabled:opacity-50">
          <Check size={14} />{submitting ? "送出中" : "送出"}
        </button>
      </header>

      <main ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onWheel={handleWheel}
        />
      </main>

      <section className="flex shrink-0 items-center justify-center gap-2 bg-black/35 px-3 py-2 text-white backdrop-blur">
        <button onClick={() => setMoveMode((value) => !value)} className={`rounded-full p-2 ${moveMode ? "bg-sky-500" : "bg-white/10"}`} title="移動畫面"><Move size={18} /></button>
        <button onClick={() => setEraser((value) => !value)} className={`rounded-full p-2 ${eraser ? "bg-orange-500" : "bg-white/10"}`} title="橡皮擦"><Eraser size={18} /></button>
        <button onClick={() => setSize((value) => Math.max(1, value - 2))} className="rounded-full bg-white/10 p-2"><Minus size={18} /></button>
        <span className="min-w-8 text-center text-xs">{size}</span>
        <button onClick={() => setSize((value) => Math.min(100, value + 2))} className="rounded-full bg-white/10 p-2"><Plus size={18} /></button>
        <button onClick={() => { surfaceRef.current?.camera.reset(); surfaceRef.current?.render(); }} className="rounded-full bg-white/10 p-2" title="重設視角"><RotateCcw size={18} /></button>
        <Palette size={18} className="ml-1" />
        <div className="flex gap-1 overflow-x-auto">
          {COLORS.map((item) => (
            <button
              key={item}
              onClick={() => { setColor(item); setEraser(false); }}
              className={`h-6 w-6 shrink-0 rounded-full border-2 ${color === item && !eraser ? "border-white" : "border-white/20"}`}
              style={{ backgroundColor: item }}
              aria-label={`選擇顏色 ${item}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
