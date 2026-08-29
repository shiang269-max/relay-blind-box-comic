import { useCallback, useEffect, useState } from "react";
import { ref, runTransaction, set } from "firebase/database";
import { db } from "../lib/firebase";
import { generateComicId, type Comic, type Player, type RoomState } from "./domain";
import { closeCurrentGame, leaveRoom, watchRelayPages } from "./data/RoomRepository";
import type { GameState } from "./game/GameState";
import { getGameFlow } from "./game/getGameFlow";
import { getGameMode } from "./game/GameMode";
import DrawingScreen from "./DrawingScreen";
import ReviewPage from "./pages/ReviewPage";
import WaitingPage from "./pages/WaitingPage";

interface GameRouterProps { room: RoomState; game: GameState; players: Player[]; submit: (pageDataUrl: string) => Promise<boolean>; roomId: string; playerId: string; playerName: string; onLeaveGame: () => void; }

export default function GameRouter({ game, players, submit, roomId, playerId, playerName, onLeaveGame }: GameRouterProps) {
  const [relayPages, setRelayPages] = useState<Record<string, string>>({});
  const [relayPagesLoaded, setRelayPagesLoaded] = useState(false);

  useEffect(() => { setRelayPages({}); setRelayPagesLoaded(false); return watchRelayPages(game.gameId, (nextPages) => { setRelayPages(nextPages); setRelayPagesLoaded(true); }); }, [game.gameId]);

  const pages = relayPages;
  const modeId = game.mode;
  const mode = getGameMode(modeId);

  const saveComic = useCallback(async (title: string) => {
    if (modeId !== "relay-30") return;
    const gameSnapshot = await runTransaction(ref(db, `games/${game.gameId}`), (current: GameState | null) => {
      if (!current || current.roomId !== roomId || current.phase !== "review") return;
      if (current.savedComicId) return current;
      return { ...current, savedComicId: generateComicId() } satisfies GameState;
    }, { applyLocally: false });
    const savedGame = gameSnapshot.snapshot.val() as GameState | null;
    const comicId = savedGame?.savedComicId;
    if (!comicId) throw new Error("無法建立漫畫封存識別");
    await set(ref(db, `comics/${comicId}`), { id: comicId, title: title.trim() || "未命名漫畫", createdAt: game.completedAt ?? game.createdAt, map: game.map, pages } satisfies Comic);
  }, [game.completedAt, game.createdAt, game.gameId, game.map, modeId, pages, roomId]);

  const finishGame = useCallback(async () => { await closeCurrentGame(roomId, game.gameId); onLeaveGame(); }, [game.gameId, onLeaveGame, roomId]);
  const leaveGame = useCallback(async () => { await leaveRoom(roomId, playerId); onLeaveGame(); }, [onLeaveGame, playerId, roomId]);

  if (game.phase === "playing") {
    const flow = getGameFlow(modeId);
    if (game.currentPlayerId === playerId) {
      if (modeId !== "relay-30") return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="此模式尚未開放" map={game.map} />;
      const previousKey = flow.getPreviousDrawingKey({ currentRound: game.currentTurn, currentPlayerId: game.currentPlayerId, playerIds: game.participantIds });
      if (previousKey && (!relayPagesLoaded || !pages[previousKey])) return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="正在載入上一頁作品" map={game.map} />;
      return <DrawingScreen mode={mode} roomId={roomId} pageIndex={Math.max(0, game.currentTurn - 1)} round={game.currentTurn} playerCount={Math.max(1, game.participantIds.length)} map={game.map} playerName={playerName} previousPage={previousKey ? pages[previousKey] ?? null : null} onSubmit={submit} onLeaveGame={leaveGame} />;
    }
    const currentPlayer = players.find((player) => player.id === game.currentPlayerId);
    return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName={currentPlayer?.name ?? "等待玩家重新連線"} map={game.map} />;
  }

  if (game.phase === "review") {
    if (modeId !== "relay-30") return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="此模式尚未開放" map={game.map} />;
    if (!relayPagesLoaded) return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="正在載入漫畫成果" map={game.map} />;
    const comic: Comic = { id: game.savedComicId ?? game.gameId, title: "本局成果", createdAt: game.completedAt ?? game.createdAt, map: game.map, pages };
    return <ReviewPage comic={comic} map={game.map} totalPages={mode.totalRounds ?? 30} onBack={finishGame} onSave={saveComic} />;
  }

  return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="等待遊戲狀態" map={game.map} />;
}
