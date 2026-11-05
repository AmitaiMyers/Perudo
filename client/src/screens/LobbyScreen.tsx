import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, type LobbyView } from '@perudo/shared';
import { Cup } from '../components/Cup';
import { HowToPlay } from '../components/HowToPlay';
import { findPlayer, playerTheme } from '../players';

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
  const openSeats = MAX_PLAYERS - view.players.length;
  // The Clipboard API only exists in secure contexts (HTTPS or localhost), so it is optional.
  const canCopy = window.isSecureContext && 'clipboard' in navigator;
  const copyInvite = () => void navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true));

  return (
    <main className="screen lobby">
      <section className="lobby__header">
        <p className="card__eyebrow">Room code</p>
        <p className="lobby__code">{view.roomCode}</p>
        <p className="lobby__subtitle">Share the link so friends can grab a seat</p>
        <div className="invite">
          <input
            className="invite__url"
            value={inviteUrl}
            readOnly
            onFocus={(event) => event.target.select()}
            aria-label="Invite link"
          />
          {canCopy && (
            <button type="button" className="button button--secondary" onClick={copyInvite}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">
          At the table{' '}
          <span className="card__count">
            {view.players.length}/{MAX_PLAYERS}
          </span>
        </h2>
        <ul className="lobby__seats">
          {view.players.map((player) => (
            <li key={player.id} className={`lobby__seat ${player.connected ? '' : 'lobby__seat--offline'}`}>
              <Cup theme={playerTheme(view.players, player.id)} size={38} />
              <span className="lobby__name">
                {player.name}
                {player.id === view.myPlayerId && <span className="seat__you"> (you)</span>}
              </span>
              {player.isHost && <span className="pill pill--host">👑 host</span>}
              {!player.connected && <span className="pill pill--offline">offline</span>}
            </li>
          ))}
          {Array.from({ length: openSeats }, (_, index) => (
            <li key={`open-${index}`} className="lobby__seat lobby__seat--open">
              <span className="lobby__open-avatar" aria-hidden="true" />
              <span className="lobby__name">Open seat</span>
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button
          type="button"
          className="button button--primary button--block"
          disabled={!enoughPlayers}
          onClick={onStart}
        >
          {enoughPlayers
            ? `Start game with ${view.players.length} players`
            : `Waiting for ${MIN_PLAYERS - view.players.length} more player…`}
        </button>
      ) : (
        <p className="notice notice--pulse">Waiting for the host to start the game…</p>
      )}
      <div className="lobby__footer">
        <HowToPlay variant="text" />
        <button type="button" className="link-button" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </main>
  );
}
