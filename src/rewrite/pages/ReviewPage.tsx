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
  const [title, setTitle] = useState(comic.title);
  const page = pageNumbers[index] ?? index + 1;
  const round = page;
  const pageImage = comic.pages[String(page)] ?? null;

  const save = async () => {
    if (!onSave || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      await onSave(title);
      setSaved(true);
    } catch (reason) {
      console.error("保存漫畫失敗", reason);
      setSaveError("保存失敗，請確認網路後再試一次。");
    } finally {
      setSaving(false);
    }
  };

  const previous = () => {
    setIndex((value) => Math.max(0, value - 1));
  };

  const next = () => {
    setIndex((value) => Math.min(pageNumbers.length - 1, value + 1));
  };

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
            onClick={save}
            disabled={saving || saved}
            className="min-h-11 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 sm:hover:bg-white/20"
          >
            {saving ? "保存中" : saved ? "已保存" : "保存"}
          </button>
        ) : <div className="w-[76px]" />}
      </header>

      {!readOnly && (
        <div className="relative z-10 border-b border-white/10 bg-slate-950/35 p-3 backdrop-blur-md">
          <input
            value={title}
            disabled={saved}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={30}
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25 disabled:opacity-60"
            placeholder="為這部漫畫命名"
          />
          {saved && <p className="mt-2 text-center text-xs text-emerald-200/80">這場接力已經正式封存到漫畫檔案庫。</p>}
          {saveError && <p className="mt-2 text-center text-xs text-red-200">保存失敗，請確認網路後再試一次。</p>}
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
    </div>
  );
}
