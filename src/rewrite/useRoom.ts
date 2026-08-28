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

  /**
   * 當目前輪到的玩家因斷線或離開而被 Presence 移除時，
   * 任何在線客戶端都可以觸發同一個 transaction。
   * Transaction 只會成功一次，因此多人同時偵測不會造成重複跳過。
   */
  useEffect(() => {
    if (!room) return;
    if (room.game.phase !== "playing") return;

    const currentPlayerId = room.game.currentPlayerId;
    if (!currentPlayerId) {
      void recoverMissingCurrentPlayerTurn(session.roomId);
      return;
    }

    if (!room.players[currentPlayerId]) {
      void recoverMissingCurrentPlayerTurn(session.roomId);
    }
  }, [room, session.roomId]);

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
    async (pageDataUrl: string): Promise<boolean> => {
      return submitRound(
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
