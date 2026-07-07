import React, { useState, useRef, useEffect } from 'react';
import { X, BookOpen, Check } from 'lucide-react';

interface SaveComicModalProps {
  onSave: (title: string) => Promise<void>;
  onClose: () => void;
}

type State = 'idle' | 'saving' | 'done';

export default function SaveComicModal({ onSave, onClose }: SaveComicModalProps) {
  const [title, setTitle] = useState('');
  const [state, setState] = useState<State>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || state !== 'idle') return;
    setState('saving');
    await onSave(trimmed);
    setState('done');
    setTimeout(onClose, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && state === 'idle') onClose(); }}
    >
      <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-sky-400" />
            <span className="text-white font-bold text-base">保存作品</span>
          </div>
          {state === 'idle' && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {state === 'done' ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <Check size={24} className="text-green-400" />
              </div>
              <p className="text-white font-semibold">已保存！</p>
            </div>
          ) : (
            <>
              <label className="block text-slate-300 text-sm mb-2">作品名稱</label>
              <input
                ref={inputRef}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none border border-slate-600/50 focus:border-sky-500/60 transition-colors placeholder-slate-500 mb-5"
                placeholder="幫這本漫畫取個名字..."
                maxLength={30}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                disabled={state === 'saving'}
              />
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all text-sm font-semibold"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || state === 'saving'}
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-sm transition-all"
                >
                  {state === 'saving' ? '保存中...' : '確認保存'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
