import { useCallback } from "react";
import { ref, set } from "firebase/database";
import { db } from "../lib/firebase";
import { type Comic, type Player, type RoomState } from "./domain";
import { getGameFlow } from "./game/getGameFlow";
import { getGameMode } from "./game/GameMode";
import { asRelayModeState } from "./game/GameRules";
import DrawingScreen from "./DrawingScreen";
import ReviewPage from "./pages/ReviewPage";
import WaitingPage from "./pages/WaitingPage";

interface GameRouterProps {
  room: RoomState | null;
  players: Player[];
  submit: (pageDataUrl: string) => Promise<boolean>;
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
    if (!room || (room.game.mode ?? "relay-30") !== "relay-30") return;

    const relayState = asRelayModeState(room.game);

    await set(ref(db, `comics/${roomId}`), {
      id: roomId,
      title: title.trim() || "未命名漫畫",
      createdAt: room.createdAt ?? Date.now(),
      map: room.map,
      pages: relayState.pages,
    });
  }, [room, roomId]);

  if (!room) return null;

  const { game } = room;
  const modeId = game.mode ?? "relay-30";
  const mode = getGameMode(modeId);

  if (game.phase === "playing") {
    const flow = getGameFlow(modeId);

    if (game.currentPlayerId === playerId) {
      if (modeId !== "relay-30") {
        return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="此模式尚未開放" map={room.map} />;
      }

      const relayState = asRelayModeState(game);
      const previousKey = flow.getPreviousDrawingKey({
        currentRound: game.currentTurn,
        currentPlayerId: game.currentPlayerId,
        playerIds: players.map((player) => player.id),
      });

      const previousPage = previousKey ? relayState.pages[previousKey] ?? null : null;

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
    if (modeId !== "relay-30") {
      return <WaitingPage round={game.currentTurn} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="此模式尚未開放" map={room.map} />;
    }

    const relayState = asRelayModeState(game);
    const comic: Comic = {
      id: roomId,
      title: "本局成果",
      createdAt: room.createdAt ?? Date.now(),
      map: room.map,
      pages: relayState.pages,
    };

    return <ReviewPage comic={comic} map={room.map} onBack={onLeaveGame} onSave={saveComic} />;
  }

  return <WaitingPage round={game.currentTurn ?? 1} totalRounds={mode.totalRounds} modeLabel={mode.label} currentPlayerName="等待遊戲狀態" map={room.map} />;
}
