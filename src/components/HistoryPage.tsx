import { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '../lib/firebase';
import type { Comic } from '../lib/gameTypes';
import { BookOpen, Trash2, ArrowLeft, Clock } from 'lucide-react';

interface HistoryPageProps {
  onBack: () => void;
  onView: (comic: Comic) => void;
}

export default function HistoryPage({ onBack, onView }: HistoryPageProps) {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const comicsRef = ref(db, 'comics');
    const unsub = onValue(comicsRef, (snap) => {
      const data = snap.val() as Record<string, Comic> | null;
      if (data) {
        const list = Object.values(data).sort((a, b) => b.createdAt - a.createdAt);
        setComics(list);
      } else {
        setComics([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (comic: Comic) => {
    if (!confirm(`確定要刪除「${comic.title}」嗎？`)) return;
    setDeletingId(comic.id);
    await remove(ref(db, `comics/${comic.id}`));
    setDeletingId(null);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 mt-2">
          <button onClick={onBack} className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
          <div><h1 className="text-white font-black text-xl">歷史漫畫</h1><p className="text-slate-400 text-xs">已保存的接力作品</p></div>
        </div>

        {loading && <div className="text-center py-16 text-slate-400 animate-pulse">載入中...</div>}

        {!loading && comics.length === 0 && (
          <div className="bg-slate-800/60 rounded-2xl p-10 border border-slate-700/50 text-center">
            <BookOpen size={36} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">尚無保存的作品</p>
          </div>
        )}

        {!loading && comics.length > 0 && (
          <div className="flex flex-col gap-3">
            {comics.map(comic => (
              <div key={comic.id} className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-semibold truncate">{comic.title}</p>
                  <div className="flex items-center gap-1 mt-1"><Clock size={11} className="text-slate-500 flex-shrink-0" /><span className="text-slate-500 text-xs">{formatDate(comic.createdAt)}</span></div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => onView(comic)} className="flex items-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-sm font-semibold px-3 py-1.5 rounded-xl border border-sky-500/30 transition-all"><BookOpen size={13} />查看</button>
                  <button onClick={() => handleDelete(comic)} disabled={deletingId === comic.id} className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold px-3 py-1.5 rounded-xl border border-red-500/20 transition-all disabled:opacity-40"><Trash2 size={13} />刪除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
