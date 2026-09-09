import { useCallback, useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "../lib/firebase";
import { generateComicId, type Comic, type Player, type RoomState } from "./domain";
import { leaveRoom, watchRelayPages } from "./data/RoomRepository";
import type { GameState } from "./game/GameState";
import { getGameFlow } from "./game/getGameFlow";
import { getGameMode } from "./game/GameMode";
import DrawingScreen from "./DrawingScreen";
import ReviewPage from "./pages/ReviewPage";
import WaitingPage from "./pages/WaitingPage";

interface GameRouterProps { room: RoomState; game: GameState; players: Player[]; submit: (pageDataUrl: string, score?: number) => Promise<boolean>; roomId: string; playerId: string; playerName: string; onLeaveGame: () => void; }

export default function GameRouter({ game, players, submit, roomId, playerId, playerName, onLeaveGame }: GameRouterProps) {
  const [relayPages, setRelayPages] = useState<Record<string, string>>({});
  const [relayPagesLoaded, setRelayPagesLoaded] = useState(false);
  const [reviewExited, setReviewExited] = useState(false);

  useEffect(() => {
    setRelayPages({});
    setRelayPagesLoaded(false);
    const flow = getGameFlow(game.mode);
    const previousKey = game.phase === "playing" && game.currentPlayerId === playerId
      ? flow.getPreviousDrawingKey({ currentRound: game.currentTurn, currentPlayerId: game.currentPlayerId, playerIds: game.participantIds })
      : null;

    if (game.phase === "review") {
      return watchRelayPages(game.gameId, (nextPages) => { setRelayPages(nextPages); setRelayPagesLoaded(true); });
    }

    if (!previousKey) {
      setRelayPagesLoaded(true);
      return;
    }

    return onValue(ref(db, `relayPages/${game.gameId}/${previousKey}`), (snapshot) => {
      const page = snapshot.val();
      setRelayPages(page && typeof page === "string" ? { [previousKey]: page } : {});
      setRelayPagesLoaded(true);
    });
  }, [game.currentPlayerId, game.currentTurn, game.gameId, game.mode, game.participantIds, game.phase, playerId]);

  useEffect(() => {
    if (game.phase !== "review") setReviewExited(false);
  }, [game.phase]);

  const pages = relayPages;
  const modeId = game.mode;
  const mode = getGameMode(modeId);

  const saveComic = useCallback(async (title: string) => {
    if (modeId !== "relay-30") return;
    const comicId = generateComicId();
    await set(ref(db, `comics/${comicId}`), {
      id: comicId,
      title: title.trim() || "未命名漫畫",
      createdAt: game.completedAt ?? game.createdAt,
      map: game.map,
      pages,
    } satisfies Comic);
  }, [game.completedAt, game.createdAt, game.map, modeId, pages]);

  const leaveGame = useCallback(async () => {
    await leaveRoom(roomId, playerId);
    onLeaveGame();
  }, [onLeaveGame, playerId, roomId]);

  const waitingProps = { gameId: game.gameId, playerId, players, round: game.currentTurn, totalRounds: mode.totalRounds, modeLabel: mode.label, currentPlayerName: players.find((player) => player.id === game.currentPlayerId)?.name ?? "等待玩家重新連線", map: game.map };

  if (game.phase === "playing") {
    const flow = getGameFlow(modeId);
    if (game.currentPlayerId === playerId) {
      if (modeId !== "relay-30") return <WaitingPage {...waitingProps} currentPlayerName="此模式尚未開放" />;
      const previousKey = flow.getPreviousDrawingKey({ currentRound: game.currentTurn, currentPlayerId: game.currentPlayerId, playerIds: game.participantIds });
      if (previousKey && (!relayPagesLoaded || !pages[previousKey])) return <WaitingPage {...waitingProps} currentPlayerName="正在載入上一頁作品" />;
      return <DrawingScreen key={`${game.gameId}:${game.currentTurn}:${game.currentPlayerId}`} mode={mode} roomId={roomId} gameId={game.gameId} pageIndex={Math.max(0, game.currentTurn - 1)} round={game.currentTurn} playerCount={Math.max(1, game.participantIds.length)} map={game.map} playerName={playerName} previousPage={previousKey ? pages[previousKey] ?? null : null} onSubmit={submit} onLeaveGame={leaveGame} />;
    }
    return <WaitingPage {...waitingProps} />;
  }

  if (game.phase === "review") {
    if (modeId !== "relay-30") return <WaitingPage {...waitingProps} currentPlayerName="此模式尚未開放" />;
    if (!relayPagesLoaded) return <WaitingPage {...waitingProps} currentPlayerName="正在載入漫畫成果" />;
    if (reviewExited) {
      return (
        <div className="min-h-[100svh] flex flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
          <div className="text-xl font-black">你已離開這場漫畫</div>
          <div className="text-sm text-white/55">其他玩家仍可繼續欣賞或保存。</div>
          <button type="button" onClick={onLeaveGame} className="min-h-11 rounded-2xl bg-white px-5 text-sm font-black text-slate-950">返回首頁</button>
        </div>
      );
    }
    const comic: Comic = { id: game.gameId, title: "本局成果", createdAt: game.completedAt ?? game.createdAt, map: game.map, pages };
    return <ReviewPage comic={comic} map={game.map} totalPages={mode.totalRounds ?? 30} onBack={() => { void leaveGame().then(() => setReviewExited(true)); }} onSave={saveComic} />;
  }
  return <WaitingPage {...waitingProps} currentPlayerName="等待遊戲狀態" />;
}
