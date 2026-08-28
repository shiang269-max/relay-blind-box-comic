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
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-black">接力盲盒漫畫</h1>
          <p className="text-sm text-slate-400">多人接力創作，直到最後才看到完整故事</p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">房間代碼</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <strong className="font-mono text-2xl text-sky-400">{roomId}</strong>
            <button
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm"
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
                className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 outline-none"
                placeholder="輸入暱稱"
              />
              <button
                onClick={() => void onSaveName(name)}
                className="rounded-xl bg-sky-500 px-4 py-2"
              >
                確定
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            目前身份：<strong>{playerName}</strong>
            <button
              className="ml-3 text-sky-400"
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
              className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 font-mono uppercase outline-none"
              placeholder="房間代碼"
            />
            <button
              onClick={() => onJoinRoom(roomInput)}
              className="rounded-xl bg-slate-700 px-4 py-2"
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
              <span key={player.id} className="rounded-full bg-slate-800 px-3 py-1 text-sm">
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
                className={`rounded-xl p-4 ${map === "earth" ? "bg-sky-500" : "bg-slate-800"}`}
              >
                地球
                <br />
                <span className="text-xs opacity-70">天空與草地</span>
              </button>
              <button
                onClick={() => setMap("space")}
                className={`rounded-xl p-4 ${map === "space" ? "bg-purple-600" : "bg-slate-800"}`}
              >
                宇宙
                <br />
                <span className="text-xs opacity-70">星空與銀河</span>
              </button>
            </div>
            <button
              disabled={starting || players.length === 0}
              onClick={() => void startGame()}
              className="w-full rounded-xl bg-green-500 py-3 font-bold disabled:opacity-50"
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
          className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm"
        >
          歷史漫畫
        </button>
      </div>
    </div>
  );
}
