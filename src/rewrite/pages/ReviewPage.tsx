import { useMemo, useState } from "react";
import { type Comic, type MapType } from "../domain";
import GameAtmosphere from "../visuals/GameAtmosphere";

interface ReviewPageProps {
  comic: Comic;
  map: MapType;
  onBack: () => void;
  onSave?: (title: string) => Promise<void>;
  readOnly?: boolean;
}

export default function ReviewPage({
  comic,
  map,
  onBack,
  onSave,
  readOnly = false,
}: ReviewPageProps) {
  const pageNumbers = useMemo(
    () => Object.keys(comic.pages).map(Number).sort((a, b) => a - b),
    [comic.pages]
  );
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(comic.title);
  const page = pageNumbers[index];
  const round = page ?? Math.max(1, index + 1);

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(title);
      alert("已保存到歷史漫畫");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden text-white">
      <GameAtmosphere map={map} round={round} />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/45 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="rounded-xl px-2 py-1 text-sm text-white/60 transition hover:bg-white/10 hover:text-white">
          ← 返回
        </button>
        <div className="text-center">
          <strong className="block text-sm">接力盲盒漫畫</strong>
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/35">
            {map === "earth" ? "EARTH RELAY" : "UNIVERSE RELAY"}
          </span>
        </div>
        {!readOnly ? (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-bold transition hover:bg-white/20 disabled:opacity-40"
          >
            {saving ? "保存中" : "保存"}
          </button>
        ) : <div className="w-12" />}
      </header>

      {!readOnly && (
        <div className="relative z-10 border-b border-white/10 bg-slate-950/35 p-3 backdrop-blur-md">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={30}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
            placeholder="為這部漫畫命名"
          />
        </div>
      )}

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
        <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/35 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/45">
            <span>FINAL RELAY</span>
            <span>PAGE {page ?? 0} / {pageNumbers.length}</span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {page ? (
              <img
                src={comic.pages[String(page)]}
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                alt={`第 ${page} 頁`}
              />
            ) : <span className="text-white/40">沒有頁面</span>}
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/45 p-4 backdrop-blur-xl">
        <button
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm disabled:opacity-30"
        >
          上一頁
        </button>
        <div className="text-center text-xs text-white/50">
          <div className="font-black text-white">{page ?? 0} / {pageNumbers.length}</div>
          <div className="mt-1 text-[10px] tracking-[0.16em] text-white/30">SWIPE OR TAP</div>
        </div>
        <button
          disabled={index >= pageNumbers.length - 1}
          onClick={() => setIndex((value) => Math.min(pageNumbers.length - 1, value + 1))}
          className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm disabled:opacity-30"
        >
          下一頁
        </button>
      </footer>
    </div>
  );
}
