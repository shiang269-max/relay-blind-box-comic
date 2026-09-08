import { useEffect, useMemo, useState } from "react";
import { onValue, push, ref, set } from "firebase/database";
import { db } from "../../lib/firebase";
import { getTimeOfDay, type MapType, type Player } from "../domain";
import GameAtmosphere from "../visuals/GameAtmosphere";

interface WaitingMessage { id: string; playerId: string; playerName: string; text: string; createdAt: number; }
interface PageMeta { playerId: string; score: number; }
interface Nudge { id: string; senderId: string; senderName: string; text: string; createdAt: number; }
interface WaitingPageProps { gameId: string; playerId: string; players: Player[]; round: number; totalRounds: number | null; modeLabel: string; currentPlayerName: string; map: MapType; }

const NUDGE_LINES = ["外面的人已經等到長草了。", "大家都在等你畫完。", "這張圖是要畫到明年嗎？", "下一棒已經準備好了喔。", "你還活著嗎？", "手速呢？"];

export default function WaitingPage({ gameId, playerId, players, round, totalRounds, modeLabel, currentPlayerName, map }: WaitingPageProps) {
  const progress = totalRounds === null ? null : Math.min(100, (round / totalRounds) * 100);
  const time = getTimeOfDay(round, players.length);
  const [messages, setMessages] = useState<WaitingMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pageScores, setPageScores] = useState<Record<string, PageMeta>>({});

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `waitingMessages/${gameId}`), (snapshot) => {
      const value = snapshot.val() as Record<string, WaitingMessage> | null;
      setMessages(Object.values(value ?? {}).sort((a, b) => a.createdAt - b.createdAt).slice(-24));
    });
    return unsubscribe;
  }, [gameId]);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `relayPageMeta/${gameId}`), (snapshot) => setPageScores((snapshot.val() as Record<string, PageMeta> | null) ?? {}));
    return unsubscribe;
  }, [gameId]);

  useEffect(() => {
    setNudgeSent(false); setMessageSent(false); setMessageText(""); setElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [round, gameId]);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `games/${gameId}/nudge`), (snapshot) => {
      const value = snapshot.val() as Nudge | null;
      if (!value || value.senderId === playerId || value.createdAt < Date.now() - 30_000) return;
      setNudge(value);
      window.setTimeout(() => setNudge(null), 3200);
    });
    return unsubscribe;
  }, [gameId, playerId]);

  const currentPlayer = useMemo(() => players.find((player) => player.name === currentPlayerName), [currentPlayerName, players]);
  const orderedScores = useMemo(() => players.map((player) => {
    const entries = Object.values(pageScores).filter((item) => item.playerId === player.id);
    const score = entries.length ? Math.max(...entries.map((item) => item.score)) : 0;
    return { ...player, score };
  }), [pageScores, players]);

  const sendMessage = async () => {
    const text = messageText.trim().slice(0, 80);
    if (!text || messageSent) return;
    const messageRef = push(ref(db, `waitingMessages/${gameId}`));
    await set(messageRef, { id: messageRef.key ?? `${Date.now()}`, playerId, playerName: players.find((player) => player.id === playerId)?.name ?? "玩家", text, createdAt: Date.now() });
    setMessageText(""); setMessageSent(true);
  };

  const sendNudge = async () => {
    if (elapsed < 30 || nudgeSent || currentPlayer?.id === playerId) return;
    setNudgeSent(true);
    const text = NUDGE_LINES[Math.floor(Math.random() * NUDGE_LINES.length)] ?? NUDGE_LINES[0];
    await set(ref(db, `games/${gameId}/nudge`), { id: `${playerId}-${Date.now()}`, senderId: playerId, senderName: players.find((player) => player.id === playerId)?.name ?? "玩家", text, createdAt: Date.now() });
  };

  const isMyTurn = currentPlayer?.id === playerId;

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-4 text-center text-white">
      <GameAtmosphere map={map} round={round} />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/62 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 text-left">
          <div><div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/45">Relay In Progress</div><h2 className="mt-1 text-2xl font-black tracking-tight">{isMyTurn ? "輪到你了" : `${currentPlayerName} 作畫中`}</h2></div>
          <div className={`turn-light ${isMyTurn ? "turn-light--active" : ""}`} title={isMyTurn ? "輪到你" : "等待中"} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          {orderedScores.map((player) => <div key={player.id} className={`rounded-xl border px-3 py-2 ${player.id === currentPlayer?.id ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-black/15"}`}><div className="flex items-center justify-between gap-2 text-xs font-bold"><span className="truncate">{player.name}</span><span className="text-white/75">{player.score}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/55 transition-[width]" style={{ width: `${Math.min(100, player.score)}%` }} /></div></div>)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/55"><span>{modeLabel} · 第 {round}{totalRounds === null ? "" : `/${totalRounds}`} 回合</span><span>{time === "day" ? "DAY" : time === "dusk" ? "DUSK" : "NIGHT"}</span></div>
        {progress !== null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-sky-300 via-violet-300 to-pink-300 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3 text-left">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-white/65">路過留言</span><span className="text-[10px] text-white/30">每次等待可留一句</span></div>
          <div className="max-h-28 space-y-1 overflow-y-auto pr-1">{messages.length === 0 ? <div className="py-2 text-xs text-white/30">還沒有人亂講話。</div> : messages.map((message) => <div key={message.id} className="text-xs leading-5"><strong className="text-white/60">{message.playerName}：</strong><span className="text-white/80">{message.text}</span></div>)}</div>
          <div className="mt-2 flex gap-2"><input value={messageText} disabled={messageSent} maxLength={80} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder={messageSent ? "這次已留過一句" : "留一句話……"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40" /><button onClick={() => void sendMessage()} disabled={messageSent} className="rounded-xl bg-white/10 px-3 text-xs font-black disabled:opacity-35">{messageSent ? "已留" : "送出"}</button></div>
        </div>
        {!isMyTurn && <button disabled={elapsed < 30 || nudgeSent} onClick={() => void sendNudge()} className="mt-3 w-full rounded-xl border border-amber-200/20 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100 disabled:opacity-35">{elapsed < 30 ? `催一下（${30 - elapsed}s）` : nudgeSent ? "已催過" : "催一下"}</button>}
      </div>
      {nudge && <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4"><div className="rounded-2xl border border-amber-200/30 bg-slate-950/90 px-5 py-3 text-sm font-black text-amber-100 shadow-2xl backdrop-blur-xl">{nudge.text}</div></div>}
    </div>
  );
}
