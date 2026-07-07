import React, { useState } from 'react';
import { Globe, Rocket, ArrowRight, Hash, BookOpen } from 'lucide-react';
import type { MapType } from '../lib/gameTypes';

interface LobbyPageProps {
  roomId: string;
  players: { id: string; name: string }[];
  myId: string;
  isHost: boolean;
  onSetName: (name: string) => void;
  onStartGame: (map: MapType) => void;
  onJoinRoom: (roomId: string) => void;
  currentPhase: 'lobby' | 'playing' | 'review' | null;
  myName: string;
  onViewHistory: () => void;
}

export default function LobbyPage({
  roomId,
  players,
  myId,
  isHost,
  onSetName,
  onStartGame,
  onJoinRoom,
  currentPhase,
  myName,
  onViewHistory,
}: LobbyPageProps) {
  const [nameInput, setNameInput] = useState(myName || '');
  const [selectedMap, setSelectedMap] = useState<MapType>('earth');
  const [roomInput, setRoomInput] = useState('');
  const [nameSet, setNameSet] = useState(!!myName);

  const handleSetName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    onSetName(trimmed);
    setNameSet(true);
  };

  const handleJoin = () => {
    const id = roomInput.trim().toUpperCase();
    if (id) onJoinRoom(id);
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}#${roomId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tight mb-1">接力盲盒漫畫</h1>
          <p className="text-slate-400 text-sm">多人接力創作漫畫遊戲</p>
        </div>

        {/* Room ID */}
        <div className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={16} className="text-sky-400" />
            <span className="text-slate-400 text-xs uppercase tracking-widest">目前房間</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-sky-400">{roomId}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl)}
              className="text-xs bg-sky-500/20 text-sky-400 px-3 py-1 rounded-lg border border-sky-500/30 hover:bg-sky-500/30 transition-colors"
            >
              複製連結
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-1 truncate">{shareUrl}</p>
        </div>

        {/* Name Input */}
        {!nameSet ? (
          <div className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
            <label className="block text-slate-300 text-sm mb-2 font-medium">你的名字</label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-700/60 text-white rounded-xl px-4 py-2.5 outline-none border border-slate-600/50 focus:border-sky-500/60 transition-colors placeholder-slate-500"
                placeholder="輸入暱稱..."
                value={nameInput}
                maxLength={12}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetName()}
              />
              <button
                onClick={handleSetName}
                className="bg-sky-500 hover:bg-sky-400 text-white rounded-xl px-4 py-2.5 font-semibold transition-colors"
              >
                確定
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">你好，<span className="text-white font-semibold">{myName}</span></span>
              <button
                onClick={() => setNameSet(false)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                更改
              </button>
            </div>
          </div>
        )}

        {/* History */}
        <button
          onClick={onViewHistory}
          className="w-full flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 rounded-2xl p-3.5 mb-4 border border-slate-700/50 transition-colors font-semibold text-sm"
        >
          <BookOpen size={16} className="text-sky-400" />
          歷史漫畫
        </button>

        {/* Join different room */}
        <div className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
          <label className="block text-slate-300 text-sm mb-2 font-medium">加入其他房間</label>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-700/60 text-white rounded-xl px-4 py-2.5 outline-none border border-slate-600/50 focus:border-sky-500/60 transition-colors placeholder-slate-500 uppercase tracking-widest font-mono"
              placeholder="房間代碼..."
              value={roomInput}
              maxLength={8}
              onChange={e => setRoomInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button
              onClick={handleJoin}
              className="bg-slate-600 hover:bg-slate-500 text-white rounded-xl px-4 py-2.5 font-semibold transition-colors flex items-center gap-1"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-300 text-sm font-medium">在線玩家</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
              {players.length} 人
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <div
                key={p.id}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${
                  p.id === myId
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    : 'bg-slate-700/40 text-slate-300 border-slate-600/30'
                }`}
              >
                {p.name || '未命名'} {p.id === myId && '(你)'}
              </div>
            ))}
            {players.length === 0 && (
              <span className="text-slate-500 text-sm">等待玩家加入...</span>
            )}
          </div>
        </div>

        {/* Host Controls */}
        {isHost && nameSet && (
          <div className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
            <label className="block text-slate-300 text-sm mb-3 font-medium">選擇地圖</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setSelectedMap('earth')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedMap === 'earth'
                    ? 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                    : 'bg-slate-700/40 border-slate-600/30 text-slate-400 hover:border-slate-500/50'
                }`}
              >
                <Globe size={28} />
                <span className="font-semibold text-sm">地球</span>
                <span className="text-xs opacity-70">草地、藍天</span>
              </button>
              <button
                onClick={() => setSelectedMap('space')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedMap === 'space'
                    ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                    : 'bg-slate-700/40 border-slate-600/30 text-slate-400 hover:border-slate-500/50'
                }`}
              >
                <Rocket size={28} />
                <span className="font-semibold text-sm">宇宙</span>
                <span className="text-xs opacity-70">星空、銀河</span>
              </button>
            </div>
            <button
              onClick={() => onStartGame(selectedMap)}
              disabled={players.length < 1}
              className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl py-3.5 font-bold text-base transition-all shadow-lg shadow-sky-500/20"
            >
              開始遊戲 ({players.length} 人)
            </button>
          </div>
        )}

        {!isHost && nameSet && (
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 text-center">
            <div className="animate-pulse text-slate-400 text-sm">等待房主開始遊戲...</div>
          </div>
        )}

        {!nameSet && (
          <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 text-center">
            <span className="text-slate-500 text-sm">請先輸入你的名字</span>
          </div>
        )}
      </div>
    </div>
  );
}
