interface WaitingPageProps {
  round: number;
  totalRounds: number | null;
  modeLabel: string;
  currentPlayerName: string;
}

export default function WaitingPage({
  round,
  totalRounds,
  modeLabel,
  currentPlayerName,
}: WaitingPageProps) {
  const progress = totalRounds === null
    ? null
    : Math.min(100, (round / totalRounds) * 100);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
      <div className="text-6xl">🤫</div>
      <h2 className="mt-5 text-2xl font-black">等待其他玩家接力中...</h2>
      <p className="mt-2 text-slate-400">
        <strong className="text-white">{currentPlayerName}</strong> 正在作畫
      </p>
      <div className="mt-8 w-full max-w-xs rounded-2xl bg-white/5 p-5">
        <div className="text-xs text-slate-400">{modeLabel}</div>
        <div className="mt-1">
          {totalRounds === null
            ? `第 ${round} 回合`
            : `第 ${round}/${totalRounds} 頁`}
        </div>
        {progress !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-sky-400" style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="mt-6 text-xs text-slate-500">
          防偷看模式：目前看不到正在繪製的內容。
        </p>
      </div>
    </div>
  );
}
