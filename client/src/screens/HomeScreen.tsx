import { useState, type FormEvent } from 'react';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@perudo/shared';
import { Die } from '../components/Die';
import { loadLastName, saveLastName } from '../session';

interface HomeScreenProps {
  connected: boolean;
  /** Room code taken from a shared invite link (?room=CODE), or empty. */
  invitedRoomCode: string;
  onCreate: (name: string) => void;
  onJoin: (roomCode: string, name: string) => void;
}

export function HomeScreen({ connected, invitedRoomCode, onCreate, onJoin }: HomeScreenProps) {
  const [name, setName] = useState(loadLastName);
  const [roomCode, setRoomCode] = useState(invitedRoomCode);
  const trimmedName = name.trim();
  const nameReady = trimmedName.length > 0 && connected;
  const codeReady = roomCode.trim().length === ROOM_CODE_LENGTH;

  const withName = (action: (cleanName: string) => void) => {
    saveLastName(trimmedName);
    action(trimmedName);
  };

  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    withName((cleanName) => onJoin(roomCode.trim().toUpperCase(), cleanName));
  };

  return (
    <main className="screen home">
      <header className="home__hero">
        <div className="home__dice">
          <Die face={1} size={56} />
          <Die face={5} size={56} />
          <Die face={3} size={56} />
        </div>
        <h1>Perudo</h1>
        <p className="home__tagline">Liar&rsquo;s dice with Pacos, Katzel and jump-ins.</p>
      </header>

      <label className="field">
        <span className="field__label">Your name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="nickname"
          placeholder="e.g. Amitai"
        />
      </label>

      <form className="card" onSubmit={submitJoin}>
        <label className="field">
          <span className="field__label">Room code</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            maxLength={ROOM_CODE_LENGTH}
            className="field__code"
            autoCapitalize="characters"
            placeholder="ABCD"
          />
        </label>
        <button type="submit" className="button button--primary" disabled={!nameReady || !codeReady}>
          Join room
        </button>
      </form>

      <div className="divider">or</div>

      <button
        type="button"
        className="button button--secondary"
        disabled={!nameReady}
        onClick={() => withName(onCreate)}
      >
        Create a new room
      </button>

      {!connected && (
        <p className="notice">Connecting to the game server… (a sleeping free server can take up to a minute)</p>
      )}
    </main>
  );
}
