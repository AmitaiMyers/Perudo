import { createServer, type Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  describeMalformedBid,
  type Ack,
  type Bid,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@perudo/shared';
import { RoomRegistry } from './roomRegistry';
import type { Room } from './room';

interface Seat {
  roomCode: string;
  playerId: string;
}

interface SocketData {
  seat: Seat | null;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Builds the HTTP server (health check) with the Socket.io game server attached. Call `listen` on the result.
 * @param clientOrigins allowed browser origins, or `true` for any origin (development).
 */
export function createGameServer(clientOrigins: string[] | true): HttpServer {
  const httpServer = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    response.writeHead(404).end();
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: clientOrigins },
  });

  const registry = new RoomRegistry({
    emitState: (socketId, view) => io.to(socketId).emit('room:state', view),
    emitReaction: (socketId, reaction) => io.to(socketId).emit('room:reaction', reaction),
    emitChat: (socketId, message) => io.to(socketId).emit('chat:message', message),
    emitChatHistory: (socketId, messages) => io.to(socketId).emit('chat:history', messages),
  });

  io.on('connection', (socket: GameSocket) => {
    socket.data.seat = null;

    socket.on('room:create', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (socket.data.seat !== null) return ack({ ok: false, error: 'Leave your current room first.' });
      if (!isRecord(payload)) return ack({ ok: false, error: 'Invalid request.' });
      const room = registry.create();
      const session = room.join(payload.name, socket.id);
      if (typeof session === 'string') {
        registry.remove(room.code);
        return ack({ ok: false, error: session });
      }
      socket.data.seat = { roomCode: session.roomCode, playerId: session.playerId };
      ack({ ok: true, session });
    });

    socket.on('room:join', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (socket.data.seat !== null) return ack({ ok: false, error: 'Leave your current room first.' });
      if (!isRecord(payload) || typeof payload.roomCode !== 'string')
        return ack({ ok: false, error: 'Invalid request.' });
      const room = registry.find(payload.roomCode);
      if (room === null) return ack({ ok: false, error: 'No room with that code.' });
      const session = room.join(payload.name, socket.id);
      if (typeof session === 'string') return ack({ ok: false, error: session });
      socket.data.seat = { roomCode: session.roomCode, playerId: session.playerId };
      ack({ ok: true, session });
    });

    socket.on('room:resume', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (
        !isRecord(payload) ||
        typeof payload.roomCode !== 'string' ||
        typeof payload.playerId !== 'string' ||
        typeof payload.token !== 'string'
      ) {
        return ack({ ok: false, error: 'Invalid request.' });
      }
      const currentSeat = socket.data.seat;
      if (currentSeat !== null) {
        // Resuming the seat this socket already holds is a harmless repeat (e.g. React StrictMode).
        const sameSeat = currentSeat.roomCode === payload.roomCode && currentSeat.playerId === payload.playerId;
        return ack(sameSeat ? { ok: true } : { ok: false, error: 'Leave your current room first.' });
      }
      const room = registry.find(payload.roomCode);
      if (room === null) return ack({ ok: false, error: 'That room has closed.' });
      const error = room.resume(payload.playerId, payload.token, socket.id);
      if (error !== null) return ack({ ok: false, error });
      socket.data.seat = { roomCode: room.code, playerId: payload.playerId };
      ack({ ok: true });
    });

    socket.on('room:leave', (ack) => {
      if (!isAckFunction(socket, ack)) return;
      const seated = findSeatedRoom(registry, socket);
      if (typeof seated === 'string') return ack({ ok: false, error: seated });
      socket.data.seat = null;
      seated.room.leave(seated.playerId);
      ack({ ok: true });
    });

    socket.on('game:start', (ack) => {
      if (!isAckFunction(socket, ack)) return;
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) => room.start(playerId)),
      );
    });

    socket.on('room:react', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (!isRecord(payload)) return ack({ ok: false, error: 'Invalid request.' });
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) => room.react(playerId, payload.emoji)),
      );
    });

    socket.on('chat:send', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (!isRecord(payload)) return ack({ ok: false, error: 'Invalid request.' });
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) => room.sendChat(playerId, payload.text)),
      );
    });

    socket.on('game:rematch', (ack) => {
      if (!isAckFunction(socket, ack)) return;
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) => room.rematch(playerId)),
      );
    });

    socket.on('game:raise', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (!isRecord(payload) || !isSeq(payload.seq)) return ack({ ok: false, error: 'Invalid request.' });
      const malformed = describeMalformedBid(payload.bid);
      if (malformed !== null) return ack({ ok: false, error: malformed });
      const bid = payload.bid as Bid;
      const seq = payload.seq;
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) =>
          room.raise(playerId, { quantity: bid.quantity, face: bid.face }, seq),
        ),
      );
    });

    socket.on('game:katzel', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (!isRecord(payload) || !isSeq(payload.seq)) return ack({ ok: false, error: 'Invalid request.' });
      const seq = payload.seq;
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) => room.katzel(playerId, seq)),
      );
    });

    socket.on('game:liar', (payload, ack) => {
      if (!isAckFunction(socket, ack)) return;
      if (!isRecord(payload) || !isSeq(payload.seq)) return ack({ ok: false, error: 'Invalid request.' });
      const seq = payload.seq;
      respond(
        ack,
        withSeat(registry, socket, (room, playerId) => room.liar(playerId, seq)),
      );
    });

    socket.on('disconnect', () => {
      const seated = findSeatedRoom(registry, socket);
      if (typeof seated === 'string') return;
      seated.room.disconnect(seated.playerId, socket.id);
    });
  });

  return httpServer;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Clients that omit the acknowledgement callback are misbehaving; drop them instead of crashing. */
function isAckFunction(socket: GameSocket, ack: unknown): ack is Ack {
  if (typeof ack === 'function') return true;
  socket.disconnect(true);
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function findSeatedRoom(registry: RoomRegistry, socket: GameSocket): { room: Room; playerId: string } | string {
  const seat = socket.data.seat;
  if (seat === null) return 'You are not in a room.';
  const room = registry.find(seat.roomCode);
  if (room === null) return 'That room has closed.';
  return { room, playerId: seat.playerId };
}

/** Runs a room action for the socket's seat, returning the action's error message (or null). */
function withSeat(
  registry: RoomRegistry,
  socket: GameSocket,
  action: (room: Room, playerId: string) => string | null,
): string | null {
  const seated = findSeatedRoom(registry, socket);
  if (typeof seated === 'string') return seated;
  return action(seated.room, seated.playerId);
}

function respond(ack: Ack, error: string | null): void {
  ack(error === null ? { ok: true } : { ok: false, error });
}
