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
   * 手機網路短暫波動不能立刻把目前玩家的繪圖權轉走。
   * Presence 先把離線玩家移除，但會等待一段寬限時間；
   * 若玩家在期間重新連線，Room State 恢復後 cleanup 會取消計時器。
   * 主動離開則由 leaveRoom transaction 立即處理，不走這個等待流程。
   */
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
