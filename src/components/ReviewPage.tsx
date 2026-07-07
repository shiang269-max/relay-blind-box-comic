import React, { useState } from 'react';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-black/30 backdrop-blur-sm border-b border-white/5">
        <button
          onClick={onBackToLobby}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← 返回
        </button>
        <div className="text-center">
          <h1 className="text-white font-black text-lg">接力盲盒漫畫</h1>
          <p className="text-slate-400 text-xs">完成！共 {totalRounds} 頁</p>
        </div>
        {!readOnly ? (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-sm font-semibold px-3 py-1.5 rounded-xl border border-sky-500/30 transition-all"
          >
            <BookOpen size={14} />
            保存
          </button>
        ) : <div />}
      </div>

      {/* Page indicator thumbnails */}
      <div className="flex gap-1.5 px-4 py-3 overflow-x-auto scrollbar-hide bg-black/20">
        {pageList.map(p => (
          <button
            key={p}
            onClick={() => setCurrentPage(p)}
            className={`flex-shrink-0 w-10 h-12 rounded-lg overflow-hidden border-2 transition-all ${
              p === currentPage ? 'border-sky-400 scale-110' : 'border-slate-700/50 opacity-60 hover:opacity-80'
            }`}
          >
            {pages[String(p)] ? (
              <img src={pages[String(p)]} className="w-full h-full object-cover" alt={`page ${p}`} />
            ) : (
              <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                <span className="text-slate-500 text-xs">{p}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="relative w-full max-w-sm">
          <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10">
            {currentPage} / {totalRounds}
          </div>

          {currentImg ? (
            <img
              src={currentImg}
              alt={`第 ${currentPage} 頁`}
              className="w-full rounded-2xl shadow-2xl border border-white/10"
            />
          ) : (
            <div className="w-full aspect-[4/5] rounded-2xl bg-slate-800 border border-slate-700/50 flex flex-col items-center justify-center gap-3">
              <div className="text-4xl">🖼️</div>
              <span className="text-slate-400 text-sm">此頁尚無圖片</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/20 border-t border-white/5"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={goPrev}
          disabled={currentPage === 1}
          className="flex items-center gap-2 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 text-white px-5 py-3 rounded-xl font-semibold transition-all active:scale-95"
        >
          <ChevronLeft size={18} />
          上一頁
        </button>

        <div className="flex gap-1">
          {pageList.map(p => (
            <div
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`rounded-full transition-all cursor-pointer ${
                p === currentPage ? 'w-4 h-2 bg-sky-400' : 'w-2 h-2 bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentPage === totalRounds}
          className="flex items-center gap-2 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 text-white px-5 py-3 rounded-xl font-semibold transition-all active:scale-95"
        >
          下一頁
          <ChevronRight size={18} />
        </button>
      </div>

      {showSaveModal && onSaveComic && (
        <SaveComicModal
          onSave={onSaveComic}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
