import { useState } from "react";
import type { MapType, Player } from "../domain";
import GameAtmosphere from "../visuals/GameAtmosphere";

interface LobbyPageProps {
  roomId: string;
  playerName: string;
  players: Player[];
  isHost: boolean;
  onSaveName: (name: string) => Promise<void> | void;
  onJoinRoom: (roomId: string) => void;
  onStart: (map: MapType) => Promise<void>;
  onHistory: () => void;
}

export default function LobbyPage({
  roomId,
  playerName,
  players,
  isHost,
  onSaveName,
  onJoinRoom,
  onStart,
  onHistory,
}: LobbyPageProps) {
  const [name, setName] = useState(playerName);
  const [roomInput, setRoomInput] = useState("");
  const [map, setMap] = useState<MapType>("earth");
  const [starting, setStarting] = useState(false);

  const named = Boolean(playerName.trim());
  const shareUrl = `${window.location.origin}${window.location.pathname}#${roomId}`;

  const startGame = async () => {
    setStarting(true);
    try {
      await onStart(map);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-slate-950 text-white">
      <GameAtmosphere map={map} round={1} />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/20" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-lg flex-col justify-center gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:gap-4 sm:px-4 sm:py-8">
        <div className="px-2 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/30 px-3 py-1 text-[11px] tracking-[0.2em] text-white/70 backdrop-blur-md">
            RELAY COMIC WORLD
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">接力盲盒漫畫</h1>
          <p className="mt-2 text-sm leading-6 text-white/65">多人接力創作，在未知中把故事推向最後一頁</p>
        </div>

        <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-white/50">目前房間</div>
              <strong className="mt-1 block font-mono text-2xl tracking-wider text-sky-200">{roomId}</strong>
            </div>
            <button
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
              className="min-h-11 shrink-0 rounded-2xl border border-sky-200/20 bg-sky-400/20 px-4 py-2 text-sm font-bold text-sky-50 backdrop-blur-md active:scale-[0.98]"
            >
              複製連結
            </button>
          </div>
        </section>

        {!named ? (
          <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
            <div className="mb-2 text-sm font-bold">你的名字</div>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={12}
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-base outline-none placeholder:text-white/30 focus:border-sky-300/50"
                placeholder="輸入暱稱"
              />
              <button
                onClick={() => void onSaveName(name)}
                className="min-h-11 shrink-0 rounded-2xl bg-sky-400 px-4 py-2 font-bold text-slate-950 active:scale-[0.98]"
              >
                確定
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-4 text-sm shadow-xl shadow-black/10 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <span>目前身份：<strong className="text-white">{playerName}</strong></span>
              <button
                className="min-h-11 rounded-xl px-2 text-sky-200"
                onClick={() => {
                  sessionStorage.removeItem("relay_comic_player_name");
                  window.location.reload();
                }}
              >
                更改
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="mb-2 text-sm font-bold">加入其他房間</div>
          <div className="flex gap-2">
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-base uppercase outline-none placeholder:text-white/30 focus:border-sky-300/50"
              placeholder="房間代碼"
            />
            <button
              onClick={() => onJoinRoom(roomInput)}
              className="min-h-11 shrink-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 active:scale-[0.98]"
            >
              加入
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">在線玩家</div>
              <div className="mt-1 text-xs text-white/45">接力順序會在開始時決定</div>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/15 px-3 py-1.5 text-sm text-emerald-200">{players.length} 人</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.length ? players.map((player) => (
              <span key={player.id} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm backdrop-blur-md">
                {player.name}
              </span>
            )) : (
              <span className="text-sm text-white/45">等待玩家加入</span>
            )}
          </div>
        </section>

        {named && isHost && (
          <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
            <div className="mb-1 text-sm font-bold">選擇遊戲世界</div>
            <p className="mb-4 text-xs leading-5 text-white/45">選擇後會決定整場遊戲與回顧流程的環境視覺。</p>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setMap("earth")}
                className={`min-h-32 rounded-3xl border p-4 text-left transition active:scale-[0.98] ${map === "earth" ? "border-sky-200/50 bg-sky-300/20 shadow-lg shadow-sky-950/20" : "border-white/10 bg-black/20"}`}
              >
                <div className="text-2xl">🌍</div>
                <div className="mt-4 font-black">地球</div>
                <div className="mt-1 text-xs leading-5 text-white/55">大氣、地平線與日夜循環</div>
              </button>
              <button
                onClick={() => setMap("space")}
                className={`min-h-32 rounded-3xl border p-4 text-left transition active:scale-[0.98] ${map === "space" ? "border-purple-200/50 bg-purple-400/20 shadow-lg shadow-purple-950/20" : "border-white/10 bg-black/20"}`}
              >
                <div className="text-2xl">🪐</div>
                <div className="mt-4 font-black">宇宙</div>
                <div className="mt-1 text-xs leading-5 text-white/55">星群、星雲與深空漂移</div>
              </button>
            </div>

            <button
              disabled={starting || players.length === 0}
              onClick={() => void startGame()}
              className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-300 to-sky-300 px-4 py-3 font-black text-slate-950 shadow-lg shadow-emerald-950/30 active:scale-[0.99] disabled:opacity-50"
            >
              {starting ? "正在建立遊戲世界..." : `開始遊戲（${players.length} 人）`}
            </button>
          </section>
        )}

        {named && !isHost && (
          <section className="rounded-3xl border border-white/15 bg-slate-950/35 p-5 text-center text-sm text-white/65 shadow-xl shadow-black/10 backdrop-blur-xl">
            <div className="text-2xl">⏳</div>
            <div className="mt-3 font-bold text-white">等待房主開始遊戲</div>
            <p className="mt-1 text-xs leading-5 text-white/45">世界建立完成後，會依序進入接力流程。</p>
          </section>
        )}

        <button
          onClick={onHistory}
          className="min-h-12 rounded-2xl border border-white/15 bg-slate-950/25 py-3 text-sm text-white/70 backdrop-blur-md active:scale-[0.99]"
        >
          查看歷史漫畫
        </button>
      </div>
    </div>
  );
}
