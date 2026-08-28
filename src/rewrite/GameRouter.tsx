import { useCallback } from "react";
import { ref, set } from "firebase/database";
import { db } from "../lib/firebase";
import {
  generateComicId,
  type Comic,
  type Player,
  type RoomState,
} from "./domain";
import { getGameFlow } from "./game/getGameFlow";
import { getGameMode } from "./game/GameMode";
import type { RelayModeState } from "./game/RelayModeState";
import DrawingScreen from "./DrawingScreen";
import ReviewPage from "./pages/ReviewPage";
import WaitingPage from "./pages/WaitingPage";

interface GameRouterProps {
  room: RoomState | null;
  players: Player[];
  submit: (pageDataUrl: string) => Promise<void>;
  roomId: string;
  playerId: string;
  playerName: string;
  onLeaveGame: () => void;
}

export default function GameRouter({
  room,
  players,
  submit,
  roomId,
  playerId,
  playerName,
  onLeaveGame,
}: GameRouterProps) {
  const saveComic = useCallback(async (title: string) => {
    if (!room || room.game.mode !== "relay-30") return;

    const relayState = room.game.modeState as RelayModeState;
    const id = generateComicId();

    await set(ref(db, `comics/${id}`), {
      id,
      title: title.trim() || "未命名漫畫",
      createdAt: Date.now(),
      pages: relayState.pages,
    });
  }, [room]);

  if (!room) return null;

  const { game } = room;

  if (game.phase === "playing") {
    const mode = getGameMode(game.mode);
    const flow = getGameFlow(game.mode);

    if (game.currentPlayerId === playerId) {
      if (game.mode !== "relay-30") {
        return null;
      }

      const relayState = game.modeState as RelayModeState;
      const previousKey = flow.getPreviousDrawingKey({
        currentRound: game.currentTurn,
        currentPlayerId: game.currentPlayerId,
        playerIds: players.map((player) => player.id),
      });

      const previousPage = previousKey
        ? relayState.pages[previousKey] ?? null
        : null;

      return (
        <DrawingScreen
          mode={mode}
          roomId={roomId}
          pageIndex={Math.max(0, game.currentTurn - 1)}
          round={game.currentTurn}
          map={room.map}
          playerName={playerName}
          previousPage={previousPage}
          onSubmit={submit}
        />
      );
    }

    const currentPlayer = players.find((player) => player.id === game.currentPlayerId);
    return (
      <WaitingPage
        round={game.currentTurn}
        totalRounds={mode.totalRounds}
        modeLabel={mode.label}
        currentPlayerName={currentPlayer?.name ?? "其他玩家"}
        map={room.map}
      />
    );
  }

  if (game.phase === "review") {
    if (game.mode !== "relay-30") return null;

    const relayState = game.modeState as RelayModeState;
    const comic: Comic = {
      id: roomId,
      title: "本局成果",
      createdAt: room.createdAt ?? Date.now(),
      pages: relayState.pages,
    };

    return <ReviewPage comic={comic} map={room.map} onBack={onLeaveGame} onSave={saveComic} />;
  }

  return null;
}
