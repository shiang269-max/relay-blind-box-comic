
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ref, set, get, onValue, onDisconnect, remove, update } from 'firebase/database';
import { db } from './lib/firebase';
import { generatePlayerId, generateRoomId, generateComicId } from './lib/gameTypes';
import type { RoomState, Player, MapType } from './lib/gameTypes';
import LobbyPage from './components/LobbyPage';
import DrawingPage from './components/DrawingPage';
import WaitingPage from './components/WaitingPage';
import ReviewPage from './components/ReviewPage';
import HistoryPage from './components/HistoryPage';

const TOTAL_ROUNDS = 30;

function getRoomIdFromHash(): string {
  const hash = window.location.hash.replace('#', '').trim().toUpperCase();
  return hash || generateRoomId();
}

function getOrCreatePlayerId(): string {
  const key = 'relay_comic_player_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = generatePlayerId();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function getOrCreatePlayerName(): string {
  return sessionStorage.getItem('relay_comic_player_name') || '';
}

export default function App() {

  const [roomId, setRoomId] = useState<string>(() => getRoomIdFromHash());
  const [myId] = useState<string>(() => getOrCreatePlayerId());
  const [myName, setMyName] = useState<string>(() => getOrCreatePlayerName());
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const presenceRef = useRef<ReturnType<typeof ref> | null>(null);

  // Sync hash to roomId
  useEffect(() => {
    const handleHash = () => {
      const newRoom = getRoomIdFromHash();
      setRoomId(newRoom);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Update URL hash when roomId changes
  useEffect(() => {
    if (window.location.hash.replace('#', '').toUpperCase() !== roomId) {
      window.location.hash = roomId;
    }
  }, [roomId]);

  // Join room presence
  useEffect(() => {
    if (!myName) {
      setLoading(false);
      return;
    }

    const playerRef = ref(db, `rooms/${roomId}/players/${myId}`);
    presenceRef.current = playerRef;

    const player: Player = { id: myId, name: myName, joinedAt: Date.now() };
    set(playerRef, player);

    onDisconnect(playerRef).remove();

    setLoading(false);

    return () => {
      remove(playerRef);
    };
  }, [roomId, myId, myName]);

  // Listen to room state; auto-advance if current player has disconnected
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, async (snap) => {
      const data = snap.val() as RoomState | null;
      setRoomState(data);
      setLoading(false);

      if (
        data &&
        data.phase === 'playing' &&
        data.currentPlayerId &&
        data.players &&
        !(data.currentPlayerId in data.players)
      ) {
        // Disconnected player is still listed as current — only the oldest
        // remaining player (host) performs the recovery to avoid races.
        const remaining = Object.values(data.players).sort(
          (a, b) => a.joinedAt - b.joinedAt
        );
        if (remaining.length === 0) return;
        if (remaining[0].id !== myId) return; // only host acts

        const playerIds = remaining.map(p => p.id);
        // Find where the disconnected player was in the original order and
        // pick the next slot among remaining players.
        const nextPlayerId = playerIds[0]; // fallback: give turn to host
        const round = data.currentRound;
        const isLastRound = round >= TOTAL_ROUNDS;

        await update(ref(db, `rooms/${roomId}`), {
          currentPlayerId: isLastRound ? null : nextPlayerId,
          phase: isLastRound ? 'review' : 'playing',
        });
      }
    });
    return () => unsub();
  }, [roomId, myId]);

  const handleSetName = useCallback((name: string) => {
    sessionStorage.setItem('relay_comic_player_name', name);
    setMyName(name);
    const playerRef = ref(db, `rooms/${roomId}/players/${myId}`);
    const player: Player = { id: myId, name, joinedAt: Date.now() };
    set(playerRef, player);
    onDisconnect(playerRef).remove();
  }, [roomId, myId]);

  const handleJoinRoom = useCallback((newRoomId: string) => {
    window.location.hash = newRoomId;
  }, []);

  const handleStartGame = useCallback(async (map: MapType) => {
    const snap = await get(ref(db, `rooms/${roomId}/players`));
    const players = snap.val() as Record<string, Player> | null;
    if (!players) return;

    const playerIds = Object.keys(players);
    const firstPlayer = playerIds[0];

    const roomRef = ref(db, `rooms/${roomId}`);
    await update(roomRef, {
      map,
      currentRound: 1,
      currentPlayerId: firstPlayer,
      phase: 'playing',
      createdAt: Date.now(),
    });
  }, [roomId]);

  const handleSubmitPage = useCallback(async (dataUrl: string) => {
    if (!roomState) return;
    const round = roomState.currentRound;
    const players = roomState.players ? Object.values(roomState.players) : [];
    const playerIds = players.map(p => p.id);
    const currentIdx = playerIds.indexOf(myId);
    const nextIdx = (currentIdx + 1) % playerIds.length;
    const nextPlayerId = playerIds[nextIdx];

    const nextRound = round + 1;
    const isLastRound = round >= TOTAL_ROUNDS;

    const roomRef = ref(db, `rooms/${roomId}`);
    await update(roomRef, {
      [`pages/${round}`]: dataUrl,
      currentRound: isLastRound ? round : nextRound,
      currentPlayerId: isLastRound ? null : nextPlayerId,
      phase: isLastRound ? 'review' : 'playing',
    });
  }, [roomState, myId, roomId]);

  const [leftReview, setLeftReview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingComic, setViewingComic] = useState<import('./lib/gameTypes').Comic | null>(null);
  const prevPhaseRef = useRef<string | null>(null);

  const handleBackToLobby = useCallback(() => {
    setLeftReview(true);
  }, []);

  const handleSaveComic = useCallback(async (title: string) => {
    const pages = roomState?.pages;
    if (!pages) return;
    const id = generateComicId();
    await set(ref(db, `comics/${id}`), {
      id,
      title,
      createdAt: Date.now(),
      pages,
    });
  }, [roomState]);

  // Dev shortcut: jump to review
  const handleDevReview = useCallback(async () => {
    const mockPages: Record<string, string> = {};
    const roomRef = ref(db, `rooms/${roomId}`);
    await update(roomRef, {
      phase: 'review',
      currentRound: TOTAL_ROUNDS,
      currentPlayerId: null,
      pages: mockPages,
    });
  }, [roomId]);

  const phase = roomState?.phase ?? 'lobby';

  // Reset leftReview whenever a new game starts (phase transitions to 'playing')
  useEffect(() => {
    if (prevPhaseRef.current !== 'playing' && phase === 'playing') {
      setLeftReview(false);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">載入中...</div>
      </div>
    );
  }

  const players = roomState?.players ? Object.values(roomState.players) : [];
  const isHost = players.length === 0 || players[0]?.id === myId;

  // Review page (game result)
  if (phase === 'review' && !leftReview) {
    return (
      <ReviewPage
        pages={roomState?.pages ?? {}}
        totalRounds={TOTAL_ROUNDS}
        onBackToLobby={handleBackToLobby}
        onSaveComic={handleSaveComic}
      />
    );
  }

  // Viewing a saved comic from history
  if (viewingComic) {
    return (
      <ReviewPage
        pages={viewingComic.pages}
        totalRounds={Object.keys(viewingComic.pages).length}
        onBackToLobby={() => setViewingComic(null)}
        readOnly
      />
    );
  }

  // History page
  if (showHistory) {
    return (
      <HistoryPage
        onBack={() => setShowHistory(false)}
        onView={(comic) => setViewingComic(comic)}
      />
    );
  }

  // Playing phase
  if (phase === 'playing' && roomState) {
    const isMyTurn = roomState.currentPlayerId === myId;
    const currentPlayer = players.find(p => p.id === roomState.currentPlayerId);
    const currentPlayerName = currentPlayer?.name ?? '玩家';
    const prevRound = roomState.currentRound - 1;
    const prevPageUrl = prevRound > 0 ? (roomState.pages?.[String(prevRound)] ?? null) : null;

    if (isMyTurn) {
      return (
        <DrawingPage
          round={roomState.currentRound}
          totalRounds={TOTAL_ROUNDS}
          map={roomState.map}
          playerName={myName}
          onSubmit={handleSubmitPage}
          prevPageUrl={prevPageUrl}
          onDevReview={handleDevReview}
        />
      );
    } else {
      return (
        <WaitingPage
          round={roomState.currentRound}
          totalRounds={TOTAL_ROUNDS}
          map={roomState.map}
          currentPlayerName={currentPlayerName}
        />
      );
    }
  }

  // Lobby
  return (
    <>
      <LobbyPage
        roomId={roomId}
        players={players}
        myId={myId}
        isHost={isHost}
        myName={myName}
        onSetName={handleSetName}
        onStartGame={handleStartGame}
        onJoinRoom={handleJoinRoom}
        currentPhase={phase}
        onViewHistory={() => setShowHistory(true)}
      />

    </>
  );
}
