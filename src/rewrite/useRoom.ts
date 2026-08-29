import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapType, Player, RoomState } from "./domain";
import type { GameState } from "./game/GameState";
import { closeCurrentGame, getOrderedPlayers, isRoomHost, leaveRoom, recoverMissingCurrentPlayerTurn, startGame, startPlayerPresence, submitRound, touchPlayer, upsertPlayer, watchGame, watchRoom } from "./data/RoomRepository";

const DISCONNECT_GRACE_MS = 10_000;
const ROOM_LOAD_TIMEOUT_MS = 8_000;
const PLAYER_HEARTBEAT_MS = 10_000;

export interface RoomSession { roomId: string; playerId: string; playerName: string; createIfMissing: boolean; enabled?: boolean; }
function toFirebaseErrorMessage(error: unknown): string { if (error instanceof Error) { if (error.message.includes("permission_denied")) return "Firebase 權限被拒絕，請檢查 Realtime Database Rules。"; return `Firebase 連線失敗：${error.message}`; } return "Firebase 連線失敗。"; }

export function useRoom(session: RoomSession) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(Boolean(session.enabled));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let timeoutId: number | undefined;
    if (!session.enabled) { setLoading(false); setError(null); setRoom(null); setGame(null); return; }
    setLoading(true); setError(null); setRoom(null); setGame(null);
    const fail = (nextError: unknown) => { if (!active) return; if (timeoutId) window.clearTimeout(timeoutId); setLoading(false); setError(toFirebaseErrorMessage(nextError)); };
    const connect = async () => {
      try {
        if (!session.playerName) throw new Error("玩家名稱無效");
        const now = Date.now();
        await upsertPlayer(session.roomId, { id: session.playerId, name: session.playerName, joinedAt: now, activeAt: now });
        await startPlayerPresence(session.roomId, session.playerId);
        if (!active) return;
        timeoutId = window.setTimeout(() => fail(new Error("timeout")), ROOM_LOAD_TIMEOUT_MS);
        unsubscribe = watchRoom(session.roomId, (nextRoom) => { if (!active) return; if (timeoutId) window.clearTimeout(timeoutId); setRoom(nextRoom); setError(null); setLoading(false); }, fail);
      } catch (nextError) { fail(nextError); }
    };
    void connect();
    return () => { active = false; if (timeoutId) window.clearTimeout(timeoutId); unsubscribe?.(); };
  }, [session.enabled, session.playerId, session.playerName, session.roomId]);

  useEffect(() => { if (!session.enabled) { setGame(null); return; } const gameId = room?.currentGameId; if (!gameId) { setGame(null); return; } setGame(null); return watchGame(gameId, setGame, (nextError) => setError(toFirebaseErrorMessage(nextError))); }, [room?.currentGameId, session.enabled]);
  useEffect(() => { if (!session.enabled || loading || error || !room) return; const heartbeatId = window.setInterval(() => { void touchPlayer(session.roomId, session.playerId).catch(() => {}); }, PLAYER_HEARTBEAT_MS); return () => window.clearInterval(heartbeatId); }, [error, loading, room, session.enabled, session.playerId, session.roomId]);
  useEffect(() => { if (!session.enabled || !room || !game || game.phase !== "playing") return; const currentPlayerId = game.currentPlayerId; const currentPlayerExists = Boolean(currentPlayerId && room.players?.[currentPlayerId]); if (currentPlayerExists) return; const timeoutId = window.setTimeout(() => { if (room.currentGameId !== game.gameId) return; void recoverMissingCurrentPlayerTurn(session.roomId, game.gameId); }, DISCONNECT_GRACE_MS); return () => window.clearTimeout(timeoutId); }, [game?.gameId, game?.currentPlayerId, game?.phase, room?.currentGameId, room?.players, session.enabled, session.roomId]);

  const players = useMemo(() => getOrderedPlayers(room), [room]);
  const isHost = useMemo(() => isRoomHost(room, session.playerId), [room, session.playerId]);
  const start = useCallback(async (map: MapType) => { await startGame(session.roomId, session.playerId, map); }, [session.playerId, session.roomId]);
  const submit = useCallback(async (pageDataUrl: string): Promise<boolean> => { const gameId = game?.gameId; if (!gameId) return false; return submitRound(session.roomId, gameId, session.playerId, pageDataUrl); }, [game?.gameId, session.playerId, session.roomId]);
  const restart = useCallback(async (): Promise<boolean> => { const gameId = game?.gameId; if (!gameId) return false; return closeCurrentGame(session.roomId, gameId); }, [game?.gameId, session.roomId]);
  const leave = useCallback(async () => { await leaveRoom(session.roomId, session.playerId); }, [session.playerId, session.roomId]);
  return { room, game, loading, error, players, isHost, start, submit, restart, leave };
}
