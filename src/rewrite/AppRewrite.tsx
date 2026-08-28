import { useCallback, useEffect, useMemo, useState } from "react";
import { get, ref, set, onDisconnect } from "firebase/database";
import { db } from "../lib/firebase";
import {
  TOTAL_ROUNDS,
  generateComicId,
  generatePlayerId,
  generateRoomId,
  type Comic,
  type MapType,
} from "./domain";
import { useRoom } from "./useRoom";
import DrawingScreen from "./DrawingScreen";

function readRoomId(): string {
  return window.location.hash.replace("#", "").trim().toUpperCase() || generateRoomId();
}

function readPlayerId(): string {
  const key = "relay_comic_player_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = generatePlayerId();
  sessionStorage.setItem(key, next);
  return next;
}

function AppRewrite() {
  const [roomId, setRoomId] = useState(readRoomId);
  const [playerId] = useState(readPlayerId);
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem("relay_comic_player_name") ?? "");
  const [screen, setScreen] = useState<"game" | "lobby" | "history">("game");
  const [viewingComic, setViewingComic] = useState<Comic | null>(null);

  const roomState = useRoom({ roomId, playerId, playerName });
  const { room, players, isHost, loading, start, submit } = roomState;

  useEffect(() => {
    const handler = () => setRoomId(readRoomId());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace("#", "").toUpperCase() !== roomId) {
      window.location.hash = roomId;
    }
  }, [roomId]);

  const saveName = useCallback(async (name: string) => {
    const next = name.trim().slice(0, 12);
    if (!next) return;
    sessionStorage.setItem("relay_comic_player_name", next);
    setPlayerName(next);
  }, []);

  const joinRoom = useCallback((nextRoom: string) => {
    const normalized = nextRoom.trim().toUpperCase();
    if (!normalized) return;
    window.location.hash = normalized;
  }, []);

  const saveComic = useCallback(async (title: string) => {
    if (!room?.pages) return;
    const id = generateComicId();
    await set(ref(db, `comics/${id}`), {
      id,
      title: title.trim() || "未命名漫畫",
      createdAt: Date.now(),
      pages: room.pages,
    });
  }, [room?.pages]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">載入房間中...</div>;
  }

  if (viewingComic) {
    return <ReviewScreen comic={viewingComic} onBack={() => setViewingComic(null)} readOnly />;
  }

  if (screen === "history") {
    return <HistoryScreen onBack={() => setScreen("lobby")} onOpen={setViewingComic} />;
  }

  if (screen === "game" && room?.phase === "playing") {
    const isMyTurn = room.currentPlayerId === playerId;
    if (isMyTurn) {
      const previousPage = room.currentRound > 1
        ? room.pages?.[String(room.currentRound - 1)] ?? null
        : null;
      return (
        <DrawingScreen
          round={room.currentRound}
          totalRounds={TOTAL_ROUNDS}
          map={room.map}
          playerName={playerName}
          previousPage={previousPage}
          onSubmit={submit}
        />
      );
    }

    const currentPlayer = players.find((player) => player.id === room.currentPlayerId);
    return <WaitingScreen round={room.currentRound} totalRounds={TOTAL_ROUNDS} currentPlayerName={currentPlayer?.name ?? "其他玩家"} />;
  }

  if (screen === "game" && room?.phase === "review") {
    const comic: Comic = {
      id: roomId,
      title: "本局成果",
      createdAt: room.createdAt ?? Date.now(),
      pages: room.pages ?? {},
    };
    return (
      <ReviewScreen
        comic={comic}
        onBack={() => setScreen("lobby")}
        onSave={saveComic}
      />
    );
  }

  return (
    <LobbyScreen
      roomId={roomId}
      playerName={playerName}
      players={players}
      isHost={isHost}
      onSaveName={saveName}
      onJoinRoom={joinRoom}
      onStart={start}
      onHistory={() => setScreen("history")}
    />
  );
}

function LobbyScreen({ roomId, playerName, players, isHost, onSaveName, onJoinRoom, onStart, onHistory }: {
  roomId: string;
  playerName: string;
  players: { id: string; name: string }[];
  isHost: boolean;
  onSaveName: (name: string) => Promise<void> | void;
  onJoinRoom: (roomId: string) => void;
  onStart: (map: MapType) => Promise<void>;
  onHistory: () => void;
}) {
  const [name, setName] = useState(playerName);
  const [roomInput, setRoomInput] = useState("");
  const [map, setMap] = useState<MapType>("earth");
  const [starting, setStarting] = useState(false);
  const named = Boolean(playerName);
  const shareUrl = `${window.location.origin}${window.location.pathname}#${roomId}`;

  const startGame = async () => {
    setStarting(true);
    try { await onStart(map); } finally { setStarting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 py-8">
        <div className="text-center"><h1 className="text-3xl font-black">接力盲盒漫畫</h1><p className="text-sm text-slate-400">多人接力創作，直到最後才看到完整故事</p></div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-400">房間代碼</div>
          <div className="mt-1 flex items-center justify-between gap-3"><strong className="font-mono text-2xl text-sky-400">{roomId}</strong><button onClick={() => navigator.clipboard.writeText(shareUrl)} className="rounded-lg bg-sky-500 px-3 py-2 text-sm">複製連結</button></div>
        </section>

        {!named ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-sm">你的名字</div>
            <div className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 outline-none" placeholder="輸入暱稱" /><button onClick={() => onSaveName(name)} className="rounded-xl bg-sky-500 px-4 py-2">確定</button></div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">目前身份：<strong>{playerName}</strong><button className="ml-3 text-sky-400" onClick={() => { sessionStorage.removeItem("relay_comic_player_name"); window.location.reload(); }}>更改</button></section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm">加入其他房間</div>
          <div className="flex gap-2"><input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 font-mono uppercase outline-none" placeholder="房間代碼" /><button onClick={() => onJoinRoom(roomInput)} className="rounded-xl bg-slate-700 px-4 py-2">加入</button></div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="mb-2 flex justify-between"><span>在線玩家</span><span className="text-green-400">{players.length} 人</span></div><div className="flex flex-wrap gap-2">{players.length ? players.map((player) => <span key={player.id} className="rounded-full bg-slate-800 px-3 py-1 text-sm">{player.name}</span>) : <span className="text-sm text-slate-500">等待玩家加入</span>}</div></section>

        {named && isHost && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm">選擇地圖</div>
            <div className="mb-4 grid grid-cols-2 gap-3"><button onClick={() => setMap("earth")} className={`rounded-xl p-4 ${map === "earth" ? "bg-sky-500" : "bg-slate-800"}`}>地球<br/><span className="text-xs opacity-70">天空與草地</span></button><button onClick={() => setMap("space")} className={`rounded-xl p-4 ${map === "space" ? "bg-purple-600" : "bg-slate-800"}`}>宇宙<br/><span className="text-xs opacity-70">星空與銀河</span></button></div>
            <button disabled={starting || players.length === 0} onClick={startGame} className="w-full rounded-xl bg-green-500 py-3 font-bold disabled:opacity-50">{starting ? "開始中..." : `開始遊戲（${players.length} 人）`}</button>
          </section>
        )}

        {named && !isHost && <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-400">等待房主開始遊戲...</section>}
        <button onClick={onHistory} className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm">歷史漫畫</button>
      </div>
    </div>
  );
}

function WaitingScreen({ round, totalRounds, currentPlayerName }: { round: number; totalRounds: number; currentPlayerName: string }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"><div className="text-6xl">🤫</div><h2 className="mt-5 text-2xl font-black">等待其他玩家接力中...</h2><p className="mt-2 text-slate-400"><strong className="text-white">{currentPlayerName}</strong> 正在作畫</p><div className="mt-8 w-full max-w-xs rounded-2xl bg-white/5 p-5"><div>第 {round}/{totalRounds} 頁</div><div className="mt-3 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-sky-400" style={{ width: `${(round / totalRounds) * 100}%` }} /></div></div><p className="mt-6 text-xs text-slate-500">防偷看模式：目前看不到正在繪製的內容。</p></div>;
}

function ReviewScreen({ comic, onBack, onSave, readOnly = false }: { comic: Comic; onBack: () => void; onSave?: (title: string) => Promise<void>; readOnly?: boolean }) {
  const pageNumbers = useMemo(() => Object.keys(comic.pages).map(Number).sort((a, b) => a - b), [comic.pages]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(comic.title);
  const page = pageNumbers[index];

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try { await onSave(title); alert("已保存到歷史漫畫"); } finally { setSaving(false); }
  };

  return <div className="flex min-h-screen flex-col bg-slate-950 text-white"><header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><button onClick={onBack} className="text-sm text-slate-400">← 返回</button><strong>接力盲盒漫畫</strong>{!readOnly ? <button onClick={save} disabled={saving} className="rounded bg-sky-500 px-3 py-1 text-sm">{saving ? "保存中" : "保存"}</button> : <div />}</header>{!readOnly && <div className="border-b border-white/5 p-3"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none" placeholder="漫畫名稱" /></div>}<main className="flex min-h-0 flex-1 items-center justify-center p-4">{page ? <img src={comic.pages[String(page)]} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" alt={`第 ${page} 頁`} /> : <span className="text-slate-500">沒有頁面</span>}</main><footer className="flex items-center justify-between gap-3 border-t border-white/10 p-4"><button disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="rounded bg-slate-800 px-4 py-2 disabled:opacity-30">上一頁</button><span className="text-sm">{page ?? 0} / {pageNumbers.length}</span><button disabled={index >= pageNumbers.length - 1} onClick={() => setIndex((value) => Math.min(pageNumbers.length - 1, value + 1))} className="rounded bg-slate-800 px-4 py-2 disabled:opacity-30">下一頁</button></footer></div>;
}

function HistoryScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (comic: Comic) => void }) {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void get(ref(db, "comics")).then((snapshot) => {
      const value = snapshot.val() as Record<string, Comic> | null;
      setComics(Object.values(value ?? {}).sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
  }, []);

  return <div className="min-h-screen bg-slate-950 p-4 text-white"><div className="mx-auto max-w-3xl"><header className="mb-6 flex items-center justify-between"><button onClick={onBack} className="text-slate-400">← 返回</button><h1 className="text-xl font-black">歷史漫畫</h1><div /></header>{loading ? <p className="text-center text-slate-500">載入中...</p> : comics.length === 0 ? <p className="text-center text-slate-500">目前沒有已保存的漫畫</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{comics.map((comic) => <button key={comic.id} onClick={() => onOpen(comic)} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left"><div className="aspect-[3/4] bg-slate-900">{comic.pages["1"] && <img src={comic.pages["1"]} className="h-full w-full object-cover" alt="封面" />}</div><div className="p-3"><div className="font-bold">{comic.title}</div><div className="mt-1 text-xs text-slate-500">{new Date(comic.createdAt).toLocaleString()}</div></div></button>)}</div>}</div></div>;
}

export default AppRewrite;
