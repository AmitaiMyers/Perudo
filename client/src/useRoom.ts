import { useCallback, useEffect, useState } from 'react';
import type { AckResult, Bid, RoomView, SessionInfo } from '@perudo/shared';
import { socket } from './socket';
import { clearSession, loadSession, saveSession } from './session';

const ERROR_DISPLAY_MS = 4_000;

export interface RoomController {
  view: RoomView | null;
  connected: boolean;
  /** True while a saved seat is being reclaimed after a refresh or reconnect. */
  resuming: boolean;
  error: string | null;
  dismissError: () => void;
  createRoom: (name: string) => void;
  joinRoom: (roomCode: string, name: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  rematch: () => void;
  raise: (bid: Bid, seq: number) => void;
  katzel: (seq: number) => void;
  liar: (seq: number) => void;
}

export function useRoom(): RoomController {
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [resuming, setResuming] = useState(loadSession() !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Every (re)connect gets a fresh socket on the server, so reclaim the saved seat each time.
    const handleConnect = () => {
      setConnected(true);
      const session = loadSession();
      if (session === null) return;
      setResuming(true);
      void socket.emitWithAck('room:resume', session).then((result) => {
        setResuming(false);
        if (result.ok) return;
        clearSession();
        setView(null);
        setError(result.error);
      });
    };
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:state', setView);
    if (socket.connected) handleConnect();
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:state', setView);
    };
  }, []);

  // Errors are mostly transient (e.g. someone else acted first), so they clear themselves.
  useEffect(() => {
    if (error === null) return;
    const timeout = window.setTimeout(() => setError(null), ERROR_DISPLAY_MS);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const reportFailure = useCallback((result: AckResult) => {
    if (!result.ok) setError(result.error);
  }, []);

  const enterRoom = useCallback((result: AckResult<{ session: SessionInfo }>) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveSession(result.session);
    setError(null);
  }, []);

  return {
    view,
    connected,
    resuming,
    error,
    dismissError: () => setError(null),
    createRoom: (name) => void socket.emitWithAck('room:create', { name }).then(enterRoom),
    joinRoom: (roomCode, name) => void socket.emitWithAck('room:join', { roomCode, name }).then(enterRoom),
    leaveRoom: () => {
      void socket.emitWithAck('room:leave').then(reportFailure);
      clearSession();
      setView(null);
    },
    startGame: () => void socket.emitWithAck('game:start').then(reportFailure),
    rematch: () => void socket.emitWithAck('game:rematch').then(reportFailure),
    raise: (bid, seq) => void socket.emitWithAck('game:raise', { bid, seq }).then(reportFailure),
    katzel: (seq) => void socket.emitWithAck('game:katzel', { seq }).then(reportFailure),
    liar: (seq) => void socket.emitWithAck('game:liar', { seq }).then(reportFailure),
  };
}
