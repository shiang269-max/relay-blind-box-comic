# Engine2 Specification

## Goal

Engine2 is a brand new drawing engine.

It must completely replace the old DrawingPage drawing architecture in the future.

Every module has only one responsibility.

No module may perform another module's job.

---

# Architecture

DrawingPage (React UI)
        │
        ▼
DrawingEngine
        │
 ┌──────┼────────┬────────┐
 ▼      ▼        ▼        ▼
Camera Renderer Pointer Coordinate

---

# Module Responsibilities

## DrawingEngine

Responsible for:

- Drawing lifecycle
- Drawing state
- Brush state
- Eraser state
- Calling Renderer
- Calling Camera
- Calling Pointer

Must NOT:

- Access DOM
- Access React
- Access Firebase
- Use CanvasRenderingContext2D directly
- Perform coordinate math

---

## Renderer

Responsible for:

- CanvasRenderingContext2D
- Drawing lines
- Drawing circles
- Erasing
- Clearing canvas

Must NOT:

- Store drawing state
- Know Camera
- Know React
- Know Pointer

---

## Camera

Responsible for:

- Camera position
- Zoom
- Visible area

Must NOT:

- Draw
- Access Canvas
- Access React

---

## Pointer

Responsible for:

- Pointer position
- Screen → Canvas conversion

Must NOT:

- Draw
- Store brush
- Know Camera internals

---

## Coordinate

Responsible for:

- Coordinate conversion
- Pure math

Must NOT:

- Draw
- Access DOM
- Access React

---

# Design Rules

Every class should have one responsibility.

Dependencies should always point downward.

DrawingPage
    ↓
DrawingEngine
    ↓
Renderer / Camera / Pointer / Coordinate

Never reverse the dependency direction.

---

# Future Features

Engine2 should support:

- Undo
- Redo
- Infinite Canvas
- Layers
- AI Drawing
- Touch Gesture
- Pinch Zoom
- Virtual Camera
- Large Canvas Optimization

These features must not require rewriting the architecture.