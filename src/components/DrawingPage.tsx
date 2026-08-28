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
  X,
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

function getCanvasBgColor(
  map: MapType,
  time: TimeOfDay
): string {
  if (map === "earth") {
    if (time === "day") {
      return "#bfefff";
    }

    if (time === "dusk") {
      return "#ffd580";
    }

    return "#1a2744";
  }

  if (time === "day") {
    return "#0d1b4b";
  }

  if (time === "dusk") {
    return "#2d0a3e";
  }

  return "#050a14";
}

function getHeaderColors(
  map: MapType,
  time: TimeOfDay
) {
  if (map === "earth") {
    if (time === "day") {
      return {
        bg: "rgba(14,116,144,0.85)",
        text: "#ffffff",
      };
    }

    if (time === "dusk") {
      return {
        bg: "rgba(154,52,18,0.85)",
        text: "#ffffff",
      };
    }

    return {
      bg: "rgba(15,23,42,0.90)",
      text: "#e2e8f0",
    };
  }

  if (time === "day") {
    return {
      bg: "rgba(13,27,75,0.90)",
      text: "#c7d2fe",
    };
  }

  if (time === "dusk") {
    return {
      bg: "rgba(45,10,62,0.90)",
      text: "#f0abfc",
    };
  }

  return {
    bg: "rgba(5,10,20,0.95)",
    text: "#94a3b8",
  };
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

  const containerRef =
    useRef<HTMLDivElement>(null);

  const cameraRef =
    useRef(
      new Camera(
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      )
    );

  const cameraControllerRef =
    useRef(
      new CameraController(
        cameraRef.current
      )
    );

  const rendererRef =
    useRef<Renderer | null>(null);

  const drawingEngineRef =
    useRef<DrawingEngine | null>(null);

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [color, setColor] =
    useState("#000000");

  const [brushSize, setBrushSize] =
    useState(6);

  const [isEraser, setIsEraser] =
    useState(false);

  const [toolOpen, setToolOpen] =
    useState(false);

  const [showPrev, setShowPrev] =
    useState(false);

  const [moveMode, setMoveMode] =
    useState(false);

  const timeOfDay =
    getTimeOfDay(round);

  const canvasBg =
    getCanvasBgColor(
      map,
      timeOfDay
    );

  const headerColors =
    getHeaderColors(
      map,
      timeOfDay
    );

  const getScreenPos =
    useCallback(
      (
        e: React.PointerEvent<
          HTMLCanvasElement
        >
      ) => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return null;
        }

        return Pointer.getScreenPosition(
          e.nativeEvent,
          canvas
        );
      },
      []
    );

  const getWorldPos =
    useCallback(
      (
        e: React.PointerEvent<
          HTMLCanvasElement
        >
      ) => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return null;
        }

        return Pointer.getWorldPosition(
          e.nativeEvent,
          canvas,
          cameraRef.current
        );
      },
      []
    );

  const render =
    useCallback(() => {
      drawingEngineRef.current?.render();
    }, []);

  const resizeCanvas =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      const container =
        containerRef.current;

      if (!canvas || !container) {
        return;
      }

      const width =
        container.clientWidth;

      const height =
        container.clientHeight;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return;
      }

      canvas.width = width;
      canvas.height = height;

      cameraRef.current.setViewport(
        width,
        height
      );

      render();
    }, [render]);

  const initCanvas =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      if (
        !rendererRef.current ||
        !drawingEngineRef.current
      ) {
        const renderer =
          new Renderer(
            ctx,
            CANVAS_WIDTH,
            CANVAS_HEIGHT
          );

        rendererRef.current =
          renderer;

        drawingEngineRef.current =
          new DrawingEngine(
            cameraRef.current,
            renderer
          );
      }

      resizeCanvas();
    }, [resizeCanvas]);

  useEffect(() => {
    initCanvas();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [
    initCanvas,
    resizeCanvas,
  ]);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const preventBrowserZoom =
      (event: WheelEvent) => {
        if (event.ctrlKey) {
          event.preventDefault();
        }
      };

    canvas.addEventListener(
      "wheel",
      preventBrowserZoom,
      {
        passive: false,
      }
    );

    return () => {
      canvas.removeEventListener(
        "wheel",
        preventBrowserZoom
      );
    };
  }, []);

  useEffect(() => {
    const engine =
      drawingEngineRef.current;

    if (!engine) {
      return;
    }

    if (prevPageUrl) {
      const image =
        new Image();

      image.onload = () => {
        drawingEngineRef.current?.drawImage(
          image,
          0,
          0
        );
      };

      image.src =
        prevPageUrl;

      return;
    }

    engine.clear();
  }, [prevPageUrl]);

  const handlePointerDown =
    useCallback(
      (
        e: React.PointerEvent<
          HTMLCanvasElement
        >
      ) => {
        e.preventDefault();

        const canvas =
          e.currentTarget;

        canvas.setPointerCapture(
          e.pointerId
        );

        if (moveMode) {
          const screenPoint =
            getScreenPos(e);

          if (!screenPoint) {
            return;
          }

          cameraControllerRef.current
            .startMove(
              screenPoint
            );

          return;
        }

        const worldPoint =
          getWorldPos(e);

        if (!worldPoint) {
          return;
        }

        setIsDrawing(true);

        drawingEngineRef.current
          ?.startDrawing(
            worldPoint,
            color,
            brushSize,
            isEraser
          );
      },
      [
        moveMode,
        getScreenPos,
        getWorldPos,
        color,
        brushSize,
        isEraser,
      ]
    );

  const handlePointerMove =
    useCallback(
      (
        e: React.PointerEvent<
          HTMLCanvasElement
        >
      ) => {
        e.preventDefault();

        if (moveMode) {
          const screenPoint =
            getScreenPos(e);

          if (!screenPoint) {
            return;
          }

          cameraControllerRef.current
            .move(
              screenPoint
            );

          render();

          return;
        }

        if (!isDrawing) {
          return;
        }

        const worldPoint =
          getWorldPos(e);

        if (!worldPoint) {
          return;
        }

        drawingEngineRef.current
          ?.draw(
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

  const handlePointerUp =
    useCallback(
      (
        e: React.PointerEvent<
          HTMLCanvasElement
        >
      ) => {
        e.preventDefault();

        const canvas =
          e.currentTarget;

        if (
          canvas.hasPointerCapture(
            e.pointerId
          )
        ) {
          canvas.releasePointerCapture(
            e.pointerId
          );
        }

        if (moveMode) {
          cameraControllerRef.current
            .endMove();

          return;
        }

        drawingEngineRef.current
          ?.endDrawing();

        setIsDrawing(false);
      },
      [moveMode]
    );

  const handleWheel =
    useCallback(
      (
        e: React.WheelEvent<
          HTMLCanvasElement
        >
      ) => {
        if (!e.ctrlKey) {
          return;
        }

        e.preventDefault();

        const canvas =
          canvasRef.current;

        if (!canvas) {
          return;
        }

        const screenPoint =
          Pointer.getScreenPosition(
            e.nativeEvent,
            canvas
          );

        const factor =
          e.deltaY < 0
            ? 1.1
            : 0.9;

        cameraControllerRef.current
          .zoomAt(
            screenPoint,
            factor
          );

        render();
      },
      [render]
    );

  const handleClear =
    useCallback(() => {
      drawingEngineRef.current
        ?.clear();
    }, []);

  const handleSubmit =
    useCallback(() => {
      const renderer =
        rendererRef.current;

      if (!renderer) {
        return;
      }

      const flat =
        document.createElement(
          "canvas"
        );

      flat.width =
        CANVAS_WIDTH;

      flat.height =
        CANVAS_HEIGHT;

      const context =
        flat.getContext("2d");

      if (!context) {
        return;
      }

      renderer.renderTo(
        context,
        canvasBg
      );

      onSubmit(
        flat.toDataURL(
          "image/png"
        )
      );
    }, [
      canvasBg,
      onSubmit,
    ]);

  const timeLabel =
    timeOfDay === "day"
      ? "白天"
      : timeOfDay === "dusk"
        ? "黃昏"
        : "夜晚";

  return (
    <div
      className="flex flex-col w-full h-screen"
      style={{
        touchAction: "none",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0 backdrop-blur-sm"
        style={{
          background:
            headerColors.bg,
          color:
            headerColors.text,
          paddingTop:
            "calc(0.5rem + env(safe-area-inset-top))",
        }}
      >
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight truncate">
            {playerName} 的回合
          </div>

          <div className="text-xs opacity-70">
            第 {round}/{totalRounds} 頁 · {timeLabel}
          </div>
        </div>

        <div className="flex-1 mx-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-500"
            style={{
              width:
                `${
                  (
                    round /
                    totalRounds
                  ) *
                  100
                }%`,
            }}
          />
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          {prevPageUrl && (
            <button
              onPointerDown={() =>
                setShowPrev(true)
              }
              onPointerUp={() =>
                setShowPrev(false)
              }
              onPointerLeave={() =>
                setShowPrev(false)
              }
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
            <Check size={13} />
            送出
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

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            touchAction: "none",
            display: "block",
            backgroundColor:
              canvasBg,
            transition:
              "background-color 1s ease",
          }}
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            handlePointerUp
          }
          onPointerCancel={
            handlePointerUp
          }
          onWheel={
            handleWheel
          }
        />

        {showPrev &&
          prevPageUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <img
                src={prevPageUrl}
                className="max-w-full max-h-full object-contain"
                alt="上一頁"
              />
            </div>
          )}
      </div>

      <div
        className="fixed right-4 z-20"
        style={{
          bottom:
            "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {toolOpen && (
          <div className="mb-3 bg-slate-900/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border border-slate-700/50 min-w-[220px]">
            <div className="mb-3">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wider">
                顏色
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {COLORS.map(
                  (itemColor) => (
                    <button
                      key={itemColor}
                      onClick={() => {
                        setColor(
                          itemColor
                        );
                        setIsEraser(
                          false
                        );
                      }}
                      className={`w-9 h-9 rounded-lg border-2 transition-transform active:scale-90 ${
                        color ===
                          itemColor &&
                        !isEraser
                          ? "border-white scale-110"
                          : "border-transparent"
                      }`}
                      style={{
                        backgroundColor:
                          itemColor,
                        boxShadow:
                          itemColor ===
                          "#ffffff"
                            ? "inset 0 0 0 1px #64748b"
                            : undefined,
                      }}
                    />
                  )
                )}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wider">
                筆刷大小 ({brushSize})
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setBrushSize(
                      (size) =>
                        Math.max(
                          1,
                          size - 2
                        )
                    )
                  }
                  className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center active:bg-slate-600"
                >
                  <Minus size={14} />
                </button>

                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full transition-all"
                    style={{
                      width:
                        `${
                          (
                            brushSize /
                            30
                          ) *
                          100
                        }%`,
                    }}
                  />
                </div>

                <button
                  onClick={() =>
                    setBrushSize(
                      (size) =>
                        Math.min(
                          30,
                          size + 2
                        )
                    )
                  }
                  className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center active:bg-slate-600"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setIsEraser(
                  (value) =>
                    !value
                );

                setMoveMode(
                  false
                );
              }}
              className={`w-full flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                isEraser
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "bg-slate-700/60 text-slate-300 border border-slate-600/30"
              }`}
            >
              <Eraser size={16} />
              橡皮擦{" "}
              {isEraser
                ? "(使用中)"
                : ""}
            </button>

            <button
              onClick={() => {
                setMoveMode(
                  (value) =>
                    !value
                );

                setIsEraser(
                  false
                );

                drawingEngineRef.current
                  ?.endDrawing();

                setIsDrawing(
                  false
                );
              }}
              className={`w-full mt-2 flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                moveMode
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "bg-slate-700/60 text-slate-300 border border-slate-600/30"
              }`}
            >
              <Flag size={16} />
              移動畫布{" "}
              {moveMode
                ? "(使用中)"
                : ""}
            </button>
          </div>
        )}

        <button
          onClick={() =>
            setToolOpen(
              (value) =>
                !value
            )
          }
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 ${
            toolOpen
              ? "bg-slate-800 text-white border-2 border-slate-600"
              : "bg-gradient-to-br from-sky-500 to-cyan-500 text-white"
          }`}
        >
          {toolOpen ? (
            <X size={22} />
          ) : (
            <Palette size={22} />
          )}
        </button>
      </div>
    </div>
  );
}