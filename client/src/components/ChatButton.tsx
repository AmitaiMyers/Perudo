import { useEffect, useRef } from 'react';
import type { PublicPlayer } from '@perudo/shared';
import type { ChatController } from '../useChat';
import { ChatBox } from './ChatBox';
import { Icon } from './Icon';

interface ChatButtonProps {
  chat: ChatController;
  players: readonly PublicPlayer[];
  myPlayerId: string;
}

/** Top-bar chat button with an unread badge; opens the chat as a slide-up sheet over the table. */
export function ChatButton({ chat, players, myPlayerId }: ChatButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { open, setOpen } = chat;

  // The dialog element mirrors the controller's open state (it can also close itself via Esc).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) throw new Error('Chat sheet is not mounted.');
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="icon-button chat-button"
        onClick={() => setOpen(true)}
        aria-label={chat.unread > 0 ? `Chat, ${chat.unread} unread` : 'Chat'}
      >
        <Icon name="chat" />
        {chat.unread > 0 && <span className="chat-button__badge">{chat.unread > 9 ? '9+' : chat.unread}</span>}
      </button>
      <dialog
        ref={dialogRef}
        className="sheet sheet--bottom"
        aria-label="Chat"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false); // tap on the backdrop
        }}
      >
        <div className="sheet__content sheet__content--chat">
          <header className="sheet__header">
            <h2>Chat</h2>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </header>
          {open && <ChatBox chat={chat} players={players} myPlayerId={myPlayerId} />}
        </div>
      </dialog>
    </>
  );
}
