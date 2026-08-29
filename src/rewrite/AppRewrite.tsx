import { useCallback, useEffect, useState } from "react";
import { generatePlayerId, generateRoomId, type Comic } from "./domain";
import { getSafeViewportHeight } from "./mobile";
import { useRoom } from "./useRoom";
import GameRouter from "./GameRouter";
import LobbyPage from "./pages/LobbyPage";
import ReviewPage from "./pages/ReviewPage";
import HistoryPage from "./pages/HistoryPage";

interface RoomTarget { id: string; createIfMissing: boolean; }
const PLAYER_ID_KEY = "relay_comic_player_id";
const PLAYER_NAME_KEY = "relay_comic_player_name";

function readRoomTarget(): RoomTarget {
  const fromHash = window.location.hash.replace("#", "").trim().toUpperCase();
  return fromHash ? { id: fromHash, createIfMissing: false } : { id: generateRoomId(), createIfMissing: true };
}
function readPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const next = generatePlayerId();
  localStorage.setItem(PLAYER_ID_KEY, next);
  return next;
}
function readPlayerName(): string { return localStorage.getItem(PLAYER_NAME_KEY) ?? ""; }

function AppRewrite() {
  const [roomTarget, setRoomTarget] = useState<RoomTarget>(readRoomTarget);
  const { id: roomId, createIfMissing } = roomTarget;
  const [playerId] = useState(readPlayerId);
  const [playerName, setPlayerName] = useState(readPlayerName);
  const [screen, setScreen] = useState<"game" | "lobby" | "history">("game");
  const [viewingComic, setViewingComic] = useState<Comic | null>(null);
  const [viewportHeight, setViewportHeight] = useState(getSafeViewportHeight);

  const { room, game, players, isHost, loading, start, submit, restart } = useRoom({
    roomId, playerId, playerName, createIfMissing,
  });

  useEffect(() => {
    const updateViewport = () => setViewportHeight(getSafeViewportHeight());
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const nextId = window.location.hash.replace("#", "").trim().toUpperCase();
      if (!nextId || nextId === roomTarget.id) return;
      setRoomTarget({ id: nextId, createIfMissing: false });
      setScreen("game");
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [roomTarget.id]);

  useEffect(() => {
    const currentHash = window.location.hash.replace("#", "").toUpperCase();
    if (currentHash !== roomId && createIfMissing) window.location.hash = roomId;
  }, [createIfMissing, roomId]);

  const saveName = useCallback(async (name: string) => {
    const next = name.trim().slice(0, 12);
    if (!next) return;
    localStorage.setItem(PLAYER_NAME_KEY, next);
    setPlayerName(next);
  }, []);

  const joinRoom = useCallback((nextRoom: string) => {
    const normalized = nextRoom.trim().toUpperCase();
    if (!normalized || normalized === roomId) return;
    setRoomTarget({ id: normalized, createIfMissing: false });
    setScreen("game");
    window.location.hash = normalized;
  }, [roomId]);

  const createNewRoom = useCallback(() => {
    const next = generateRoomId();
    setRoomTarget({ id: next, createIfMissing: true });
    setScreen("lobby");
    window.location.hash = next;
  }, []);

  const handleRestart = useCallback(async () => {
    await restart();
    setScreen("lobby");
  }, [restart]);

  if (loading) {
    return <div className="flex items-center justify-center bg-slate-950 text-white" style={{ minHeight: viewportHeight }}>載入房間中...</div>;
  }

  if (viewingComic) {
    return <ReviewPage comic={viewingComic} map={viewingComic.map ?? "earth"} onBack={() => setViewingComic(null)} readOnly />;
  }

  if (screen === "history") {
    return <HistoryPage onBack={() => setScreen("lobby")} onOpen={setViewingComic} />;
  }

  if (!room && !createIfMissing) {
    return <LobbyPage roomId={roomId} playerName={playerName} players={[]} isHost={false} roomMissing onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
  }

  if (screen === "game" && room && game && (game.phase === "playing" || game.phase === "review")) {
    return <GameRouter room={room} game={game} players={players} submit={submit} roomId={roomId} playerId={playerId} playerName={playerName} onLeaveGame={handleRestart} />;
  }

  return <LobbyPage roomId={roomId} playerName={playerName} players={players} isHost={isHost} roomMissing={false} onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
}

export default AppRewrite;
