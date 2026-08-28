import { getTimeOfDay, type MapType } from "../domain";
import GameAtmosphere from "../visuals/GameAtmosphere";

interface WaitingPageProps {
  round: number;
  totalRounds: number | null;
  modeLabel: string;
  currentPlayerName: string;
  map: MapType;
}

export default function WaitingPage({
  round,
  totalRounds,
  modeLabel,
  currentPlayerName,
  map,
}: WaitingPageProps) {
  const progress = totalRounds === null
    ? null
    : Math.min(100, (round / totalRounds) * 100);
  const time = getTimeOfDay(round);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6 text-center text-white">
      <GameAtmosphere map={map} round={round} />

      <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/15 bg-slate-950/55 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-3xl shadow-lg">
          🤫
        </div>
        <div className="mt-5 text-[11px] font-black uppercase tracking-[0.28em] text-white/45">
          Relay In Progress
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight">等待接力中...</h2>
        <p className="mt-2 text-sm leading-6 text-white/60">
          <strong className="text-white">{currentPlayerName}</strong> 正在創作下一段故事
        </p>

        <div className="mt-7 rounded-2xl border border-white/10 bg-black/15 p-4 text-left">
          <div className="flex items-center justify-between gap-4 text-xs text-white/50">
            <span>{modeLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-bold text-white/70">
              {time === "day" ? "DAY" : time === "dusk" ? "DUSK" : "NIGHT"}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-black tracking-tight">
                {round}
                <span className="ml-1 text-base text-white/35">/ {totalRounds ?? "∞"}</span>
              </div>
              <div className="mt-1 text-xs text-white/45">目前回合</div>
            </div>
            <div className="text-right text-xs leading-5 text-white/40">
              {map === "earth" ? "EARTH" : "UNIVERSE"}
              <br />
              世界持續變化中
            </div>
          </div>

          {progress !== null && (
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-300 via-violet-300 to-pink-300 transition-[width] duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <p className="mt-5 text-xs leading-5 text-white/35">
          防偷看模式已啟用。正在繪製的內容會在完成前保持隱藏。
        </p>
      </div>
    </div>
  );
}
