import { useCallback, useEffect, useRef } from "react";
import type { DrawingSession } from "./DrawingSession";
import type { DrawingSurface, Brush } from "./DrawingSurface";

type ScreenPoint = { x: number; y: number };

type InteractionState = "idle" | "drawing" | "moving" | "pinching" | "eraser";

interface UseDrawingInteractionOptions {
  surfaceRef: React.RefObject<DrawingSurface | null>;
  sessionRef: React.RefObject<DrawingSession | null>;
  brush: () => Brush;
  moveMode: boolean;
  onStrokeEnd?: () => void;
  onInteractionChange?: (state: InteractionState) => void;
}

/**
 * 手機優先互動：單指需先移動超過門檻才真正落筆，第二指可在此之前取消待命筆劃，避免 Pinch 縮放留下第一指的點。
 */
export function useDrawingInteraction({ surfaceRef, sessionRef, brush, moveMode, onStrokeEnd, onInteractionChange }: UseDrawingInteractionOptions) {
  const activePointers = useRef(new Map<number, ScreenPoint>());
  const pendingDraw = useRef<{ id: number; start: ScreenPoint } | null>(null);
  const drawingPointerId = useRef<number | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const pinchCenter = useRef<ScreenPoint | null>(null);
  const panPoint = useRef<ScreenPoint | null>(null);
  const panMoved = useRef(false);
  const velocity = useRef({ x: 0, y: 0, time: 0 });
  const inertiaFrame = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (inertiaFrame.current !== null) cancelAnimationFrame(inertiaFrame.current);
    inertiaFrame.current = null;
    velocity.current = { x: 0, y: 0, time: 0 };
  }, []);

  const setState = useCallback((state: InteractionState) => onInteractionChange?.(state), [onInteractionChange]);

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

  const startInertia = useCallback(() => {
    let vx = velocity.current.x;
    let vy = velocity.current.y;
    let last = performance.now();
    const step = (now: number) => {
      const current = surfaceRef.current;
      if (!current || activePointers.current.size > 0) { inertiaFrame.current = null; return; }
      const dt = Math.min(32, now - last);
      last = now;
      const decay = Math.pow(0.92, dt / 16.67);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) < 0.03) { inertiaFrame.current = null; setState("idle"); return; }
      current.camera.panByScreen(vx * dt, vy * dt);
      current.render();
      inertiaFrame.current = requestAnimationFrame(step);
    };
    if (Math.hypot(vx, vy) >= 0.03) inertiaFrame.current = requestAnimationFrame(step);
  }, [setState, surfaceRef]);

  useEffect(() => () => stopInertia(), [stopInertia]);

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
      pendingDraw.current = null;
      if (drawingPointerId.current !== null) session.cancel();
      drawingPointerId.current = null;
      panPoint.current = null;
      panMoved.current = false;
      velocity.current = { x: 0, y: 0, time: 0 };
      resetPinch();
      setState("pinching");
      return;
    }

    if (moveMode) {
      session.end();
      panPoint.current = screen;
      panMoved.current = false;
      velocity.current = { x: 0, y: 0, time: performance.now() };
      setState("moving");
      return;
    }

    pendingDraw.current = { id: event.pointerId, start: screen };
    drawingPointerId.current = null;
    setState(brush().eraser ? "eraser" : "drawing");
  }, [brush, moveMode, resetPinch, sessionRef, setState, stopInertia, surfaceRef]);

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
      setState("pinching");
      return;
    }

    if (moveMode && panPoint.current) {
      const dx = screen.x - panPoint.current.x;
      const dy = screen.y - panPoint.current.y;
      if (Math.hypot(dx, dy) > 3) panMoved.current = true;
      const now = performance.now();
      const dt = Math.max(1, now - velocity.current.time);
      surface.camera.panByScreen(dx, dy);
      panPoint.current = screen;
      velocity.current = { x: dx / dt, y: dy / dt, time: now };
      surface.render();
      setState("moving");
      return;
    }

    const pending = pendingDraw.current;
    if (pending && pending.id === event.pointerId) {
      const distance = Math.hypot(screen.x - pending.start.x, screen.y - pending.start.y);
      if (distance < 4) return;
      const startWorld = surface.camera.screenToWorld(pending.start);
      if (!session.begin(startWorld, brush())) return;
      pendingDraw.current = null;
      drawingPointerId.current = event.pointerId;
    }

    if (drawingPointerId.current === event.pointerId) {
      session.move(surface.eventToWorld(event.nativeEvent), brush());
      setState(brush().eraser ? "eraser" : "drawing");
    }
  }, [brush, getPinchCenter, getPinchDistance, moveMode, sessionRef, setState, surfaceRef]);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const surface = surfaceRef.current;
    const screen = surface?.eventToScreen(event.nativeEvent) ?? null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    const pending = pendingDraw.current;
    const wasTap = pending?.id === event.pointerId && activePointers.current.size === 1;
    activePointers.current.delete(event.pointerId);
    const session = sessionRef.current;

    if (activePointers.current.size >= 2) { session?.cancel(); resetPinch(); return; }

    if (activePointers.current.size === 1) {
      pendingDraw.current = null;
      drawingPointerId.current = null;
      panPoint.current = moveMode ? [...activePointers.current.values()][0] : null;
      panMoved.current = false;
      velocity.current = { x: 0, y: 0, time: performance.now() };
      session?.cancel();
      setState(moveMode ? "moving" : "idle");
      return;
    }

    pinchDistance.current = null;
    pinchCenter.current = null;

    const wasMoving = moveMode && panPoint.current !== null;
    const shouldFocus = Boolean(moveMode && !panMoved.current && surface && screen && surface.camera.zoom <= surface.camera.minimumZoom * 1.35);
    panPoint.current = null;

    if (wasTap && !moveMode && surface && session) {
      session.begin(surface.camera.screenToWorld(pending.start), brush());
      session.end();
      onStrokeEnd?.();
    } else if (drawingPointerId.current === event.pointerId) {
      session?.end();
      onStrokeEnd?.();
    } else {
      session?.cancel();
    }

    pendingDraw.current = null;
    drawingPointerId.current = null;

    if (shouldFocus && surface && screen) {
      surface.camera.focusAtScreen(screen);
      surface.render();
      setState("idle");
      return;
    }
    if (wasMoving) startInertia();
    else setState("idle");
  }, [brush, moveMode, onStrokeEnd, resetPinch, sessionRef, setState, startInertia, surfaceRef]);

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
