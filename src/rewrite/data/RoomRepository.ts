import {
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  type Unsubscribe,
} from "firebase/database";
import { db } from "../../lib/firebase";
import { getDefaultGameMode, type MapType, type Player, type RoomState } from "../domain";
import { createGameState } from "../game/GameState";
import type { GameModeId } from "../game/GameMode";
import { createRelayModeState } from "../game/RelayModeState";
import {
  canStartGame,
  canSubmitRound,
  getHostId,
  nextRoundState,
  orderPlayers,
  recoverMissingCurrentPlayer,
} from "../game/GameRules";

function roomRef(roomId: string) {
  return ref(db, `rooms/${roomId}`);
}

function relayPagesRef(roomId: string) {
  return ref(db, `relayPages/${roomId}`);
}

export function watchRoom(
  roomId: string,
  callback: (room: RoomState | null) => void
): Unsubscribe {
  return onValue(roomRef(roomId), (snapshot) => {
    callback(snapshot.val() as RoomState | null);
  });
}

/**
 * 接力頁面圖片獨立監聽，不再與 room/game transaction 綁在同一個大型節點。
 */
export function watchRelayPages(
  roomId: string,
  callback: (pages: Record<string, string>) => void
): Unsubscribe {
  return onValue(relayPagesRef(roomId), (snapshot) => {
    callback((snapshot.val() as Record<string, string> | null) ?? {});
  });
}

export async function upsertPlayer(roomId: string, player: Player): Promise<void> {
  await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!current) {
        const mode = getDefaultGameMode();
        const game = createGameState(mode, null);
        if (mode === "relay-30") game.modeState = createRelayModeState();

        return {
          map: "earth",
          game,
          players: { [player.id]: player },
          createdAt: Date.now(),
        } satisfies RoomState;
      }

      return {
        ...current,
        players: {
          ...current.players,
          [player.id]: {
            ...player,
            joinedAt: current.players[player.id]?.joinedAt ?? player.joinedAt,
          },
        },
      } satisfies RoomState;
    },
    { applyLocally: false }
  );
}

export async function startPlayerPresence(roomId: string, playerId: string): Promise<void> {
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
  await onDisconnect(playerRef).remove();
}

export async function leaveRoom(roomId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!current || !current.players[playerId]) return;

      const nextPlayers = { ...current.players };
      delete nextPlayers[playerId];
      if (Object.keys(nextPlayers).length === 0) return null;

      const nextRoom: RoomState = { ...current, players: nextPlayers };
      return recoverMissingCurrentPlayer(nextRoom) ?? nextRoom;
    },
    { applyLocally: false }
  );

  return result.committed;
}

export async function recoverMissingCurrentPlayerTurn(roomId: string): Promise<boolean> {
  const result = await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!current) return;
      return recoverMissingCurrentPlayer(current) ?? undefined;
    },
    { applyLocally: false }
  );

  return result.committed;
}

export async function startGame(
  roomId: string,
  playerId: string,
  map: MapType,
  mode: GameModeId = getDefaultGameMode()
): Promise<void> {
  const result = await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!canStartGame(current, playerId)) return;

      const players = current?.players ?? {};
      const hostId = getHostId(current);
      if (!hostId) return;

      const game = createGameState(mode, hostId);
      game.phase = "playing";
      game.currentTurn = 1;
      if (mode === "relay-30") game.modeState = createRelayModeState();

      return {
        map,
        game,
        createdAt: current?.createdAt ?? Date.now(),
        players,
      } satisfies RoomState;
    },
    { applyLocally: false }
  );

  if (result.committed && mode === "relay-30") {
    await remove(relayPagesRef(roomId));
  }
}

/**
 * 頁面先寫入獨立路徑，再用小型 room transaction 推進回合。
 *
 * 這避免第 N 回合提交時重新寫入 1..N-1 的所有累積圖片，資料量不再隨回合
 * 成倍增加，也避免舊頁因大型 transaction 同步失敗而整批消失。
 */
export async function submitRound(roomId: string, playerId: string, pageDataUrl: string): Promise<boolean> {
  const pageTurnRef = ref(db, `rooms/${roomId}/game/currentTurn`);
  const turnSnapshot = await new Promise<number | null>((resolve) => {
    const unsubscribe = onValue(pageTurnRef, (snapshot) => {
      unsubscribe();
      const value = snapshot.val();
      resolve(typeof value === "number" ? value : null);
    }, { onlyOnce: true });
  });

  if (!turnSnapshot || turnSnapshot < 1) return false;

  await set(ref(db, `relayPages/${roomId}/${turnSnapshot}`), pageDataUrl);

  const result = await runTransaction(
    roomRef(roomId),
    (current: RoomState | null) => {
      if (!current || !canSubmitRound(current, playerId)) return;
      if (current.game.currentTurn !== turnSnapshot) return;
      return nextRoundState(current) ?? undefined;
    },
    { applyLocally: false }
  );

  return result.committed;
}

export function getOrderedPlayers(room: RoomState | null): Player[] {
  return orderPlayers(room?.players);
}

export function isRoomHost(room: RoomState | null, playerId: string): boolean {
  return getHostId(room) === playerId;
}
