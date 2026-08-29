import { useCallback, useEffect, useRef } from "react";
import type { DrawingSession } from "./DrawingSession";
import type { DrawingSurface, Brush } from "./DrawingSurface";

type ScreenPoint = { x: number; y: number };

interface UseDrawingInteractionOptions {
  surfaceRef: React.RefObject<DrawingSurface | null>;
  sessionRef: React.RefObject<DrawingSession | null>;
  brush: () => Brush;
  moveMode: boolean;
  onStrokeEnd?: () => void;
}

/** 手機優先：單指繪圖／移動，雙指固定進入 Pinch + Pan，移動模式保留慣性。 */
export function useDrawingInteraction({ surfaceRef, sessionRef, brush, moveMode, onStrokeEnd }: UseDrawingInteractionOptions) {
  const activePointers = useRef(new Map<number, ScreenPoint>());
  const pinchDistance = useRef<number | null>(null);
  const pinchCenter = useRef<ScreenPoint | null>(null);
  const panPoint = useRef<ScreenPoint | null>(null);
  const velocity = useRef({ x: 0, y: 0, time: 0 });
  const inertiaFrame = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (inertiaFrame.current !== null) cancelAnimationFrame(inertiaFrame.current);
    inertiaFrame.current = null;
    velocity.current = { x: 0, y: 0, time: 0 };
  }, []);

  const startInertia = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    let vx = velocity.current.x;
    let vy = velocity.current.y;
    let last = performance.now();

    const step = (now: number) => {
      const current = surfaceRef.current;
      if (!current || activePointers.current.size > 0) {
        inertiaFrame.current = null;
        return;
      }
      const dt = Math.min(32, now - last);
      last = now;
      const decay = Math.pow(0.92, dt / 16.67);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) < 0.03) {
        inertiaFrame.current = null;
        return;
      }
      current.camera.panByScreen(vx * dt, vy * dt);
      current.render();
      inertiaFrame.current = requestAnimationFrame(step);
    };

    if (Math.hypot(vx, vy) >= 0.03) inertiaFrame.current = requestAnimationFrame(step);
  }, [surfaceRef]);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const getPinchPoints = useCallback(() => {
    const points = [...activePointers.current.values()];
    return points.length >= 2 ? [points[0], points[1]] as const : null;
  }, []);

  const getPinchDistance = useCallback(() => {
    const points = getPinchPoints();
    return points ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : null;
  }, [getPinchPoints]);

  const getPinchCenter = useCallback((): ScreenPoint | null => {
    const points = getPinchPoints();
    return points ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : null;
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

    stopInertia();
    const screen = surface.eventToScreen(event.nativeEvent);
    activePointers.current.set(event.pointerId, screen);

    if (activePointers.current.size >= 2) {
      session.end();
      panPoint.current = null;
      velocity.current = { x: 0, y: 0, time: 0 };
      resetPinch();
      return;
    }

    if (moveMode) {
      session.end();
      panPoint.current = screen;
      velocity.current = { x: 0, y: 0, time: performance.now() };
      return;
    }

    session.begin(surface.eventToWorld(event.nativeEvent), brush());
  }, [brush, moveMode, resetPinch, sessionRef, stopInertia, surfaceRef]);

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

    if (moveMode && panPoint.current) {
      const dx = screen.x - panPoint.current.x;
      const dy = screen.y - panPoint.current.y;
      const now = performance.now();
      const dt = Math.max(1, now - velocity.current.time);
      surface.camera.panByScreen(dx, dy);
      panPoint.current = screen;
      velocity.current = { x: dx / dt, y: dy / dt, time: now };
      surface.render();
      return;
    }

    if (!moveMode) session.move(surface.eventToWorld(event.nativeEvent), brush());
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
      panPoint.current = moveMode ? remaining : null;
      velocity.current = { x: 0, y: 0, time: performance.now() };
      session?.end();
      return;
    }

    const wasMoving = moveMode && panPoint.current !== null;
    panPoint.current = null;
    session?.end();
    if (wasMoving) startInertia();
    else if (!moveMode) onStrokeEnd?.();
  }, [moveMode, onStrokeEnd, resetPinch, sessionRef, startInertia]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;
    stopInertia();
    surface.camera.zoomAt(surface.eventToScreen(event), Math.exp(-event.deltaY * 0.0015));
    surface.render();
  }, [stopInertia, surfaceRef]);

  return { handlePointerDown, handlePointerMove, finishPointer, handleWheel };
}
