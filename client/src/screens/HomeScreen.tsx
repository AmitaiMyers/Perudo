import { useState, type FormEvent } from 'react';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@perudo/shared';
import { Die } from '../components/Die';
import { HowToPlay } from '../components/HowToPlay';
import { loadLastName, saveLastName } from '../session';

interface HomeScreenProps {
  connected: boolean;
  /** Room code taken from a shared invite link (?room=CODE), or empty. */
  invitedRoomCode: string;
  onCreate: (name: string) => void;
  onJoin: (roomCode: string, name: string) => void;
}

/**
 * Two flows: arriving from an invite link puts "Join" front and center;
 * otherwise "Create a room" is the main action and joining by code is secondary.
 */
export function HomeScreen({ connected, invitedRoomCode, onCreate, onJoin }: HomeScreenProps) {
  const [name, setName] = useState(loadLastName);
  const [roomCode, setRoomCode] = useState(invitedRoomCode);
  const [creatingInstead, setCreatingInstead] = useState(false);
  const trimmedName = name.trim();
  const nameReady = trimmedName.length > 0 && connected;
  const codeReady = roomCode.trim().length === ROOM_CODE_LENGTH;
  const invited = invitedRoomCode.length === ROOM_CODE_LENGTH && !creatingInstead;

  const withName = (action: (cleanName: string) => void) => {
    saveLastName(trimmedName);
    action(trimmedName);
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (nameReady && codeReady) withName((cleanName) => onJoin(roomCode.trim().toUpperCase(), cleanName));
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (nameReady) withName(onCreate);
  };

  const nameField = (
    <label className="field">
      <span className="field__label">Your name</span>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="nickname"
        enterKeyHint="go"
        placeholder="What should we call you?"
      />
    </label>
  );

  return (
    <main className="screen home">
      <header className="home__hero">
        <div className="home__dice" aria-hidden="true">
          <Die face={1} size={58} />
          <Die face={5} size={58} />
          <Die face={3} size={58} />
        </div>
        <h1 className="home__title">Perudo</h1>
        <p className="home__tagline">Bid. Bluff. Call Liar!</p>
      </header>

      {invited ? (
        <form className="card card--invite" onSubmit={join}>
          <p className="card__eyebrow">You&rsquo;re invited to room</p>
          <p className="home__invite-code">{invitedRoomCode}</p>
          {nameField}
          <button type="submit" className="button button--primary button--block" disabled={!nameReady}>
            Join the game
          </button>
          <button type="button" className="link-button" onClick={() => setCreatingInstead(true)}>
            Create my own room instead
          </button>
        </form>
      ) : (
        <>
          <form className="card" onSubmit={create}>
            {nameField}
            <button type="submit" className="button button--primary button--block" disabled={!nameReady}>
              Create a room
            </button>
          </form>

          <form className="join-row" onSubmit={join}>
            <label className="join-row__label" htmlFor="room-code">
              Have a code?
            </label>
            <input
              id="room-code"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              maxLength={ROOM_CODE_LENGTH}
              className="join-row__code"
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="go"
              placeholder="ABCD"
            />
            <button type="submit" className="button button--secondary" disabled={!nameReady || !codeReady}>
              Join
            </button>
          </form>
        </>
      )}

      {!connected && <p className="notice notice--pulse">Waking up the game server… (can take up to a minute)</p>}
      <HowToPlay variant="text" />
    </main>
  );
}
