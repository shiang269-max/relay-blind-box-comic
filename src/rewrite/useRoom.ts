import { useCallback, useEffect, useMemo, useState } from "react";
import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { db } from "../lib/firebase";
import {
  TOTAL_ROUNDS,
  type MapType,
  type Player,
  type RoomState,
} from "./domain";

export interface RoomSession {
  roomId: string;
  playerId: string;
  playerName: string;
}

export function useRoom(session: RoomSession) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${session.roomId}`);
    return onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val() as RoomState | null);
      setLoading(false);
    });
  }, [session.roomId]);

  useEffect(() => {
    if (!session.playerName) return;

    const playerRef = ref(
      db,
      `rooms/${session.roomId}/players/${session.playerId}`
    );

    const player: Player = {
      id: session.playerId,
      name: session.playerName,
      joinedAt: Date.now(),
    };

    void set(playerRef, player);
    void onDisconnect(playerRef).remove();

    return () => {
      void remove(playerRef);
    };
  }, [session.playerId, session.playerName, session.roomId]);

  const players = useMemo(() => {
    return Object.values(room?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt
    );
  }, [room?.players]);

  const isHost = players[0]?.id === session.playerId;

  const start = useCallback(
    async (map: MapType) => {
      const playerSnapshot = await get(
        ref(db, `rooms/${session.roomId}/players`)
      );
      const currentPlayers = playerSnapshot.val() as Record<string, Player> | null;
      if (!currentPlayers) return;

      const ordered = Object.values(currentPlayers).sort(
        (a, b) => a.joinedAt - b.joinedAt
      );
      if (ordered.length === 0) return;

      await update(ref(db, `rooms/${session.roomId}`), {
        map,
        phase: "playing",
        currentRound: 1,
        currentPlayerId: ordered[0].id,
        pages: {},
        createdAt: Date.now(),
      });
    },
    [session.roomId]
  );

  const submit = useCallback(
    async (pageDataUrl: string) => {
      const snapshot = await get(ref(db, `rooms/${session.roomId}`));
      const current = snapshot.val() as RoomState | null;
      if (!current) return;
      if (current.phase !== "playing") return;
      if (current.currentPlayerId !== session.playerId) return;

      const ordered = Object.values(current.players ?? {}).sort(
        (a, b) => a.joinedAt - b.joinedAt
      );
      if (ordered.length === 0) return;

      const index = ordered.findIndex(
        (player) => player.id === session.playerId
      );
      const nextPlayer = ordered[(index + 1) % ordered.length];
      const last = current.currentRound >= TOTAL_ROUNDS;

      await update(ref(db, `rooms/${session.roomId}`), {
        [`pages/${current.currentRound}`]: pageDataUrl,
        currentRound: last ? current.currentRound : current.currentRound + 1,
        currentPlayerId: last ? null : nextPlayer.id,
        phase: last ? "review" : "playing",
      });
    },
    [session.playerId, session.roomId]
  );

  return {
    room,
    loading,
    players,
    isHost,
    start,
    submit,
  };
}
