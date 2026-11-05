import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MESSAGE_MAX_LENGTH, type PublicPlayer } from '@perudo/shared';
import { playerTheme } from '../players';
import { lastId, type ChatController } from '../useChat';

/** One-tap lines for fast table talk. */
const QUICK_PHRASES = [
  'Good luck 🍀',
  'Nice bluff! 😏',
  'No way! 😱',
  'I trust you 😇',
  'Liar liar 🔥',
  'Hurry up ⏱️',
  'Good game 🤝',
] as const;

interface ChatBoxProps {
  chat: ChatController;
  players: readonly PublicPlayer[];
  myPlayerId: string;
}

/** Message list, quick phrases and the input. Used inline in the lobby and inside the in-game chat sheet. */
export function ChatBox({ chat, players, myPlayerId }: ChatBoxProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view; whatever this box shows counts as read.
  const { messages, markRead } = chat;
  useEffect(() => {
    const list = listRef.current;
    if (list === null) throw new Error('Chat list is not mounted.');
    list.scrollTop = list.scrollHeight;
    markRead(lastId(messages));
  }, [messages, markRead]);

  const send = (text: string, clearDraft: boolean) => {
    void chat.send(text).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      if (clearDraft) setDraft('');
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim().length > 0) send(draft, true);
  };

  return (
    <div className="chat">
      <ol ref={listRef} className="chat__messages" aria-live="polite" aria-label="Chat messages">
        {chat.messages.length === 0 && <li className="chat__empty">No messages yet. Say hi! 👋</li>}
        {chat.messages.map((message) => {
          // The sender may have left the lobby since; their old messages then show in a neutral color.
          const stillSeated = players.some((player) => player.id === message.playerId);
          const mine = message.playerId === myPlayerId;
          return (
            <li key={message.id} className={`chat__message ${mine ? 'chat__message--mine' : ''}`}>
              <span
                className="chat__name"
                style={stillSeated ? { color: playerTheme(players, message.playerId).cup } : undefined}
              >
                {mine ? 'You' : message.name}
              </span>
              <span className="chat__text">{message.text}</span>
            </li>
          );
        })}
      </ol>

      <div className="chat__phrases" role="group" aria-label="Quick phrases">
        {QUICK_PHRASES.map((phrase) => (
          <button key={phrase} type="button" className="chat__phrase" onClick={() => send(phrase, false)}>
            {phrase}
          </button>
        ))}
      </div>

      <form className="chat__form" onSubmit={submit}>
        <input
          className="chat__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder="Message the table…"
          enterKeyHint="send"
          autoComplete="off"
          aria-label="Chat message"
        />
        <button type="submit" className="button button--primary chat__send" disabled={draft.trim().length === 0}>
          Send
        </button>
      </form>
      {error !== null && <p className="chat__error">{error}</p>}
    </div>
  );
}
