import { useState } from "react";
import type { MapType, Player } from "../domain";

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
    <div className="min-h-[100svh] bg-slate-950 px-3 py-4 text-white sm:p-4">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col justify-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:gap-4 sm:py-8">
        <div className="px-1 text-center">
          <h1 className="text-2xl font-black sm:text-3xl">接力盲盒漫畫</h1>
          <p className="mt-1 text-sm text-slate-400">多人接力創作，直到最後才看到完整故事</p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">房間代碼</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <strong className="font-mono text-xl text-sky-400 sm:text-2xl">{roomId}</strong>
            <button
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
              className="min-h-11 shrink-0 rounded-xl bg-sky-500 px-4 py-2 text-sm active:scale-[0.98]"
            >
              複製連結
            </button>
          </div>
        </section>

        {!named ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-sm">你的名字</div>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={12}
                className="min-h-11 min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-base outline-none"
                placeholder="輸入暱稱"
              />
              <button
                onClick={() => void onSaveName(name)}
                className="min-h-11 shrink-0 rounded-xl bg-sky-500 px-4 py-2 active:scale-[0.98]"
              >
                確定
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            目前身份：<strong>{playerName}</strong>
            <button
              className="ml-3 min-h-11 text-sky-400"
              onClick={() => {
                sessionStorage.removeItem("relay_comic_player_name");
                window.location.reload();
              }}
            >
              更改
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm">加入其他房間</div>
          <div className="flex gap-2">
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 font-mono text-base uppercase outline-none"
              placeholder="房間代碼"
            />
            <button
              onClick={() => onJoinRoom(roomInput)}
              className="min-h-11 shrink-0 rounded-xl bg-slate-700 px-4 py-2 active:scale-[0.98]"
            >
              加入
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex justify-between">
            <span>在線玩家</span>
            <span className="text-green-400">{players.length} 人</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.length ? players.map((player) => (
              <span key={player.id} className="rounded-full bg-slate-800 px-3 py-1.5 text-sm">
                {player.name}
              </span>
            )) : (
              <span className="text-sm text-slate-500">等待玩家加入</span>
            )}
          </div>
        </section>

        {named && isHost && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm">選擇地圖</div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setMap("earth")}
                className={`min-h-24 rounded-xl p-4 active:scale-[0.98] ${map === "earth" ? "bg-sky-500" : "bg-slate-800"}`}
              >
                地球
                <br />
                <span className="text-xs opacity-70">天空與草地</span>
              </button>
              <button
                onClick={() => setMap("space")}
                className={`min-h-24 rounded-xl p-4 active:scale-[0.98] ${map === "space" ? "bg-purple-600" : "bg-slate-800"}`}
              >
                宇宙
                <br />
                <span className="text-xs opacity-70">星空與銀河</span>
              </button>
            </div>
            <button
              disabled={starting || players.length === 0}
              onClick={() => void startGame()}
              className="min-h-12 w-full rounded-xl bg-green-500 py-3 font-bold active:scale-[0.99] disabled:opacity-50"
            >
              {starting ? "開始中..." : `開始遊戲（${players.length} 人）`}
            </button>
          </section>
        )}

        {named && !isHost && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-400">
            等待房主開始遊戲...
          </section>
        )}

        <button
          onClick={onHistory}
          className="min-h-12 rounded-xl border border-white/10 bg-white/5 py-3 text-sm active:scale-[0.99]"
        >
          歷史漫畫
        </button>
      </div>
    </div>
  );
}
