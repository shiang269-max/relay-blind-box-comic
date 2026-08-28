import { useCallback, useEffect, useMemo, useState } from "react";
import {
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
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

function orderPlayers(players: Record<string, Player> | undefined): Player[] {
  return Object.values(players ?? {}).sort(
    (a, b) => a.joinedAt - b.joinedAt
  );
}

export function useRoom(session: RoomSession) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

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
    return orderPlayers(room?.players);
  }, [room?.players]);

  const isHost = players[0]?.id === session.playerId;

  const start = useCallback(
    async (map: MapType) => {
      await runTransaction(
        ref(db, `rooms/${session.roomId}`),
        (current: RoomState | null) => {
          const ordered = orderPlayers(current?.players);

          if (ordered.length === 0) return;
          if (ordered[0].id !== session.playerId) return;
          if (current?.phase === "playing") return;

          return {
            ...(current ?? {}),
            map,
            phase: "playing",
            currentRound: 1,
            currentPlayerId: ordered[0].id,
            pages: {},
            createdAt: Date.now(),
            players: current?.players ?? {},
          } satisfies RoomState;
        },
        { applyLocally: false }
      );
    },
    [session.playerId, session.roomId]
  );

  const submit = useCallback(
    async (pageDataUrl: string) => {
      await runTransaction(
        ref(db, `rooms/${session.roomId}`),
        (current: RoomState | null) => {
          if (!current) return;
          if (current.phase !== "playing") return;
          if (current.currentPlayerId !== session.playerId) return;

          const ordered = orderPlayers(current.players);
          if (ordered.length === 0) return;

          const index = ordered.findIndex(
            (player) => player.id === session.playerId
          );

          if (index < 0) return;

          const last = current.currentRound >= TOTAL_ROUNDS;
          const nextPlayer = ordered[(index + 1) % ordered.length];
          const pages = {
            ...(current.pages ?? {}),
            [String(current.currentRound)]: pageDataUrl,
          };

          return {
            ...current,
            pages,
            currentRound: last
              ? current.currentRound
              : current.currentRound + 1,
            currentPlayerId: last ? null : nextPlayer.id,
            phase: last ? "review" : "playing",
          } satisfies RoomState;
        },
        { applyLocally: false }
      );
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
