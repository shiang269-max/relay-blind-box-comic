import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "../../lib/firebase";
import type { Comic } from "../domain";

interface HistoryPageProps {
  onBack: () => void;
  onOpen: (comic: Comic) => void;
}

export default function HistoryPage({ onBack, onOpen }: HistoryPageProps) {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const snapshot = await get(ref(db, "comics"));
        if (!active) return;

        const value = snapshot.val() as Record<string, Comic> | null;
        const nextComics = Object.values(value ?? {})
          .sort((a, b) => b.createdAt - a.createdAt);

        setComics(nextComics);
      } catch (reason) {
        if (!active) return;
        console.error("載入歷史漫畫失敗", reason);
        setError("歷史漫畫載入失敗，請稍後再試。");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <button onClick={onBack} className="text-slate-400">← 返回</button>
          <h1 className="text-xl font-black">歷史漫畫</h1>
          <div />
        </header>

        {loading && <p className="text-center text-slate-500">載入中...</p>}

        {!loading && error && (
          <p className="text-center text-red-300">{error}</p>
        )}

        {!loading && !error && comics.length === 0 && (
          <p className="text-center text-slate-500">目前沒有已保存的漫畫</p>
        )}

        {!loading && !error && comics.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comics.map((comic) => (
              <button
                key={comic.id}
                onClick={() => onOpen(comic)}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left"
              >
                <div className="aspect-[3/4] bg-slate-900">
                  {comic.pages["1"] && (
                    <img
                      src={comic.pages["1"]}
                      className="h-full w-full object-cover"
                      alt="封面"
                    />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-bold">{comic.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(comic.createdAt).toLocaleString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
