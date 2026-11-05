import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, type LobbyView } from '@perudo/shared';
import { findPlayer } from '../players';

interface LobbyScreenProps {
  view: LobbyView;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyScreen({ view, onStart, onLeave }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const isHost = findPlayer(view.players, view.myPlayerId).isHost;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${view.roomCode}`;
  const enoughPlayers = view.players.length >= MIN_PLAYERS;

  // The Clipboard API only exists in secure contexts (HTTPS or localhost), so it is optional.
  const canCopy = window.isSecureContext && 'clipboard' in navigator;
  const copyInvite = () => void navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true));

  return (
    <main className="screen lobby">
      <p className="lobby__label">Room code</p>
      <p className="lobby__code">{view.roomCode}</p>
      <div className="invite">
        <input
          className="invite__url"
          value={inviteUrl}
          readOnly
          onFocus={(event) => event.target.select()}
          aria-label="Invite link"
        />
        {canCopy && (
          <button type="button" className="button button--secondary invite__copy" onClick={copyInvite}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>

      <section className="card">
        <h2>
          Players ({view.players.length}/{MAX_PLAYERS})
        </h2>
        <ul className="lobby__players">
          {view.players.map((player) => (
            <li key={player.id}>
              {player.name}
              {player.id === view.myPlayerId && <span className="tag">you</span>}
              {player.isHost && <span className="tag">host</span>}
              {!player.connected && <span className="tag tag--warn">offline</span>}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button type="button" className="button button--primary" disabled={!enoughPlayers} onClick={onStart}>
          {enoughPlayers ? 'Start game' : `Waiting for at least ${MIN_PLAYERS} players…`}
        </button>
      ) : (
        <p className="notice">Waiting for the host to start the game…</p>
      )}
      <button type="button" className="button button--ghost" onClick={onLeave}>
        Leave room
      </button>
    </main>
  );
}
