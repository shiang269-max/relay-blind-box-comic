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
  startGame,
  startPlayerPresence,
  submitRound,
  upsertPlayer,
  watchRoom,
} from "./data/RoomRepository";

export interface RoomSession {
  roomId: string;
  playerId: string;
  playerName: string;
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
    if (!session.playerName) return;

    const player: Player = {
      id: session.playerId,
      name: session.playerName,
      joinedAt: Date.now(),
    };

    void upsertPlayer(session.roomId, player);
    void startPlayerPresence(session.roomId, session.playerId);
  }, [session.playerId, session.playerName, session.roomId]);

  const players = useMemo(() => {
    return getOrderedPlayers(room);
  }, [room]);

  const isHost = useMemo(() => {
    return isRoomHost(room, session.playerId);
  }, [room, session.playerId]);

  const start = useCallback(
    async (map: MapType) => {
      await startGame(
        session.roomId,
        session.playerId,
        map
      );
    },
    [session.playerId, session.roomId]
  );

  const submit = useCallback(
    async (pageDataUrl: string) => {
      await submitRound(
        session.roomId,
        session.playerId,
        pageDataUrl
      );
    },
    [session.playerId, session.roomId]
  );

  const leave = useCallback(async () => {
    await leaveRoom(
      session.roomId,
      session.playerId
    );
  }, [session.playerId, session.roomId]);

  return {
    room,
    loading,
    players,
    isHost,
    start,
    submit,
    leave,
  };
}
