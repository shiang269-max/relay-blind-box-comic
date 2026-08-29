import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eraser, Hand, Move, Palette, PenLine, Trash2, Undo2 } from "lucide-react";
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
type InteractionState = "idle" | "drawing" | "moving" | "pinching" | "eraser";

interface DrawingScreenProps {
  mode: GameMode; roomId: string; pageIndex: number; round: number; playerCount: number;
  map: MapType; playerName: string; previousPage: string | null;
  onSubmit: (dataUrl: string) => Promise<boolean> | boolean;
}

export default function DrawingScreen({ mode, roomId, pageIndex, round, playerCount, map, playerName, previousPage, onSubmit }: DrawingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<DrawingSurface | null>(null);
  const sessionRef = useRef<DrawingSession | null>(null);
  const lifecycleRef = useRef<RelayPageDrawingLifecycle | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveRunningRef = useRef(false);
  const autosaveQueuedRef = useRef(false);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(5);
  const [eraser, setEraser] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [interaction, setInteraction] = useState<InteractionState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [loadingDrawing, setLoadingDrawing] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");

  const time = getTimeOfDay(round, playerCount);
  const brush = useCallback((): Brush => ({ color, size, eraser }), [color, size, eraser]);
  const resize = useCallback(() => { const element = containerRef.current; const surface = surfaceRef.current; if (element && surface) surface.resize(element.clientWidth, element.clientHeight); }, []);
  const saveSnapshotNow = useCallback(async () => {
    const lifecycle = lifecycleRef.current; if (!lifecycle || !lifecycle.isReady()) return;
    if (autosaveRunningRef.current) { autosaveQueuedRef.current = true; return; }
    autosaveRunningRef.current = true; setAutosaveState("saving");
    try { await lifecycle.saveSnapshot(); setAutosaveState("saved"); }
    catch (error) { console.error("繪圖自動儲存失敗", error); setAutosaveState("idle"); }
    finally { autosaveRunningRef.current = false; if (autosaveQueuedRef.current) { autosaveQueuedRef.current = false; void saveSnapshotNow(); } }
  }, []);
  const scheduleAutosave = useCallback(() => { if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current); setAutosaveState((current) => current === "saving" ? current : "idle"); autosaveTimerRef.current = window.setTimeout(() => { autosaveTimerRef.current = null; void saveSnapshotNow(); }, 500); }, [saveSnapshotNow]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; setLoadingDrawing(true); setAutosaveState("idle"); setSubmitError(null);
    const surface = new DrawingSurface(canvas, { worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT, map, time });
    const session = new DrawingSession(surface); const adapter = new RelayPageDrawingAdapter({ roomId, pageIndex, persistence: new FirebaseDrawingPersistence() }); const lifecycle = new RelayPageDrawingLifecycle(session, adapter);
    surfaceRef.current = surface; sessionRef.current = session; lifecycleRef.current = lifecycle; resize();
    const initialize = async () => { try { await lifecycle.initialize(); if (previousPage) await surface.loadImage(previousPage); } finally { if (!cancelled) setLoadingDrawing(false); } };
    void initialize(); const observer = new ResizeObserver(resize); const container = containerRef.current; if (container) observer.observe(container);
    return () => { cancelled = true; if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current); observer.disconnect(); session.end(); if (surfaceRef.current === surface) surfaceRef.current = null; if (sessionRef.current === session) sessionRef.current = null; if (lifecycleRef.current === lifecycle) lifecycleRef.current = null; };
  }, [map, pageIndex, previousPage, resize, roomId, time]);

  useEffect(() => { const handleVisibilityChange = () => { if (document.visibilityState !== "hidden") return; if (autosaveTimerRef.current !== null) { window.clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; } void saveSnapshotNow(); }; document.addEventListener("visibilitychange", handleVisibilityChange); return () => document.removeEventListener("visibilitychange", handleVisibilityChange); }, [saveSnapshotNow]);

  const { handlePointerDown, handlePointerMove, finishPointer, handleWheel } = useDrawingInteraction({ surfaceRef, sessionRef, brush, moveMode, onStrokeEnd: scheduleAutosave, onInteractionChange: setInteraction });
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; canvas.addEventListener("wheel", handleWheel, { passive: false }); return () => canvas.removeEventListener("wheel", handleWheel); }, [handleWheel]);

  const handleSubmit = async () => {
    const session = sessionRef.current, lifecycle = lifecycleRef.current; if (!session || !lifecycle || submitting || loadingDrawing) return;
    setSubmitting(true); setSubmitError(null);
    try { if (autosaveTimerRef.current !== null) { window.clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; } await lifecycle.saveSnapshot(); const committed = await onSubmit(session.exportPng()); if (!committed) setSubmitError("目前回合已經變更，作品暫存已保留，請等待最新房間狀態。"); }
    catch (error) { console.error("送出回合失敗", error); setSubmitError("送出失敗，作品暫存已保留，可以重新嘗試。"); }
    finally { setSubmitting(false); }
  };

  const progress = mode.totalRounds === null ? null : Math.min(100, (round / mode.totalRounds) * 100);
  const roundLabel = mode.totalRounds === null ? `第 ${round} 回合` : `第 ${round}/${mode.totalRounds} 頁`;
  const timeLabel = time === "day" ? "白天" : time === "dusk" ? "黃昏" : "夜晚";
  const autosaveLabel = autosaveState === "saving" ? "自動儲存中" : autosaveState === "saved" ? "已自動儲存" : "";
  const modeLabel = moveMode ? "移動畫布" : interaction === "eraser" || eraser ? "橡皮擦" : "畫筆";
  const ModeIcon = moveMode ? Hand : interaction === "eraser" || eraser ? Eraser : PenLine;

  return <div className="relative flex w-screen flex-col overflow-hidden text-white" style={{ height: "var(--app-height, 100svh)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
    <GameAtmosphere map={map} round={round} />
    <header className="relative z-10 shrink-0 border-b border-white/10 bg-slate-950/35 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{playerName} 的回合</div><div className="truncate text-xs text-white/70">{mode.label} · {roundLabel} · {timeLabel}{autosaveLabel ? ` · ${autosaveLabel}` : ""}</div></div><button onClick={handleSubmit} disabled={submitting || loadingDrawing} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-green-500/90 px-4 text-sm font-bold shadow-lg shadow-green-950/30 disabled:opacity-50"><Check size={18} />{loadingDrawing ? "載入中" : submitting ? "送出中" : "送出"}</button></div>
      {progress !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-indigo-300 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>}
      {submitError && <div className="mt-2 rounded-xl border border-red-300/20 bg-red-950/45 px-3 py-2 text-xs text-red-100">{submitError}</div>}
    </header>

    <main ref={containerRef} className="relative z-10 min-h-0 flex-1 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none select-none" style={{ touchAction: "none" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-xs font-bold shadow-lg backdrop-blur-md"><ModeIcon size={18} />{modeLabel}</div>
      <div className="absolute right-3 top-3 z-20">
        <button onClick={() => setPaletteOpen((value) => !value)} className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl border shadow-lg backdrop-blur-md ${paletteOpen ? "border-cyan-300/60 bg-cyan-500 text-slate-950" : "border-white/15 bg-slate-950/70 text-white"}`} aria-label="開啟調色盤" title="調色盤"><Palette size={20} /></button>
        {paletteOpen && <div className="absolute right-0 top-13 mt-2 w-56 rounded-2xl border border-white/15 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl"><div className="mb-2 text-xs font-bold text-white/70">選擇顏色</div><div className="grid grid-cols-5 gap-2">{COLORS.map((item) => <button key={item} onClick={() => { setColor(item); setEraser(false); setMoveMode(false); setPaletteOpen(false); }} className={`h-9 w-9 rounded-full border-2 transition-transform active:scale-90 ${color === item && !eraser ? "scale-110 border-white" : "border-white/25"}`} style={{ backgroundColor: item }} aria-label={`選擇顏色 ${item}`} />)}</div></div>}
      </div>
      {loadingDrawing && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 text-sm font-medium text-white backdrop-blur-sm">載入繪圖資料中...</div>}
    </main>

    <section className="relative z-10 shrink-0 border-t border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><div className="flex min-h-14 items-center gap-2 px-3 py-2">
      <button onClick={() => { setMoveMode((value) => !value); setEraser(false); }} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${moveMode ? "bg-sky-500 shadow-lg shadow-sky-950/30" : "bg-white/10"}`} title="移動畫布" aria-label="移動畫布"><Move size={20} /></button>
      <button onClick={() => { setEraser((value) => !value); setMoveMode(false); }} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${eraser ? "bg-orange-500 shadow-lg shadow-orange-950/30" : "bg-white/10"}`} title="橡皮擦" aria-label="橡皮擦"><Eraser size={20} /></button>
      <button onClick={() => { void lifecycleRef.current?.undo().then((changed) => { if (changed) setAutosaveState("saved"); }); }} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/10" title="返回上一步" aria-label="返回上一步"><Undo2 size={19} /></button>
      <button onClick={() => { if (window.confirm("確定清除本頁目前畫的所有內容？上一頁作品不會被刪除。")) void lifecycleRef.current?.clear().then(() => setAutosaveState("idle")); }} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-100" title="清除本頁" aria-label="清除本頁"><Trash2 size={19} /></button>
      <div className="ml-auto flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/10 px-3"><PenLine size={16} className="shrink-0 text-white/70" /><input type="range" min="1" max="64" step="1" value={size} onChange={(event) => setSize(Number(event.target.value))} className="min-w-0 flex-1 accent-cyan-300" aria-label="筆刷粗細" /><span className="w-8 text-right text-xs font-bold text-white/80">{size}</span></div>
    </div></section>
  </div>;
}
