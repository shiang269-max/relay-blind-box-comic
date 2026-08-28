import { useCallback, useRef } from "react";
import type { DrawingSession } from "./DrawingSession";
import type { DrawingSurface, Brush } from "./DrawingSurface";

type ScreenPoint = { x: number; y: number };

interface UseDrawingInteractionOptions {
  surfaceRef: React.RefObject<DrawingSurface | null>;
  sessionRef: React.RefObject<DrawingSession | null>;
  brush: () => Brush;
  moveMode: boolean;
}

/**
 * Mobile-first drawing gesture controller.
 * One pointer draws or pans; two pointers always control the camera.
 */
export function useDrawingInteraction({
  surfaceRef,
  sessionRef,
  brush,
  moveMode,
}: UseDrawingInteractionOptions) {
  const activePointers = useRef(new Map<number, ScreenPoint>());
  const pinchDistance = useRef<number | null>(null);
  const pinchCenter = useRef<ScreenPoint | null>(null);
  const panPoint = useRef<ScreenPoint | null>(null);

  const getPinchPoints = useCallback(() => {
    const points = [...activePointers.current.values()];
    return points.length >= 2 ? [points[0], points[1]] as const : null;
  }, []);

  const getPinchDistance = useCallback(() => {
    const points = getPinchPoints();
    if (!points) return null;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }, [getPinchPoints]);

  const getPinchCenter = useCallback((): ScreenPoint | null => {
    const points = getPinchPoints();
    if (!points) return null;
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }, [getPinchPoints]);

  const resetPinch = useCallback(() => {
    pinchDistance.current = getPinchDistance();
    pinchCenter.current = getPinchCenter();
  }, [getPinchCenter, getPinchDistance]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);

    const surface = surfaceRef.current;
    const session = sessionRef.current;
    if (!surface || !session) return;

    const screen = surface.eventToScreen(event.nativeEvent);
    activePointers.current.set(event.pointerId, screen);

    if (activePointers.current.size >= 2) {
      session.end();
      panPoint.current = null;
      resetPinch();
      return;
    }

    if (moveMode) {
      session.end();
      panPoint.current = screen;
      return;
    }

    session.begin(surface.eventToWorld(event.nativeEvent), brush());
  }, [brush, moveMode, resetPinch, sessionRef, surfaceRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    const session = sessionRef.current;
    if (!surface || !session) return;

    const screen = surface.eventToScreen(event.nativeEvent);
    if (activePointers.current.has(event.pointerId)) activePointers.current.set(event.pointerId, screen);

    if (activePointers.current.size >= 2) {
      const previousDistance = pinchDistance.current;
      const previousCenter = pinchCenter.current;
      const nextDistance = getPinchDistance();
      const nextCenter = getPinchCenter();

      if (previousDistance && previousCenter && nextDistance && nextCenter) {
        surface.camera.zoomAt(previousCenter, nextDistance / previousDistance);
        surface.camera.panByScreen(nextCenter.x - previousCenter.x, nextCenter.y - previousCenter.y);
        surface.render();
      }

      pinchDistance.current = nextDistance;
      pinchCenter.current = nextCenter;
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

    session.move(surface.eventToWorld(event.nativeEvent), brush());
  }, [brush, getPinchCenter, getPinchDistance, moveMode, sessionRef, surfaceRef]);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    activePointers.current.delete(event.pointerId);
    const session = sessionRef.current;

    if (activePointers.current.size >= 2) {
      session?.end();
      resetPinch();
      return;
    }

    pinchDistance.current = null;
    pinchCenter.current = null;

    if (activePointers.current.size === 1) {
      const remaining = [...activePointers.current.values()][0];
      // After a pinch, the remaining finger must lift before a new drawing stroke begins.
      panPoint.current = moveMode ? remaining : null;
      session?.end();
      return;
    }

    panPoint.current = null;
    session?.end();
  }, [moveMode, resetPinch, sessionRef]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;

    const screen = surface.eventToScreen(event.nativeEvent);
    surface.camera.zoomAt(screen, Math.exp(-event.deltaY * 0.0015));
    surface.render();
  }, [surfaceRef]);

  return { handlePointerDown, handlePointerMove, finishPointer, handleWheel };
}
