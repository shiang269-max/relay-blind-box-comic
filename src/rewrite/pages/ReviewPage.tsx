import { useMemo, useState } from "react";
import { type Comic, type MapType } from "../domain";
import GameAtmosphere from "../visuals/GameAtmosphere";

interface ReviewPageProps {
  comic: Comic;
  map: MapType;
  totalPages?: number;
  onBack: () => void;
  onSave?: (title: string) => Promise<void>;
  readOnly?: boolean;
}

export default function ReviewPage({
  comic,
  map,
  totalPages,
  onBack,
  onSave,
  readOnly = false,
}: ReviewPageProps) {
  const pageNumbers = useMemo(() => {
    if (totalPages && totalPages > 0) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    return Object.keys(comic.pages).map(Number).sort((a, b) => a - b);
  }, [comic.pages, totalPages]);

  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [title, setTitle] = useState("");

  const page = pageNumbers[index] ?? index + 1;
  const round = page;
  const pageImage = comic.pages[String(page)] ?? null;

  const save = async () => {
    if (!onSave || saving || saved) return;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setSaveError("請先為這部漫畫命名。");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await onSave(normalizedTitle);
      setSaved(true);
      setSaveDialogOpen(false);
    } catch (reason) {
      console.error("保存漫畫失敗", reason);
      setSaveError("保存失敗，請確認網路後再試一次。");
    } finally {
      setSaving(false);
    }
  };

  const previous = () => setIndex((value) => Math.max(0, value - 1));
  const next = () => setIndex((value) => Math.min(pageNumbers.length - 1, value + 1));

  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-hidden text-white">
      <GameAtmosphere map={map} round={round} />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/45 px-3 py-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-4">
        <button onClick={onBack} className="min-h-11 rounded-2xl px-3 text-sm text-white/65 transition active:scale-[0.98] sm:hover:bg-white/10 sm:hover:text-white">
          ← 返回
        </button>
        <div className="min-w-0 text-center">
          <strong className="block truncate text-sm">接力盲盒漫畫</strong>
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/35">
            {map === "earth" ? "EARTH RELAY" : "UNIVERSE RELAY"}
          </span>
        </div>
        {!readOnly ? (
          <button
            onClick={() => {
              setSaveError(null);
              setSaveDialogOpen(true);
            }}
            disabled={saving || saved}
            className="min-h-11 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 sm:hover:bg-white/20"
          >
            {saved ? "已保存" : "保存"}
          </button>
        ) : <div className="w-[76px]" />}
      </header>

      {saved && !readOnly && (
        <div className="relative z-10 border-b border-emerald-300/15 bg-emerald-950/25 px-3 py-2 text-center text-xs text-emerald-100/85 backdrop-blur-md">
          《{title.trim()}》已保存到漫畫檔案庫。
        </div>
      )}

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
        <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/35 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/45">
            <span>FINAL RELAY</span>
            <span>PAGE {page} / {pageNumbers.length}</span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {pageImage ? (
              <img
                src={pageImage}
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                alt={`第 ${page} 頁`}
              />
            ) : <span className="text-white/40">第 {page} 頁尚未載入完成</span>}
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/45 p-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4">
        <button
          disabled={index === 0}
          onClick={previous}
          className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm active:scale-[0.98] disabled:opacity-30"
        >
          上一頁
        </button>
        <div className="text-center text-xs text-white/50">
          <div className="font-black text-white">{page} / {pageNumbers.length}</div>
          <div className="mt-1 text-[10px] tracking-[0.16em] text-white/30">TAP TO EXPLORE</div>
        </div>
        <button
          disabled={index >= pageNumbers.length - 1}
          onClick={next}
          className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm active:scale-[0.98] disabled:opacity-30"
        >
          下一頁
        </button>
      </footer>

      {!readOnly && saveDialogOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/90 p-5 shadow-2xl"
          >
            <div className="text-lg font-black">為作品命名</div>
            <p className="mt-2 text-sm text-white/55">保存後，這個名稱會顯示在漫畫檔案庫中。</p>
            <input
              autoFocus
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (saveError) setSaveError(null);
              }}
              maxLength={30}
              placeholder="輸入漫畫名稱"
              className="mt-4 min-h-12 w-full rounded-2xl border border-white/15 bg-black/30 px-4 text-base outline-none placeholder:text-white/25 focus:border-white/35"
            />
            {saveError && <p className="mt-2 text-xs text-red-200">{saveError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSaveDialogOpen(false)} disabled={saving} className="min-h-12 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold disabled:opacity-50">
                取消
              </button>
              <button type="submit" disabled={saving} className="min-h-12 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-50">
                {saving ? "保存中..." : "確認保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
