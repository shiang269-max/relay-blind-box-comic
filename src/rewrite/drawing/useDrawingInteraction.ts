import { useCallback, useRef, useState } from "react";
import type { DrawingSurface, Brush } from "./DrawingSurface";

type ScreenPoint = { x: number; y: number };

interface UseDrawingInteractionOptions {
  surfaceRef: React.RefObject<DrawingSurface | null>;
  brush: () => Brush;
  moveMode: boolean;
}

export function useDrawingInteraction({
  surfaceRef,
  brush,
  moveMode,
}: UseDrawingInteractionOptions) {
  const activePointers = useRef(new Map<number, ScreenPoint>());
  const pinchDistance = useRef<number | null>(null);
  const panPoint = useRef<ScreenPoint | null>(null);
  const [drawing, setDrawing] = useState(false);

  const getPinchDistance = useCallback(() => {
    const points = [...activePointers.current.values()];
    if (points.length < 2) return null;
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
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
  }, [brush, getPinchDistance, moveMode, surfaceRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
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
        surface.camera.zoomAt(
          {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
          },
          factor
        );
        surface.render();
      }

      pinchDistance.current = next;
      return;
    }

    if (moveMode) {
      if (panPoint.current) {
        surface.camera.panByScreen(
          screen.x - panPoint.current.x,
          screen.y - panPoint.current.y
        );
        panPoint.current = screen;
        surface.render();
      }
      return;
    }

    if (!drawing) return;
    surface.continueStroke(surface.eventToWorld(event.nativeEvent), brush());
  }, [brush, drawing, getPinchDistance, moveMode, surfaceRef]);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    activePointers.current.delete(event.pointerId);

    if (activePointers.current.size < 2) {
      pinchDistance.current = null;
    }

    if (activePointers.current.size === 0) {
      panPoint.current = null;
    }

    surfaceRef.current?.endStroke();
    setDrawing(false);
  }, [surfaceRef]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;

    const screen = surface.eventToScreen(event.nativeEvent);
    surface.camera.zoomAt(screen, Math.exp(-event.deltaY * 0.0015));
    surface.render();
  }, [surfaceRef]);

  return {
    handlePointerDown,
    handlePointerMove,
    finishPointer,
    handleWheel,
  };
}
