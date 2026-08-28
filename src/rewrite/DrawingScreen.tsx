import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Minus,
  Move,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  getBackgroundColor,
  getTimeOfDay,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type MapType,
} from "./domain";
import type { GameMode } from "./game/GameMode";
import { DrawingSession } from "./drawing/DrawingSession";
import { DrawingSurface, type Brush } from "./drawing/DrawingSurface";
import { useDrawingInteraction } from "./drawing/useDrawingInteraction";

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
  const sessionRef = useRef<DrawingSession | null>(null);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(8);
  const [eraser, setEraser] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const time = getTimeOfDay(round);
  const background = getBackgroundColor(map, time);

  const brush = useCallback((): Brush => ({
    color,
    size,
    eraser,
  }), [color, size, eraser]);

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
    const session = new DrawingSession(surface);

    surfaceRef.current = surface;
    sessionRef.current = session;
    resize();

    if (previousPage) {
      void surface.loadImage(previousPage);
    }

    const observer = new ResizeObserver(resize);
    const container = containerRef.current;
    if (container) observer.observe(container);

    return () => {
      observer.disconnect();
      session.end();
      if (surfaceRef.current === surface) surfaceRef.current = null;
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [background, previousPage, resize]);

  const {
    handlePointerDown,
    handlePointerMove,
    finishPointer,
    handleWheel,
  } = useDrawingInteraction({
    surfaceRef,
    sessionRef,
    brush,
    moveMode,
  });

  const handleSubmit = async () => {
    const session = sessionRef.current;
    if (!session || submitting) return;

    setSubmitting(true);

    try {
      await onSubmit(session.exportPng());
    } finally {
      setSubmitting(false);
    }
  };

  const progress = mode.totalRounds === null
    ? null
    : Math.min(100, (round / mode.totalRounds) * 100);

  const roundLabel = mode.totalRounds === null
    ? `第 ${round} 回合`
    : `第 ${round}/${mode.totalRounds} 頁`;

  return (
    <div
      className="flex w-screen flex-col overflow-hidden"
      style={{
        height: "var(--app-height, 100svh)",
        background,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header className="shrink-0 border-b border-white/10 bg-black/35 px-3 py-2 text-white backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{playerName} 的回合</div>
            <div className="truncate text-xs text-white/70">
              {mode.label} · {roundLabel}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-green-500 px-4 text-sm font-bold shadow disabled:opacity-50"
          >
            <Check size={18} />
            {submitting ? "送出中" : "送出"}
          </button>
        </div>

        {progress !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white/80 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      <main ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full touch-none select-none"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onWheel={handleWheel}
        />
      </main>

      <section className="shrink-0 border-t border-white/10 bg-black/45 text-white backdrop-blur">
        <div className="flex min-h-14 items-center gap-2 overflow-x-auto px-3 py-2 [-webkit-overflow-scrolling:touch]">
          <button
            onClick={() => {
              setMoveMode((value) => !value);
              setEraser(false);
            }}
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl ${
              moveMode ? "bg-sky-500" : "bg-white/10"
            }`}
            title="移動畫面"
            aria-label="移動畫面"
          >
            <Move size={20} />
          </button>

          <button
            onClick={() => {
              setEraser((value) => !value);
              setMoveMode(false);
            }}
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl ${
              eraser ? "bg-orange-500" : "bg-white/10"
            }`}
            title="橡皮擦"
            aria-label="橡皮擦"
          >
            <Eraser size={20} />
          </button>

          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/10 px-1">
            <button
              onClick={() => setSize((value) => Math.max(1, value - 2))}
              className="flex min-h-11 min-w-10 items-center justify-center"
              aria-label="縮小筆刷"
            >
              <Minus size={18} />
            </button>

            <span className="min-w-8 text-center text-xs font-bold">{size}</span>

            <button
              onClick={() => setSize((value) => Math.min(100, value + 2))}
              className="flex min-h-11 min-w-10 items-center justify-center"
              aria-label="放大筆刷"
            >
              <Plus size={18} />
            </button>
          </div>

          <button
            onClick={() => {
              surfaceRef.current?.camera.reset();
              surfaceRef.current?.render();
            }}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/10"
            title="重設視角"
            aria-label="重設視角"
          >
            <RotateCcw size={19} />
          </button>

          <button
            onClick={() => sessionRef.current?.clear()}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/10"
            title="清除畫面"
            aria-label="清除畫面"
          >
            <Trash2 size={19} />
          </button>

          <div className="h-8 w-px shrink-0 bg-white/15" />

          <Palette size={19} className="shrink-0 text-white/80" />

          <div className="flex shrink-0 gap-1.5 pr-1">
            {COLORS.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setColor(item);
                  setEraser(false);
                  setMoveMode(false);
                }}
                className={`h-9 w-9 shrink-0 rounded-full border-2 transition-transform active:scale-90 ${
                  color === item && !eraser
                    ? "border-white scale-110"
                    : "border-white/25"
                }`}
                style={{ backgroundColor: item }}
                aria-label={`選擇顏色 ${item}`}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
