import { useChat, type ChatController } from './useChat';
import { useRoom, type RoomController } from './useRoom';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';

/** Invite links look like https://<user>.github.io/Perudo/?room=ABCD */
const INVITED_ROOM_CODE = new URLSearchParams(window.location.search).get('room') ?? '';

export function App() {
  const room = useRoom();
  const { view } = room;
  const chat = useChat(view === null ? null : view.myPlayerId);

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

      <CurrentScreen room={room} chat={chat} />
    </>
  );
}

function CurrentScreen({ room, chat }: { room: RoomController; chat: ChatController }) {
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
  if (view.phase === 'lobby') {
    return <LobbyScreen view={view} chat={chat} onStart={room.startGame} onLeave={room.leaveRoom} />;
  }
  return <GameScreen view={view} room={room} chat={chat} />;
}
