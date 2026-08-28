import { get, ref, remove, set } from "firebase/database";
import { db } from "../../lib/firebase";
import type { SerializedStroke } from "../drawing/StrokeCodec";
import type { DrawingPersistence } from "../modes/DrawingPersistence";

/**
 * Firebase Realtime Database 的外層持久化實作。
 *
 * 不接受 Firebase 路徑由 Drawing Engine 組裝。
 * mode adapter 傳入 scope，這裡只負責把 scope 安全映射到資料庫節點。
 */
export class FirebaseDrawingPersistence implements DrawingPersistence {
  constructor(
    private readonly rootPath = "drawingSnapshots"
  ) {}

  async load(scope: string): Promise<SerializedStroke[]> {
    const snapshot = await get(ref(db, this.pathFor(scope)));

    if (!snapshot.exists()) {
      return [];
    }

    const value: unknown = snapshot.val();
    return normalizeSerializedStrokes(value);
  }

  async save(
    scope: string,
    strokes: readonly SerializedStroke[]
  ): Promise<void> {
    await set(
      ref(db, this.pathFor(scope)),
      strokes.map((stroke) => structuredClone(stroke))
    );
  }

  async clear(scope: string): Promise<void> {
    await remove(ref(db, this.pathFor(scope)));
  }

  private pathFor(scope: string): string {
    const normalized = scope.trim();

    if (!normalized) {
      throw new Error("繪圖資料 scope 不可為空");
    }

    // Firebase RTDB key 禁止 . # $ [ ] /；scope 僅允許由 mode adapter 產生。
    if (/[.#$\[\]/]/.test(normalized)) {
      throw new Error("繪圖資料 scope 含有不允許的 Firebase 路徑字元");
    }

    return `${this.rootPath}/${normalized}`;
  }
}

function normalizeSerializedStrokes(value: unknown): SerializedStroke[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is SerializedStroke => isRecord(item));
  }

  // RTDB 若未來改為以 stroke id 為 key 的物件，也能安全讀取。
  if (isRecord(value)) {
    return Object.values(value).filter((item): item is SerializedStroke => isRecord(item));
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
