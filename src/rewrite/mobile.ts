export function isPrimaryPointerCoarse(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(pointer: coarse)").matches;
}

export function getSafeViewportHeight(): number {
  if (typeof window === "undefined") return 0;

  return window.visualViewport?.height ?? window.innerHeight;
}
