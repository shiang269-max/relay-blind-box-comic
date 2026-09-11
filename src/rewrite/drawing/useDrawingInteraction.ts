import { useCallback, useEffect, useRef } from "react";
import type { DrawingSession } from "./DrawingSession";
import type { DrawingSurface, Brush } from "./DrawingSurface";

type ScreenPoint = { x: number; y: number };
type InteractionState = "idle" | "drawing" | "moving" | "pinching" | "eraser";
interface Options { canvasRef: React.RefObject<HTMLCanvasElement | null>; surfaceRef: React.RefObject<DrawingSurface | null>; sessionRef: React.RefObject<DrawingSession | null>; brush: () => Brush; moveMode: boolean; onStrokeEnd?: () => void; onInteractionChange?: (state: InteractionState) => void; }

function latestPointerEvent(event: PointerEvent): PointerEvent {
  const coalesced = event.getCoalescedEvents?.();
  return coalesced && coalesced.length > 0 ? coalesced[coalesced.length - 1] : event;
}

export function useDrawingInteraction({ canvasRef, surfaceRef, sessionRef, brush, moveMode, onStrokeEnd, onInteractionChange }: Options) {
  const pointers = useRef(new Map<number, ScreenPoint>());
  const nativeDrawingPointers = useRef(new Set<number>());
  const pending = useRef<{ id: number; start: ScreenPoint } | null>(null);
  const drawingId = useRef<number | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const pinchCenter = useRef<ScreenPoint | null>(null);
  const panPoint = useRef<ScreenPoint | null>(null);
  const velocity = useRef({ x: 0, y: 0, time: 0 });
  const inertiaFrame = useRef<number | null>(null);
  const state = useCallback((value: InteractionState) => onInteractionChange?.(value), [onInteractionChange]);
  const stopInertia = useCallback(() => { if (inertiaFrame.current !== null) cancelAnimationFrame(inertiaFrame.current); inertiaFrame.current = null; velocity.current = { x: 0, y: 0, time: 0 }; }, []);
  const pinch = useCallback(() => { const values = [...pointers.current.values()]; if (values.length < 2) return null; const [a, b] = values; return { distance: Math.hypot(a.x - b.x, a.y - b.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }, []);
  const resetPinch = useCallback(() => { const value = pinch(); pinchDistance.current = value?.distance ?? null; pinchCenter.current = value?.center ?? null; }, [pinch]);

  const startInertia = useCallback(() => {
    let vx = velocity.current.x, vy = velocity.current.y, last = performance.now();
    const step = (now: number) => {
      const surface = surfaceRef.current;
      if (!surface || pointers.current.size > 0) { inertiaFrame.current = null; return; }
      const dt = Math.min(32, now - last);
      last = now;
      const decay = Math.pow(0.92, dt / 16.67);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) < 0.03) { inertiaFrame.current = null; state("idle"); return; }
      surface.camera.panByScreen(vx * dt, vy * dt);
      surface.requestRender();
      inertiaFrame.current = requestAnimationFrame(step);
    };
    if (Math.hypot(vx, vy) >= 0.03) inertiaFrame.current = requestAnimationFrame(step);
  }, [state, surfaceRef]);
  useEffect(() => () => stopInertia(), [stopInertia]);

  // Keep the high-frequency drawing path on native canvas events. This avoids
  // React's synthetic event dispatch in the touch-to-canvas path.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawNative = (event: PointerEvent) => {
      if (moveMode || drawingId.current !== event.pointerId || event.pointerType === "mouse") return;
      const surface = surfaceRef.current;
      const session = sessionRef.current;
      if (!surface || !session) return;
      nativeDrawingPointers.current.add(event.pointerId);
      session.move(surface.eventToWorld(latestPointerEvent(event)), brush());
    };

    const drawRaw = (event: PointerEvent) => {
      if (moveMode || drawingId.current !== event.pointerId || event.pointerType === "mouse") return;
      const surface = surfaceRef.current;
      const session = sessionRef.current;
      if (!surface || !session) return;
      nativeDrawingPointers.current.add(event.pointerId);
      session.move(surface.eventToWorld(event), brush());
    };

    canvas.addEventListener("pointermove", drawNative, { passive: false });
    window.addEventListener("pointerrawupdate", drawRaw);
    return () => {
      canvas.removeEventListener("pointermove", drawNative);
      window.removeEventListener("pointerrawupdate", drawRaw);
    };
  }, [brush, canvasRef, moveMode, sessionRef, surfaceRef]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const surface = surfaceRef.current, session = sessionRef.current; if (!surface || !session) return;
    stopInertia(); const screen = surface.eventToScreen(event.nativeEvent); pointers.current.set(event.pointerId, screen);
    nativeDrawingPointers.current.delete(event.pointerId);
    if (moveMode && pointers.current.size >= 2) { pending.current = null; session.cancel(); drawingId.current = null; panPoint.current = null; velocity.current = { x: 0, y: 0, time: 0 }; resetPinch(); state("pinching"); return; }
    if (moveMode) { session.end(); panPoint.current = screen; velocity.current = { x: 0, y: 0, time: performance.now() }; state("moving"); return; }
    if (pointers.current.size > 1) { pending.current = null; session.cancel(); drawingId.current = null; state("idle"); return; }
    pending.current = null; drawingId.current = event.pointerId;
    const currentBrush = brush();
    if (!session.begin(surface.eventToWorld(event.nativeEvent), currentBrush)) { drawingId.current = null; state("idle"); return; }
    state(currentBrush.eraser ? "eraser" : "drawing");
  }, [brush, moveMode, resetPinch, sessionRef, state, stopInertia, surfaceRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const surface = surfaceRef.current, session = sessionRef.current;
    if (!surface || !session) return;
    const native = event.nativeEvent;
    const pointEvent = latestPointerEvent(native);
    const screen = surface.eventToScreen(pointEvent);
    if (pointers.current.has(native.pointerId)) pointers.current.set(native.pointerId, screen);

    if (moveMode && pointers.current.size >= 2) {
      const value = pinch();
      if (value && pinchDistance.current && pinchCenter.current) {
        surface.camera.zoomAt(pinchCenter.current, value.distance / pinchDistance.current);
        surface.camera.panByScreen(value.center.x - pinchCenter.current.x, value.center.y - pinchCenter.current.y);
      }
      pinchDistance.current = value?.distance ?? null;
      pinchCenter.current = value?.center ?? null;
      surface.requestRender();
      return;
    }
    if (!moveMode && pointers.current.size > 1) return;
    if (moveMode && panPoint.current) {
      const dx = screen.x - panPoint.current.x, dy = screen.y - panPoint.current.y, now = performance.now(), dt = Math.max(1, now - velocity.current.time);
      surface.camera.panByScreen(dx, dy);
      panPoint.current = screen;
      velocity.current = { x: dx / dt, y: dy / dt, time: now };
      surface.requestRender();
      return;
    }
    if (drawingId.current !== native.pointerId || nativeDrawingPointers.current.has(native.pointerId)) return;
    session.move(surface.eventToWorld(pointEvent), brush());
  }, [brush, moveMode, pinch, sessionRef, surfaceRef]);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget, session = sessionRef.current;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointers.current.delete(event.pointerId);
    nativeDrawingPointers.current.delete(event.pointerId);
    if (moveMode && pointers.current.size >= 2) { session?.cancel(); resetPinch(); return; }
    if (pointers.current.size === 1) { pending.current = null; drawingId.current = null; panPoint.current = moveMode ? [...pointers.current.values()][0] : null; velocity.current = { x: 0, y: 0, time: performance.now() }; session?.cancel(); state(moveMode ? "moving" : "idle"); return; }
    pinchDistance.current = null; pinchCenter.current = null; const wasMoving = moveMode && panPoint.current !== null; panPoint.current = null;
    if (drawingId.current === event.pointerId) { session?.end(); onStrokeEnd?.(); } else session?.cancel();
    pending.current = null; drawingId.current = null;
    if (wasMoving) startInertia(); else state("idle");
  }, [moveMode, onStrokeEnd, resetPinch, sessionRef, startInertia, state]);

  const handleWheel = useCallback((event: WheelEvent) => { if (!moveMode) return; event.preventDefault(); const surface = surfaceRef.current; if (!surface) return; stopInertia(); surface.camera.zoomAt(surface.eventToScreen(event), Math.exp(-event.deltaY * 0.0015)); surface.requestRender(); }, [moveMode, stopInertia, surfaceRef]);
  return { handlePointerDown, handlePointerMove, finishPointer, handleWheel };
}
