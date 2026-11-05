import { useRoom, type RoomController } from './useRoom';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';

/** Invite links look like https://<user>.github.io/Perudo/?room=ABCD */
const INVITED_ROOM_CODE = new URLSearchParams(window.location.search).get('room') ?? '';

export function App() {
  const room = useRoom();
  const { view } = room;

  return (
    <>
      {room.error !== null && (
        <div className="toast" role="alert">
          <span>{room.error}</span>
          <button type="button" className="toast__close" onClick={room.dismissError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {!room.connected && view !== null && <div className="banner">Connection lost: reconnecting…</div>}

      <CurrentScreen room={room} />
    </>
  );
}

function CurrentScreen({ room }: { room: RoomController }) {
  const { view } = room;
  if (view === null && room.resuming) {
    return (
      <main className="screen">
        <p className="notice">Reconnecting to your seat…</p>
      </main>
    );
  }
  if (view === null) {
    return (
      <HomeScreen
        connected={room.connected}
        invitedRoomCode={INVITED_ROOM_CODE}
        onCreate={room.createRoom}
        onJoin={room.joinRoom}
      />
    );
  }
  if (view.phase === 'lobby') return <LobbyScreen view={view} onStart={room.startGame} onLeave={room.leaveRoom} />;
  return <GameScreen view={view} room={room} />;
}
