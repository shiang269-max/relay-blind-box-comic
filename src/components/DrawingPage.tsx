import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Palette, Minus, Plus, Eraser, Check, X, Flag } from 'lucide-react';
import { getTimeOfDay } from '../lib/gameTypes';
import type { MapType, TimeOfDay } from '../lib/gameTypes';

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
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#6b7280', '#92400e', '#1e3a5f', '#fde68a', '#bbf7d0',
];

function getCanvasBgColor(map: MapType, time: TimeOfDay): string {
  if (map === 'earth') {
    if (time === 'day') return '#bfefff'; // light sky blue
    if (time === 'dusk') return '#ffd580'; // warm amber
    return '#1a2744';                       // deep night blue
  }
  // space
  if (time === 'day') return '#0d1b4b'; // deep space blue
  if (time === 'dusk') return '#2d0a3e'; // nebula purple
  return '#050a14';                       // void black
}

function getHeaderColors(map: MapType, time: TimeOfDay) {
  if (map === 'earth') {
    if (time === 'day') return { bg: 'rgba(14,116,144,0.85)', text: '#ffffff' };
    if (time === 'dusk') return { bg: 'rgba(154,52,18,0.85)', text: '#ffffff' };
    return { bg: 'rgba(15,23,42,0.90)', text: '#e2e8f0' };
  }
  if (time === 'day') return { bg: 'rgba(13,27,75,0.90)', text: '#c7d2fe' };
  if (time === 'dusk') return { bg: 'rgba(45,10,62,0.90)', text: '#f0abfc' };
  return { bg: 'rgba(5,10,20,0.95)', text: '#94a3b8' };
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [showPrev, setShowPrev] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const timeOfDay = getTimeOfDay(round);
  const canvasBg = getCanvasBgColor(map, timeOfDay);
  const headerColors = getHeaderColors(map, timeOfDay);

  const getCanvasPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Clear to transparent — CSS background-color provides the time-of-day color
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      // Save existing drawing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);

      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(tempCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  // Only run on mount; canvasBg changes handled by initCanvas
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to center on initial load
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
      container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // On mount: restore previous snapshot so strokes accumulate across rounds
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (prevPageUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = prevPageUrl;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const pos = getCanvasPos(e);
    if (!pos) return;
    setIsDrawing(true);
    lastPos.current = pos;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (isEraser ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? 'transparent' : color;
    if (!isEraser) ctx.fill();
    else {
      ctx.clearRect(pos.x - brushSize, pos.y - brushSize, brushSize * 2, brushSize * 2);
    }
  }, [getCanvasPos, color, brushSize, isEraser]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    if (!pos || !lastPos.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    if (isEraser) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = brushSize * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
    else {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPos.current = pos;
  }, [isDrawing, getCanvasPos, color, brushSize, isEraser]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Composite bg color + strokes into an offscreen canvas so the snapshot
    // is fully opaque and ReviewPage shows the correct appearance.
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d')!;
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    onSubmit(flat.toDataURL('image/png'));
  };

  const timeLabel = timeOfDay === 'day' ? '白天' : timeOfDay === 'dusk' ? '黃昏' : '夜晚';

  return (
    <div className="flex flex-col w-full h-screen" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0 backdrop-blur-sm"
        style={{ background: headerColors.bg, color: headerColors.text, paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight truncate">{playerName} 的回合</div>
          <div className="text-xs opacity-70">第 {round}/{totalRounds} 頁 · {timeLabel}</div>
        </div>

        {/* Progress bar inside header */}
        <div className="flex-1 mx-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-500"
            style={{ width: `${(round / totalRounds) * 100}%` }}
          />
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
          <button
            onClick={handleClear}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-white/25 bg-white/10 active:bg-white/20"
          >
            清除
          </button>
          <button
            onClick={handleSubmit}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-green-500 text-white font-semibold flex items-center gap-1 active:bg-green-400"
          >
            <Check size={13} /> 送出
          </button>
          <button
            onClick={onDevReview}
            title="DEV: 直接查看成果"
            className="text-xs px-2 py-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 flex items-center gap-1 active:bg-yellow-400/20"
          >
            <Flag size={13} />
          </button>
        </div>
      </div>

      {/* Canvas — fills everything below header */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <div
          className="relative overflow-scroll w-full h-full"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'scroll',
          }}
        >
          <div
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              position: 'relative',
            }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{
                touchAction: 'none',
                display: 'block',
                backgroundColor: canvasBg,
                transition: 'background-color 1s ease',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
        </div>

        {/* Previous page overlay */}
        {showPrev && prevPageUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <img src={prevPageUrl} className="max-w-full max-h-full object-contain" alt="上一頁" />
          </div>
        )}
      </div>

      {/* Tool FAB */}
      <div
        className="fixed right-4 z-20"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {toolOpen && (
          <div className="mb-3 bg-slate-900/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border border-slate-700/50 min-w-[220px]">
            {/* Color picker */}
            <div className="mb-3">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wider">顏色</div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setIsEraser(false); }}
                    className={`w-9 h-9 rounded-lg border-2 transition-transform active:scale-90 ${
                      color === c && !isEraser ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c, boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #64748b' : undefined }}
                  />
                ))}
              </div>
            </div>

            {/* Brush size */}
            <div className="mb-3">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wider">筆刷大小 ({brushSize})</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBrushSize(s => Math.max(1, s - 2))}
                  className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center active:bg-slate-600"
                >
                  <Minus size={14} />
                </button>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full transition-all"
                    style={{ width: `${(brushSize / 30) * 100}%` }}
                  />
                </div>
                <button
                  onClick={() => setBrushSize(s => Math.min(30, s + 2))}
                  className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center active:bg-slate-600"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Eraser */}
            <button
              onClick={() => setIsEraser(e => !e)}
              className={`w-full flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                isEraser ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-slate-700/60 text-slate-300 border border-slate-600/30'
              }`}
            >
              <Eraser size={16} />
              橡皮擦 {isEraser ? '(使用中)' : ''}
            </button>
          </div>
        )}

        <button
          onClick={() => setToolOpen(o => !o)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 ${
            toolOpen
              ? 'bg-slate-800 text-white border-2 border-slate-600'
              : 'bg-gradient-to-br from-sky-500 to-cyan-500 text-white'
          }`}
        >
          {toolOpen ? <X size={22} /> : <Palette size={22} />}
        </button>
      </div>
    </div>
  );
}
