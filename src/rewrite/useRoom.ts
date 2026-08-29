import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapType, Player, RoomState } from "./domain";
import type { GameState } from "./game/GameState";
import {
  closeCurrentGame,
  getOrderedPlayers,
  isRoomHost,
  leaveRoom,
  recoverMissingCurrentPlayerTurn,
  startGame,
  startPlayerPresence,
  submitRound,
  upsertPlayer,
  watchGame,
  watchRoom,
} from "./data/RoomRepository";

const DISCONNECT_GRACE_MS = 10_000;

export interface RoomSession {
  roomId: string;
  playerId: string;
  playerName: string;
  createIfMissing: boolean;
}

export function useRoom(session: RoomSession) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setGame(null);
    return watchRoom(session.roomId, (nextRoom) => {
      setRoom(nextRoom);
      setLoading(false);
    });
  }, [session.roomId]);

  useEffect(() => {
    const gameId = room?.currentGameId;
    if (!gameId) {
      setGame(null);
      return;
    }
    setGame(null);
    return watchGame(gameId, setGame);
  }, [room?.currentGameId]);

  useEffect(() => {
    if (!session.playerName || loading) return;
    if (!room && !session.createIfMissing) return;

    const player: Player = {
      id: session.playerId,
      name: session.playerName,
      joinedAt: Date.now(),
    };
    void upsertPlayer(session.roomId, player);
    void startPlayerPresence(session.roomId, session.playerId);
  }, [loading, room, session.createIfMissing, session.playerId, session.playerName, session.roomId]);

  useEffect(() => {
    if (!room || !game || game.phase !== "playing") return;
    const currentPlayerExists = Boolean(
      game.currentPlayerId && room.players[game.currentPlayerId]
    );
    if (currentPlayerExists) return;

    const timeoutId = window.setTimeout(() => {
      if (room.currentGameId !== game.gameId) return;
      void recoverMissingCurrentPlayerTurn(session.roomId, game.gameId);
    }, DISCONNECT_GRACE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [game?.gameId, game?.currentPlayerId, game?.phase, room?.currentGameId, room?.players, session.roomId]);

  const players = useMemo(() => getOrderedPlayers(room), [room]);
  const isHost = useMemo(() => isRoomHost(room, session.playerId), [room, session.playerId]);

  const start = useCallback(async (map: MapType) => {
    await startGame(session.roomId, session.playerId, map);
  }, [session.playerId, session.roomId]);

  const submit = useCallback(async (pageDataUrl: string): Promise<boolean> => {
    const gameId = game?.gameId;
    if (!gameId) return false;
    return submitRound(session.roomId, gameId, session.playerId, pageDataUrl);
  }, [game?.gameId, session.playerId, session.roomId]);

  const restart = useCallback(async (): Promise<boolean> => {
    const gameId = game?.gameId;
    if (!gameId) return false;
    return closeCurrentGame(session.roomId, gameId);
  }, [game?.gameId, session.roomId]);

  const leave = useCallback(async () => {
    await leaveRoom(session.roomId, session.playerId);
  }, [session.playerId, session.roomId]);

  return { room, game, loading, players, isHost, start, submit, restart, leave };
}
