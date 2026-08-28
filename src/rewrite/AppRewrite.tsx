import { useCallback, useEffect, useState } from "react";
import {
  generatePlayerId,
  generateRoomId,
  type Comic,
} from "./domain";
import { getSafeViewportHeight } from "./mobile";
import { useRoom } from "./useRoom";
import GameRouter from "./GameRouter";
import LobbyPage from "./pages/LobbyPage";
import ReviewPage from "./pages/ReviewPage";
import HistoryPage from "./pages/HistoryPage";

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
  const [playerName, setPlayerName] = useState(
    () => sessionStorage.getItem("relay_comic_player_name") ?? ""
  );
  const [screen, setScreen] = useState<"game" | "lobby" | "history">("game");
  const [viewingComic, setViewingComic] = useState<Comic | null>(null);
  const [viewportHeight, setViewportHeight] = useState(getSafeViewportHeight);

  const roomState = useRoom({ roomId, playerId, playerName });
  const { room, players, isHost, loading, start, submit, leave } = roomState;

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
    const handler = () => setRoomId(readRoomId());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    const currentHash = window.location.hash.replace("#", "").toUpperCase();
    if (currentHash !== roomId) {
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

  const handleLeaveGame = useCallback(() => {
    void leave();
    setScreen("lobby");
  }, [leave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-slate-950 text-white" style={{ minHeight: viewportHeight }}>
        載入房間中...
      </div>
    );
  }

  if (viewingComic) {
    return (
      <ReviewPage
        comic={viewingComic}
        map={viewingComic.map ?? "earth"}
        onBack={() => setViewingComic(null)}
        readOnly
      />
    );
  }

  if (screen === "history") {
    return (
      <HistoryPage
        onBack={() => setScreen("lobby")}
        onOpen={setViewingComic}
      />
    );
  }

  if (
    screen === "game" &&
    (room?.game.phase === "playing" || room?.game.phase === "review")
  ) {
    return (
      <GameRouter
        room={room}
        players={players}
        submit={submit}
        roomId={roomId}
        playerId={playerId}
        playerName={playerName}
        onLeaveGame={handleLeaveGame}
      />
    );
  }

  return (
    <LobbyPage
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

export default AppRewrite;
