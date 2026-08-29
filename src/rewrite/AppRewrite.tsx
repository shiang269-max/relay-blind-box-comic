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

function readPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const next = generatePlayerId();
  localStorage.setItem(PLAYER_ID_KEY, next);
  return next;
}
function readPlayerName(): string { return localStorage.getItem(PLAYER_NAME_KEY) ?? ""; }

function AppRewrite() {
  // Every fresh URL load starts at the lobby. A room is never auto-joined from a hash.
  const [roomTarget, setRoomTarget] = useState<RoomTarget>(() => ({ id: generateRoomId(), createIfMissing: true }));
  const [connected, setConnected] = useState(false);
  const { id: roomId, createIfMissing } = roomTarget;
  const [playerId] = useState(readPlayerId);
  const [playerName, setPlayerName] = useState(readPlayerName);
  const [screen, setScreen] = useState<"game" | "lobby" | "history">("lobby");
  const [viewingComic, setViewingComic] = useState<Comic | null>(null);
  const [viewportHeight, setViewportHeight] = useState(getSafeViewportHeight);
  const { room, game, players, isHost, loading, error, start, submit, leave } = useRoom({ roomId, playerId, playerName, createIfMissing, enabled: connected });

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

  const saveName = useCallback(async (name: string) => {
    const next = name.trim().slice(0, 12);
    if (!next) return;
    localStorage.setItem(PLAYER_NAME_KEY, next);
    setPlayerName(next);
  }, []);

  const joinRoom = useCallback((nextRoom: string) => {
    const normalized = nextRoom.trim().toUpperCase();
    if (!normalized) return;
    setRoomTarget({ id: normalized, createIfMissing: false });
    setScreen("lobby");
    setConnected(true);
  }, []);

  const createNewRoom = useCallback(() => {
    const next = generateRoomId();
    setRoomTarget({ id: next, createIfMissing: true });
    setScreen("lobby");
    setConnected(true);
  }, []);

  const returnToHome = useCallback(() => {
    setConnected(false);
    setScreen("lobby");
    setRoomTarget({ id: generateRoomId(), createIfMissing: true });
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const handleLeaveGame = useCallback(() => {
    // Return immediately; Firebase cleanup is handled asynchronously.
    returnToHome();
    void leave().catch(() => {});
  }, [leave, returnToHome]);

  useEffect(() => {
    // Ensure a copied/old URL hash can never auto-resume a previous room on reload.
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  if (viewingComic) return <ReviewPage comic={viewingComic} map={viewingComic.map ?? "earth"} onBack={() => setViewingComic(null)} readOnly />;
  if (screen === "history") return <HistoryPage onBack={() => setScreen("lobby")} onOpen={setViewingComic} />;
  if (!connected) return <LobbyPage roomId={roomId} playerName={playerName} players={[]} isHost={false} roomMissing={false} onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
  if (loading) return <div style={{ minHeight: Math.max(viewportHeight, 320), width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", background: "#020617", color: "#ffffff", fontSize: 18 }}>正在連線至遊戲房間…</div>;
  if (error) return <div style={{ minHeight: Math.max(viewportHeight, 320), width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#020617", color: "#ffffff", fontSize: 16, textAlign: "center" }}>{error}</div>;
  if (!room && !createIfMissing) return <LobbyPage roomId={roomId} playerName={playerName} players={[]} isHost={false} roomMissing onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
  if (screen === "game" && room && game && (game.phase === "playing" || game.phase === "review")) return <GameRouter room={room} game={game} players={players} submit={submit} roomId={roomId} playerId={playerId} playerName={playerName} onLeaveGame={handleLeaveGame} />;
  return <LobbyPage roomId={roomId} playerName={playerName} players={players} isHost={isHost} roomMissing={false} onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
}
export default AppRewrite;
