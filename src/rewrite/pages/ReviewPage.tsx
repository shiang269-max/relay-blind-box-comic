import { useMemo, useState } from "react";
import type { Comic } from "../domain";

interface ReviewPageProps {
  comic: Comic;
  onBack: () => void;
  onSave?: (title: string) => Promise<void>;
  readOnly?: boolean;
}

export default function ReviewPage({
  comic,
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button onClick={onBack} className="text-sm text-slate-400">← 返回</button>
        <strong>接力盲盒漫畫</strong>
        {!readOnly ? (
          <button onClick={save} disabled={saving} className="rounded bg-sky-500 px-3 py-1 text-sm">
            {saving ? "保存中" : "保存"}
          </button>
        ) : <div />}
      </header>

      {!readOnly && (
        <div className="border-b border-white/5 p-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={30}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none"
            placeholder="漫畫名稱"
          />
        </div>
      )}

      <main className="flex min-h-0 flex-1 items-center justify-center p-4">
        {page ? (
          <img src={comic.pages[String(page)]} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" alt={`第 ${page} 頁`} />
        ) : <span className="text-slate-500">沒有頁面</span>}
      </main>

      <footer className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
        <button disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="rounded bg-slate-800 px-4 py-2 disabled:opacity-30">上一頁</button>
        <span className="text-sm">{page ?? 0} / {pageNumbers.length}</span>
        <button disabled={index >= pageNumbers.length - 1} onClick={() => setIndex((value) => Math.min(pageNumbers.length - 1, value + 1))} className="rounded bg-slate-800 px-4 py-2 disabled:opacity-30">下一頁</button>
      </footer>
    </div>
  );
}
