import { useCallback, useState } from "react";
import { ref, set } from "firebase/database";
import { db } from "../lib/firebase";
import { TOTAL_ROUNDS, generateComicId, type Comic } from "./domain";
import DrawingScreen from "./DrawingScreen";
import ReviewPage from "./pages/ReviewPage";
import WaitingPage from "./pages/WaitingPage";
import type { ReturnType as _Unused } from "typescript";

// 畫面流程集中於此，頁面本身不處理 Firebase 或遊戲規則。
interface GameRouterProps {
  roomState: any;
  roomId: string;
  playerId: string;
  playerName: string;
  onLeaveGame: () => void;
}

export default function GameRouter({
  roomState,
  roomId,
  playerId,
  playerName,
  onLeaveGame,
}: GameRouterProps) {
  const { room, players, submit } = roomState;
  const [viewingComic, setViewingComic] = useState<Comic | null>(null);

  const saveComic = useCallback(async (title: string) => {
    if (!room?.pages) return;
    const id = generateComicId();
    await set(ref(db, `comics/${id}`), {
      id,
      title: title.trim() || "未命名漫畫",
      createdAt: Date.now(),
      pages: room.pages,
    });
  }, [room?.pages]);

  if (viewingComic) {
    return <ReviewPage comic={viewingComic} onBack={() => setViewingComic(null)} readOnly />;
  }

  if (room?.phase === "playing") {
    if (room.currentPlayerId === playerId) {
      const previousPage = room.currentRound > 1
        ? room.pages?.[String(room.currentRound - 1)] ?? null
        : null;

      return (
        <DrawingScreen
          round={room.currentRound}
          totalRounds={TOTAL_ROUNDS}
          map={room.map}
          playerName={playerName}
          previousPage={previousPage}
          onSubmit={submit}
        />
      );
    }

    const currentPlayer = players.find((player: { id: string }) => player.id === room.currentPlayerId);
    return (
      <WaitingPage
        round={room.currentRound}
        totalRounds={TOTAL_ROUNDS}
        currentPlayerName={currentPlayer?.name ?? "其他玩家"}
      />
    );
  }

  if (room?.phase === "review") {
    const comic: Comic = {
      id: roomId,
      title: "本局成果",
      createdAt: room.createdAt ?? Date.now(),
      pages: room.pages ?? {},
    };

    return (
      <ReviewPage
        comic={comic}
        onBack={onLeaveGame}
        onSave={saveComic}
      />
    );
  }

  return null;
}
