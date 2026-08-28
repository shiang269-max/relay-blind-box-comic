import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eraser, Minus, Move, Palette, Plus, RotateCcw, Trash2 } from "lucide-react";
import { getTimeOfDay, WORLD_HEIGHT, WORLD_WIDTH, type MapType } from "./domain";
import type { GameMode } from "./game/GameMode";
import { DrawingSession } from "./drawing/DrawingSession";
import { DrawingSurface, type Brush } from "./drawing/DrawingSurface";
import { useDrawingInteraction } from "./drawing/useDrawingInteraction";
import { RelayPageDrawingAdapter } from "./modes/RelayPageDrawingAdapter";
import { RelayPageDrawingLifecycle } from "./modes/RelayPageDrawingLifecycle";
import { FirebaseDrawingPersistence } from "./persistence/FirebaseDrawingPersistence";
import GameAtmosphere from "./visuals/GameAtmosphere";

const COLORS = ["#000000", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

interface DrawingScreenProps {
  mode: GameMode;
  roomId: string;
  pageIndex: number;
  round: number;
  map: MapType;
  playerName: string;
  previousPage: string | null;
  onSubmit: (dataUrl: string) => Promise<boolean> | boolean;
}

export default function DrawingScreen({ mode, roomId, pageIndex, round, map, playerName, previousPage, onSubmit }: DrawingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<DrawingSurface | null>(null);
  const sessionRef = useRef<DrawingSession | null>(null);
  const lifecycleRef = useRef<RelayPageDrawingLifecycle | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveRunningRef = useRef(false);
  const autosaveQueuedRef = useRef(false);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(8);
  const [eraser, setEraser] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDrawing, setLoadingDrawing] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");

  const time = getTimeOfDay(round);
  const brush = useCallback((): Brush => ({ color, size, eraser }), [color, size, eraser]);

  const resize = useCallback(() => {
    const element = containerRef.current;
    const surface = surfaceRef.current;
    if (!element || !surface) return;
    surface.resize(element.clientWidth, element.clientHeight);
  }, []);

  const saveSnapshotNow = useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle || !lifecycle.isReady()) return;

    if (autosaveRunningRef.current) {
      autosaveQueuedRef.current = true;
      return;
    }

    autosaveRunningRef.current = true;
    setAutosaveState("saving");
    try {
      await lifecycle.saveSnapshot();
      setAutosaveState("saved");
    } catch (error) {
      console.error("繪圖自動儲存失敗", error);
      setAutosaveState("idle");
    } finally {
      autosaveRunningRef.current = false;
      if (autosaveQueuedRef.current) {
        autosaveQueuedRef.current = false;
        void saveSnapshotNow();
      }
    }
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    setAutosaveState((current) => current === "saving" ? current : "idle");
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveSnapshotNow();
    }, 500);
  }, [saveSnapshotNow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setLoadingDrawing(true);
    setAutosaveState("idle");
    setSubmitError(null);

    const surface = new DrawingSurface(canvas, {
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      map,
      time,
    });
    const session = new DrawingSession(surface);
    const adapter = new RelayPageDrawingAdapter({ roomId, pageIndex, persistence: new FirebaseDrawingPersistence() });
    const lifecycle = new RelayPageDrawingLifecycle(session, adapter);

    surfaceRef.current = surface;
    sessionRef.current = session;
    lifecycleRef.current = lifecycle;
    resize();

    const initialize = async () => {
      try {
        if (previousPage) await surface.loadImage(previousPage);
        await lifecycle.initialize();
      } finally {
        if (!cancelled) setLoadingDrawing(false);
      }
    };

    void initialize();

    const observer = new ResizeObserver(resize);
    const container = containerRef.current;
    if (container) observer.observe(container);

    return () => {
      cancelled = true;
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
      observer.disconnect();
      session.end();
      if (surfaceRef.current === surface) surfaceRef.current = null;
      if (sessionRef.current === session) sessionRef.current = null;
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
    };
  }, [map, pageIndex, previousPage, resize, roomId, time]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      void saveSnapshotNow();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [saveSnapshotNow]);

  const { handlePointerDown, handlePointerMove, finishPointer, handleWheel } = useDrawingInteraction({
    surfaceRef,
    sessionRef,
    brush,
    moveMode,
    onStrokeEnd: scheduleAutosave,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleSubmit = async () => {
    const session = sessionRef.current;
    const lifecycle = lifecycleRef.current;
    if (!session || !lifecycle || submitting || loadingDrawing) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      await lifecycle.saveSnapshot();
      const committed = await onSubmit(session.exportPng());

      if (!committed) {
        setSubmitError("目前回合已經變更，作品暫存已保留，請等待最新房間狀態。");
        return;
      }

      // 成功送出後不立即清除 Firebase 暫存。
      // 下一回合已由 room/pageIndex 切換；保留上一頁快照可避免非同步切換時
      // 因本地清除而造成「內容突然消失」的觀感，也提供送出後的恢復保護。
    } catch (error) {
      console.error("送出回合失敗", error);
      setSubmitError("送出失敗，作品暫存已保留，可以重新嘗試。");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = mode.totalRounds === null ? null : Math.min(100, (round / mode.totalRounds) * 100);
  const roundLabel = mode.totalRounds === null ? `第 ${round} 回合` : `第 ${round}/${mode.totalRounds} 頁`;
  const timeLabel = time === "day" ? "白天" : time === "dusk" ? "黃昏" : "夜晚";
  const autosaveLabel = autosaveState === "saving" ? "自動儲存中" : autosaveState === "saved" ? "已自動儲存" : "";

  return (
    <div className="relative flex w-screen flex-col overflow-hidden text-white" style={{ height: "var(--app-height, 100svh)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <GameAtmosphere map={map} round={round} />
      <header className="relative z-10 shrink-0 border-b border-white/10 bg-slate-950/35 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{playerName} 的回合</div>
            <div className="truncate text-xs text-white/70">{mode.label} · {roundLabel} · {timeLabel}{autosaveLabel ? ` · ${autosaveLabel}` : ""}</div>
          </div>
          <button onClick={handleSubmit} disabled={submitting || loadingDrawing} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-green-500/90 px-4 text-sm font-bold shadow-lg shadow-green-950/30 disabled:opacity-50"><Check size={18} />{loadingDrawing ? "載入中" : submitting ? "送出中" : "送出"}</button>
        </div>
        {progress !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-indigo-300 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>}
        {submitError && <div className="mt-2 rounded-xl border border-red-300/20 bg-red-950/45 px-3 py-2 text-xs text-red-100">{submitError}</div>}
      </header>

      <main ref={containerRef} className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none select-none" style={{ touchAction: "none" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        {loadingDrawing && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 text-sm font-medium text-white backdrop-blur-sm">載入繪圖資料中...</div>}
      </main>

      <section className="relative z-10 shrink-0 border-t border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><div className="flex min-h-14 items-center gap-2 overflow-x-auto px-3 py-2 [-webkit-overflow-scrolling:touch]">
        <button onClick={() => { setMoveMode((value) => !value); setEraser(false); }} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${moveMode ? "bg-sky-500 shadow-lg shadow-sky-950/30" : "bg-white/10"}`} title="移動畫面" aria-label="移動畫面"><Move size={20} /></button>
        <button onClick={() => { setEraser((value) => !value); setMoveMode(false); }} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${eraser ? "bg-orange-500 shadow-lg shadow-orange-950/30" : "bg-white/10"}`} title="橡皮擦" aria-label="橡皮擦"><Eraser size={20} /></button>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/10 px-1"><button onClick={() => setSize((value) => Math.max(1, value - 2))} className="flex min-h-11 min-w-10 items-center justify-center" aria-label="縮小筆刷"><Minus size={18} /></button><span className="min-w-8 text-center text-xs font-bold">{size}</span><button onClick={() => setSize((value) => Math.min(100, value + 2))} className="flex min-h-11 min-w-10 items-center justify-center" aria-label="放大筆刷"><Plus size={18} /></button></div>
        <button onClick={() => { surfaceRef.current?.camera.reset(); surfaceRef.current?.render(); }} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/10" title="重設視角" aria-label="重設視角"><RotateCcw size={19} /></button>
        <button onClick={() => { void lifecycleRef.current?.clear(); setAutosaveState("idle"); }} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/10" title="清除本頁筆劃" aria-label="清除本頁筆劃"><Trash2 size={19} /></button>
        <div className="h-8 w-px shrink-0 bg-white/15" /><Palette size={19} className="shrink-0 text-white/80" />
        <div className="flex shrink-0 gap-1.5 pr-1">{COLORS.map((item) => <button key={item} onClick={() => { setColor(item); setEraser(false); setMoveMode(false); }} className={`h-9 w-9 shrink-0 rounded-full border-2 transition-transform active:scale-90 ${color === item && !eraser ? "scale-110 border-white" : "border-white/25"}`} style={{ backgroundColor: item }} aria-label={`選擇顏色 ${item}`} />)}</div>
      </div></section>
    </div>
  );
}
