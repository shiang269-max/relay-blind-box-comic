import { useCallback, useEffect, useState } from "react";
import { set, ref } from "firebase/database";
import { db } from "../lib/firebase";
import {
  generateComicId,
  generatePlayerId,
  generateRoomId,
  type Comic,
} from "./domain";
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

  const roomState = useRoom({ roomId, playerId, playerName });
  const { room, players, isHost, loading, start, submit } = roomState;

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        載入房間中...
      </div>
    );
  }

  if (viewingComic) {
    return (
      <ReviewPage
        comic={viewingComic}
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

  if (screen === "game" && (room?.phase === "playing" || room?.phase === "review")) {
    return (
      <GameRouter
        room={room}
        players={players}
        submit={submit}
        roomId={roomId}
        playerId={playerId}
        playerName={playerName}
        onLeaveGame={() => setScreen("lobby")}
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
