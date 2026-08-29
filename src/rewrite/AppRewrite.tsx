import { useCallback, useEffect, useRef, useState } from "react";
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
function readPlayerId(): string { const existing = localStorage.getItem(PLAYER_ID_KEY); if (existing) return existing; const next = generatePlayerId(); localStorage.setItem(PLAYER_ID_KEY, next); return next; }
function readPlayerName(): string { return localStorage.getItem(PLAYER_NAME_KEY) ?? ""; }

function AppRewrite() {
  const [roomTarget, setRoomTarget] = useState<RoomTarget>(() => ({ id: generateRoomId(), createIfMissing: true }));
  const [playerId] = useState(readPlayerId);
  const [playerName, setPlayerName] = useState(readPlayerName);
  const [connected, setConnected] = useState(() => Boolean(readPlayerName()));
  const { id: roomId, createIfMissing } = roomTarget;
  const [screen, setScreen] = useState<"lobby" | "history">("lobby");
  const [viewingComic, setViewingComic] = useState<Comic | null>(null);
  const [viewportHeight, setViewportHeight] = useState(getSafeViewportHeight);
  const { room, game, players, isHost, loading, error, start, submit, leave } = useRoom({ roomId, playerId, playerName, createIfMissing, enabled: connected });
  const leaveRef = useRef(leave);
  const connectedRef = useRef(connected);
  useEffect(() => { leaveRef.current = leave; }, [leave]);
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { const updateViewport = () => setViewportHeight(getSafeViewportHeight()); updateViewport(); window.addEventListener("resize", updateViewport); window.visualViewport?.addEventListener("resize", updateViewport); return () => { window.removeEventListener("resize", updateViewport); window.visualViewport?.removeEventListener("resize", updateViewport); }; }, []);
  useEffect(() => () => { if (connectedRef.current) void leaveRef.current().catch(() => {}); }, []);
  useEffect(() => { if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search); }, []);

  const saveName = useCallback(async (name: string) => { const next = name.trim().slice(0, 12); if (!next) return; localStorage.setItem(PLAYER_NAME_KEY, next); setPlayerName(next); setConnected(true); }, []);
  const joinRoom = useCallback((nextRoom: string) => { const normalized = nextRoom.trim().toUpperCase(); if (!normalized) return; setRoomTarget({ id: normalized, createIfMissing: true }); setScreen("lobby"); setConnected(true); }, []);
  const createNewRoom = useCallback(() => { setRoomTarget({ id: generateRoomId(), createIfMissing: true }); setScreen("lobby"); setConnected(true); }, []);
  const returnToHome = useCallback(() => { setScreen("lobby"); setRoomTarget({ id: generateRoomId(), createIfMissing: true }); setConnected(true); window.history.replaceState(null, "", window.location.pathname + window.location.search); }, []);
  const handleLeaveGame = useCallback(async () => { await leave(); returnToHome(); }, [leave, returnToHome]);

  if (viewingComic) return <ReviewPage comic={viewingComic} map={viewingComic.map ?? "earth"} onBack={() => setViewingComic(null)} readOnly />;
  if (screen === "history") return <HistoryPage onBack={() => setScreen("lobby")} onOpen={setViewingComic} />;
  if (!connected) return <LobbyPage roomId={roomId} playerName={playerName} players={[]} isHost={true} roomMissing={false} onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
  if (loading) return <div style={{ minHeight: Math.max(viewportHeight, 320), width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", background: "#020617", color: "#ffffff", fontSize: 18 }}>正在連線至遊戲房間…</div>;
  if (error) return <div style={{ minHeight: Math.max(viewportHeight, 320), width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#020617", color: "#ffffff", fontSize: 16, textAlign: "center" }}>{error}</div>;
  if (room && game && (game.phase === "playing" || game.phase === "review")) return <GameRouter room={room} game={game} players={players} submit={submit} roomId={roomId} playerId={playerId} playerName={playerName} onLeaveGame={handleLeaveGame} />;
  return <LobbyPage roomId={roomId} playerName={playerName} players={room ? players : []} isHost={room ? isHost : true} roomMissing={false} onSaveName={saveName} onJoinRoom={joinRoom} onCreateRoom={createNewRoom} onStart={start} onHistory={() => setScreen("history")} />;
}
export default AppRewrite;
