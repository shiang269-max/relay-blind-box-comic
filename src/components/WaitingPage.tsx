import React from 'react';
import { getTimeOfDay, getBackgroundStyle } from '../lib/gameTypes';
import type { MapType } from '../lib/gameTypes';

interface WaitingPageProps {
  round: number;
  totalRounds: number;
  map: MapType;
  currentPlayerName: string;
}

export default function WaitingPage({ round, totalRounds, map, currentPlayerName }: WaitingPageProps) {
  const timeOfDay = getTimeOfDay(round);
  const bgStyle = getBackgroundStyle(map, timeOfDay);

  const dots = Array.from({ length: 3 });

  return (
    <div className={`min-h-screen ${bgStyle} flex flex-col items-center justify-center p-6 select-none`}>
      {/* Decorative orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-white/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-white/5 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative text-center max-w-xs">
        {/* Shushing face */}
        <div className="text-7xl mb-6 animate-bounce" style={{ animationDuration: '2s' }}>
          🤫
        </div>

        <h2 className="text-white text-2xl font-black mb-2 drop-shadow-lg">
          等待其他玩家接力中...
        </h2>

        <p className="text-white/70 text-sm mb-6">
          <span className="font-semibold text-white/90">{currentPlayerName}</span> 正在作畫
        </p>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mb-8">
          {dots.map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-white/60"
              style={{
                animation: 'bounce 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* Round indicator */}
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
          <div className="text-white/50 text-xs uppercase tracking-widest mb-1">進度</div>
          <div className="text-white font-bold text-lg">
            第 {round} / {totalRounds} 頁
          </div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/50 rounded-full transition-all duration-700"
              style={{ width: `${((round - 1) / totalRounds) * 100}%` }}
            />
          </div>
        </div>

        <p className="text-white/40 text-xs mt-6">
          請耐心等待，不能偷看喔 🙈
        </p>
      </div>
    </div>
  );
}
