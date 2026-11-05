import { useCallback, useEffect, useState } from 'react';
import { CHAT_HISTORY_LIMIT, type AckResult, type ChatMessage } from '@perudo/shared';
import { socket } from './socket';

/** How long a new message stays as a speech bubble over the sender's cup. */
const SPEECH_BUBBLE_MS = 4_500;

export interface ChatController {
  messages: ChatMessage[];
  /** Messages from other players that have not been on screen yet. */
  unread: number;
  /** Messages that just arrived, shown as speech bubbles over the senders' cups. */
  bubbles: ChatMessage[];
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Called by a visible chat box: everything up to this message id has been seen. */
  markRead: (lastShownId: number) => void;
  send: (text: string) => Promise<AckResult>;
}

/** Room chat: recent history from the server, live messages, unread count and speech bubbles. */
export function useChat(myPlayerId: string | null): ChatController {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<ChatMessage[]>([]);
  const [lastSeenId, setLastSeenId] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // History replaces what we have: it arrives on join and after every reconnect.
    const handleHistory = (history: ChatMessage[]) => {
      setMessages(history);
      setLastSeenId(lastId(history));
    };
    const handleMessage = (message: ChatMessage) => {
      setMessages((current) => [...current, message].slice(-CHAT_HISTORY_LIMIT));
      setBubbles((current) => [...current, message]);
      window.setTimeout(
        () => setBubbles((current) => current.filter((bubble) => bubble.id !== message.id)),
        SPEECH_BUBBLE_MS,
      );
    };
    socket.on('chat:history', handleHistory);
    socket.on('chat:message', handleMessage);
    return () => {
      socket.off('chat:history', handleHistory);
      socket.off('chat:message', handleMessage);
    };
  }, []);

  // Leaving the room forgets its chat.
  useEffect(() => {
    if (myPlayerId !== null) return;
    setMessages([]);
    setBubbles([]);
    setLastSeenId(0);
    setOpen(false);
  }, [myPlayerId]);

  const markRead = useCallback((lastShownId: number) => {
    setLastSeenId((current) => Math.max(current, lastShownId));
  }, []);
  const send = useCallback((text: string) => socket.emitWithAck('chat:send', { text }), []);

  return {
    messages,
    unread: messages.filter((message) => message.id > lastSeenId && message.playerId !== myPlayerId).length,
    bubbles,
    open,
    setOpen,
    markRead,
    send,
  };
}

export function lastId(messages: readonly ChatMessage[]): number {
  const last = messages[messages.length - 1];
  return last === undefined ? 0 : last.id;
}
