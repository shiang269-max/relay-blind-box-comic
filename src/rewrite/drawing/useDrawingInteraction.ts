import { useCallback, useEffect, useRef } from "react";
import type { DrawingSession } from "./DrawingSession";
import type { DrawingSurface, Brush } from "./DrawingSurface";

type ScreenPoint = { x: number; y: number };
type InteractionState = "idle" | "drawing" | "moving" | "pinching" | "eraser";
interface Options { surfaceRef: React.RefObject<DrawingSurface | null>; sessionRef: React.RefObject<DrawingSession | null>; brush: () => Brush; moveMode: boolean; onStrokeEnd?: () => void; onInteractionChange?: (state: InteractionState) => void; }

function latestPointerEvent(event: PointerEvent): PointerEvent {
  const coalesced = event.getCoalescedEvents?.();
  return coalesced && coalesced.length > 0 ? coalesced[coalesced.length - 1] : event;
}

export function useDrawingInteraction({ surfaceRef, sessionRef, brush, moveMode, onStrokeEnd, onInteractionChange }: Options) {
  const pointers = useRef(new Map<number, ScreenPoint>());
  const drawingId = useRef<number | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const pinchCenter = useRef<ScreenPoint | null>(null);
  const panPoint = useRef<ScreenPoint | null>(null);
  const velocity = useRef({ x: 0, y: 0, time: 0 });
  const inertiaFrame = useRef<number | null>(null);
  const state = useCallback((value: InteractionState) => onInteractionChange?.(value), [onInteractionChange]);
  const setInteraction = useCallback((active: boolean) => surfaceRef.current?.setInteractionActive(active), [surfaceRef]);
  const stopInertia = useCallback(() => { if (inertiaFrame.current !== null) cancelAnimationFrame(inertiaFrame.current); inertiaFrame.current = null; velocity.current = { x: 0, y: 0, time: 0 }; }, []);
  const pinch = useCallback(() => { const values = [...pointers.current.values()]; if (values.length < 2) return null; const [a, b] = values; return { distance: Math.hypot(a.x - b.x, a.y - b.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }, []);
  const resetPinch = useCallback(() => { const value = pinch(); pinchDistance.current = value?.distance ?? null; pinchCenter.current = value?.center ?? null; }, [pinch]);

  const startInertia = useCallback(() => {
    let vx = velocity.current.x, vy = velocity.current.y, last = performance.now();
    const surface = surfaceRef.current;
    if (!surface || Math.hypot(vx, vy) < 0.03) return;
    setInteraction(true);
    const step = (now: number) => {
      const current = surfaceRef.current;
      if (!current || pointers.current.size > 0) { inertiaFrame.current = null; setInteraction(false); return; }
      const dt = Math.min(32, Math.max(1, now - last));
      last = now;
      const decay = Math.pow(0.92, dt / 16.67);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) < 0.03) { inertiaFrame.current = null; setInteraction(false); state("idle"); return; }
      current.camera.panByScreen(vx * dt, vy * dt);
      current.requestRender();
      inertiaFrame.current = requestAnimationFrame(step);
    };
    inertiaFrame.current = requestAnimationFrame(step);
  }, [setInteraction, state, surfaceRef]);
  useEffect(() => () => { stopInertia(); setInteraction(false); }, [setInteraction, stopInertia]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const surface = surfaceRef.current, session = sessionRef.current; if (!surface || !session) return;
    stopInertia(); const screen = surface.eventToScreen(event.nativeEvent); pointers.current.set(event.pointerId, screen);
    if (moveMode && pointers.current.size >= 2) { session.cancel(); drawingId.current = null; panPoint.current = null; velocity.current = { x: 0, y: 0, time: 0 }; resetPinch(); setInteraction(true); state("pinching"); return; }
    if (moveMode) { session.end(); panPoint.current = screen; velocity.current = { x: 0, y: 0, time: performance.now() }; setInteraction(true); state("moving"); return; }
    if (pointers.current.size > 1) { session.cancel(); drawingId.current = null; state("idle"); return; }
    drawingId.current = event.pointerId;
    if (!session.begin(surface.eventToWorld(event.nativeEvent), brush())) { drawingId.current = null; state("idle"); return; }
    setInteraction(true);
    state(brush().eraser ? "eraser" : "drawing");
  }, [brush, moveMode, resetPinch, sessionRef, setInteraction, state, stopInertia, surfaceRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); const surface = surfaceRef.current, session = sessionRef.current; if (!surface || !session) return;
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
      state("pinching");
      surface.requestRender();
      return;
    }
    if (!moveMode && pointers.current.size > 1) return;
    if (moveMode && panPoint.current) {
      const dx = screen.x - panPoint.current.x, dy = screen.y - panPoint.current.y, now = performance.now(), dt = Math.max(1, now - velocity.current.time);
      surface.camera.panByScreen(dx, dy);
      panPoint.current = screen;
      velocity.current = { x: dx / dt, y: dy / dt, time: now };
      state("moving");
      surface.requestRender();
      return;
    }
    if (drawingId.current !== native.pointerId) return;
    session.move(surface.eventToWorld(pointEvent), brush());
    state(brush().eraser ? "eraser" : "drawing");
  }, [brush, moveMode, pinch, sessionRef, state, surfaceRef]);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget, session = sessionRef.current;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (moveMode && pointers.current.size >= 2) { session?.cancel(); resetPinch(); return; }
    if (pointers.current.size === 1) {
      drawingId.current = null;
      panPoint.current = moveMode ? [...pointers.current.values()][0] : null;
      velocity.current = { x: 0, y: 0, time: performance.now() };
      session?.cancel();
      state(moveMode ? "moving" : "idle");
      if (!moveMode) setInteraction(false);
      return;
    }
    pinchDistance.current = null; pinchCenter.current = null;
    const wasMoving = moveMode && panPoint.current !== null;
    panPoint.current = null;
    const wasDrawing = drawingId.current === event.pointerId;
    if (wasDrawing) { session?.end(); onStrokeEnd?.(); }
    else session?.cancel();
    drawingId.current = null;
    if (wasMoving) startInertia(); else { setInteraction(false); state("idle"); }
  }, [moveMode, onStrokeEnd, resetPinch, sessionRef, setInteraction, startInertia, state]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!moveMode) return;
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;
    stopInertia();
    surface.camera.zoomAt(surface.eventToScreen(event), Math.exp(-event.deltaY * 0.0015));
    surface.requestRender();
  }, [moveMode, stopInertia, surfaceRef]);

  return { handlePointerDown, handlePointerMove, finishPointer, handleWheel };
}
