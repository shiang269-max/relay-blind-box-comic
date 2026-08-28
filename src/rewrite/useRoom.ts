import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MapType,
  Player,
  RoomState,
} from "./domain";
import {
  getOrderedPlayers,
  isRoomHost,
  leaveRoom,
  recoverMissingCurrentPlayerTurn,
  startGame,
  startPlayerPresence,
  submitRound,
  upsertPlayer,
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    return watchRoom(session.roomId, (nextRoom) => {
      setRoom(nextRoom);
      setLoading(false);
    });
  }, [session.roomId]);

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
  }, [
    loading,
    room,
    session.createIfMissing,
    session.playerId,
    session.playerName,
    session.roomId,
  ]);

  useEffect(() => {
    if (!room) return;
    if (room.game.phase !== "playing") return;

    const currentPlayerId = room.game.currentPlayerId;
    const currentPlayerExists = Boolean(
      currentPlayerId && room.players[currentPlayerId]
    );

    if (currentPlayerExists) return;

    const timeoutId = window.setTimeout(() => {
      void recoverMissingCurrentPlayerTurn(session.roomId);
    }, DISCONNECT_GRACE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    room?.game.currentPlayerId,
    room?.game.phase,
    room?.players,
    session.roomId,
  ]);

  const players = useMemo(() => getOrderedPlayers(room), [room]);
  const isHost = useMemo(
    () => isRoomHost(room, session.playerId),
    [room, session.playerId]
  );

  const start = useCallback(
    async (map: MapType) => {
      await startGame(session.roomId, session.playerId, map);
    },
    [session.playerId, session.roomId]
  );

  const submit = useCallback(
    async (pageDataUrl: string): Promise<boolean> => {
      return submitRound(session.roomId, session.playerId, pageDataUrl);
    },
    [session.playerId, session.roomId]
  );

  const leave = useCallback(async () => {
    await leaveRoom(session.roomId, session.playerId);
  }, [session.playerId, session.roomId]);

  return { room, loading, players, isHost, start, submit, leave };
}
