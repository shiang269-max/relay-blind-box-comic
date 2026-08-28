import {
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  set,
  type Unsubscribe,
} from "firebase/database";
import { db } from "../../lib/firebase";
import type {
  MapType,
  Player,
  RoomState,
} from "../domain";
import {
  canStartGame,
  canSubmitRound,
  getHostId,
  nextRoundState,
  orderPlayers,
} from "../game/GameRules";

function roomRef(roomId: string) {
  return ref(db, `rooms/${roomId}`);
}

export function watchRoom(
  roomId: string,
  callback: (room: RoomState | null) => void
): Unsubscribe {
  return onValue(roomRef(roomId), (snapshot) => {
    callback(snapshot.val() as RoomState | null);
  });
}

export async function upsertPlayer(
  roomId: string,
  player: Player
): Promise<void> {
  await set(
    ref(db, `rooms/${roomId}/players/${player.id}`),
    player
  );
}

export async function startPlayerPresence(
  roomId: string,
  playerId: string
): Promise<void> {
  await onDisconnect(
    ref(db, `rooms/${roomId}/players/${playerId}`)
  ).remove();
}

export async function startGame(
  roomId: string,
  playerId: string,
  map: MapType
): Promise<void> {
  await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!canStartGame(current, playerId)) return;

      const players = current?.players ?? {};
      const hostId = getHostId(current);

      if (!hostId) return;

      return {
        ...(current ?? {}),
        map,
        phase: "playing",
        currentRound: 1,
        currentPlayerId: hostId,
        pages: {},
        createdAt: current?.createdAt ?? Date.now(),
        players,
      } satisfies RoomState;
    },
    { applyLocally: false }
  );
}

export async function submitRound(
  roomId: string,
  playerId: string,
  pageDataUrl: string
): Promise<void> {
  await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!canSubmitRound(current, playerId)) return;
      if (!current) return;

      return nextRoundState(current, pageDataUrl) ?? undefined;
    },
    { applyLocally: false }
  );
}

export function getOrderedPlayers(
  room: RoomState | null
): Player[] {
  return orderPlayers(room?.players);
}

export function isRoomHost(
  room: RoomState | null,
  playerId: string
): boolean {
  return getHostId(room) === playerId;
}
