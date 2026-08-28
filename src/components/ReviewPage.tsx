import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import SaveComicModal from './SaveComicModal';

interface ReviewPageProps {
  pages: Record<string, string>;
  totalRounds: number;
  onBackToLobby: () => void;
  onSaveComic?: (title: string) => Promise<void>;
  readOnly?: boolean;
}

export default function ReviewPage({ pages, totalRounds, onBackToLobby, onSaveComic, readOnly }: ReviewPageProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const pageList = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const currentImg = pages[String(currentPage)];

  const goPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goNext = () => setCurrentPage(p => Math.min(totalRounds, p + 1));

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-white/10">
        <button onClick={onBackToLobby} className="p-2 rounded-xl bg-white/5 border border-white/10"><ChevronLeft size={18} /></button>
        <div className="text-center min-w-0"><h1 className="font-black text-lg truncate">漫畫回顧</h1><p className="text-xs text-white/50">第 {currentPage} / {totalRounds} 頁</p></div>
        {!readOnly && onSaveComic ? <button onClick={() => setShowSaveModal(true)} className="p-2 rounded-xl bg-sky-500/20 border border-sky-400/20 text-sky-200"><BookOpen size={18} /></button> : <div className="w-10" />}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-3 gap-4">
        <div className="w-full max-w-3xl aspect-[3/5] rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
          {currentImg ? <img src={currentImg} alt={`第 ${currentPage} 頁`} className="h-full w-full object-contain" /> : <div className="h-full flex items-center justify-center text-white/30">此頁尚無內容</div>}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={goPrev} disabled={currentPage === 1} className="min-h-11 min-w-11 rounded-xl bg-white/10 disabled:opacity-30"><ChevronLeft size={20} /></button>
          <span className="min-w-20 text-center text-sm text-white/70">{currentPage} / {totalRounds}</span>
          <button onClick={goNext} disabled={currentPage === totalRounds} className="min-h-11 min-w-11 rounded-xl bg-white/10 disabled:opacity-30"><ChevronRight size={20} /></button>
        </div>

        <div className="w-full max-w-3xl overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {pageList.map(page => <button key={page} onClick={() => setCurrentPage(page)} className={`min-w-12 min-h-11 rounded-xl px-3 text-xs font-bold border ${page === currentPage ? 'border-sky-300 bg-sky-400/20 text-sky-100' : 'border-white/10 bg-white/5 text-white/50'}`}>{page}</button>)}
          </div>
        </div>
      </main>

      {showSaveModal && onSaveComic && <SaveComicModal onSave={onSaveComic} onClose={() => setShowSaveModal(false)} />}
    </div>
  );
}
