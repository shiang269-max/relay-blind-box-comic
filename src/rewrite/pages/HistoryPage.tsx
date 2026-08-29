import { useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "../../lib/firebase";
import type { Comic, MapType } from "../domain";
import GameAtmosphere from "../visuals/GameAtmosphere";

interface HistoryPageProps {
  onBack: () => void;
  onOpen: (comic: Comic) => void;
}

function getCover(comic: Comic): string | undefined {
  return Object.entries(comic.pages)
    .sort(([a], [b]) => Number(a) - Number(b))
    .find(([, value]) => Boolean(value))?.[1];
}

function getPageCount(comic: Comic): number {
  return Object.values(comic.pages).filter(Boolean).length;
}

function formatCreatedAt(value: number): string {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default function HistoryPage({ onBack, onOpen }: HistoryPageProps) {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedMap, setSelectedMap] = useState<MapType | "all">("all");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const snapshot = await get(ref(db, "comics"));
        if (!active) return;

        const value = snapshot.val() as Record<string, Comic> | null;
        setComics(
          Object.values(value ?? {}).sort(
            (a, b) => b.createdAt - a.createdAt,
          ),
        );
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

  const filteredComics = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();

    return comics.filter((comic) => {
      const matchesKeyword =
        !keyword || comic.title.toLocaleLowerCase().includes(keyword);
      const matchesMap =
        selectedMap === "all" || comic.map === selectedMap;

      return matchesKeyword && matchesMap;
    });
  }, [comics, query, selectedMap]);

  return (
    <div className="relative min-h-[100svh] overflow-hidden text-white">
      <GameAtmosphere
        map={selectedMap === "space" ? "space" : "earth"}
        round={30}
      />

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-4">
        <header className="mb-5 flex items-center justify-between gap-3 rounded-3xl border border-white/15 bg-slate-950/35 px-3 py-3 shadow-2xl backdrop-blur-xl sm:px-4">
          <button onClick={onBack} className="min-h-11 rounded-2xl px-3 text-sm text-white/75 active:scale-[0.98]">← 返回</button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-black tracking-wide sm:text-xl">漫畫檔案庫</h1>
            <p className="mt-0.5 text-[11px] text-white/50">每一局，都是一次接力留下的世界</p>
          </div>
          <div className="w-[72px]" />
        </header>

        <section className="mb-4 rounded-3xl border border-white/15 bg-slate-950/35 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">已保存作品</div>
              <div className="mt-1 text-xs text-white/55">{loading ? "正在整理你的世界..." : `目前收藏 ${comics.length} 部接力漫畫`}</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right">
              <div className="text-lg font-black">{filteredComics.length}</div>
              <div className="text-[10px] text-white/55">ARCHIVES</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/20 p-1.5">
            <button onClick={() => setSelectedMap("all")} className={`min-h-11 rounded-xl text-sm font-bold transition active:scale-[0.98] ${selectedMap === "all" ? "bg-white/15 text-white shadow-lg" : "text-white/65"}`}>全部</button>
            <button onClick={() => setSelectedMap("earth")} className={`min-h-11 rounded-xl text-sm font-bold transition active:scale-[0.98] ${selectedMap === "earth" ? "bg-sky-400 text-slate-950 shadow-lg" : "text-white/65"}`}>地球</button>
            <button onClick={() => setSelectedMap("space")} className={`min-h-11 rounded-xl text-sm font-bold transition active:scale-[0.98] ${selectedMap === "space" ? "bg-violet-400 text-slate-950 shadow-lg" : "text-white/65"}`}>宇宙</button>
          </div>

          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋漫畫名稱" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base outline-none placeholder:text-white/35 focus:border-white/30" />
        </section>

        <section className="flex-1 pb-4">
          {loading && <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-10 text-center text-sm text-white/55 backdrop-blur-xl"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />正在載入漫畫檔案...</div>}
          {!loading && error && <div className="rounded-3xl border border-red-300/20 bg-red-950/30 p-8 text-center text-sm text-red-100 backdrop-blur-xl">{error}</div>}
          {!loading && !error && filteredComics.length === 0 && <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-10 text-center backdrop-blur-xl"><div className="text-lg font-bold">{comics.length === 0 ? "世界還沒有留下作品" : "找不到符合的作品"}</div><p className="mt-2 text-sm text-white/55">{comics.length === 0 ? "完成一場 30 回合接力後，漫畫會出現在這裡。" : "試試不同的漫畫名稱或世界篩選。"}</p></div>}
          {!loading && !error && filteredComics.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filteredComics.map((comic) => {
            const cover = getCover(comic);
            const pageCount = getPageCount(comic);
            return <button key={comic.id} onClick={() => onOpen(comic)} className="group overflow-hidden rounded-3xl border border-white/15 bg-slate-950/45 text-left shadow-xl backdrop-blur-xl transition active:scale-[0.985] sm:hover:-translate-y-1 sm:hover:border-white/30"><div className="relative aspect-[3/4] overflow-hidden bg-black/30">{cover ? <img src={cover} className="h-full w-full object-cover transition duration-500 sm:group-hover:scale-105" alt={`${comic.title} 封面`} /> : <div className="flex h-full items-center justify-center text-sm text-white/35">尚無封面</div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3 pt-10"><div className="flex items-end justify-between gap-2 text-xs text-white/75"><span>{pageCount} 頁</span><span>查看完整漫畫 →</span></div></div></div><div className="p-4"><div className="line-clamp-1 font-black">{comic.title}</div><div className="mt-1 text-xs text-white/50">{formatCreatedAt(comic.createdAt)}</div></div></button>;
          })}</div>}
        </section>
      </main>
    </div>
  );
}
