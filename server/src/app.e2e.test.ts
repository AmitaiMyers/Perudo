import type { AddressInfo } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  BiddingView,
  ChatMessage,
  ClientToServerEvents,
  Reaction,
  RoomView,
  ServerToClientEvents,
  SessionInfo,
} from '@perudo/shared';
import { createGameServer } from './app';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TestClient {
  socket: ClientSocket;
  latest: RoomView | null;
}

let server: HttpServer;
let url: string;
const openSockets: ClientSocket[] = [];

beforeAll(async () => {
  server = createGameServer(true);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const socket of openSockets) socket.disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function newClient(): Promise<TestClient> {
  const socket: ClientSocket = connect(url, { transports: ['websocket'], forceNew: true });
  openSockets.push(socket);
  const client: TestClient = { socket, latest: null };
  socket.on('room:state', (view) => {
    client.latest = view;
  });
  await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
  return client;
}

/** Resolves with the client's latest state once it satisfies `predicate` (checks already-received state first). */
function waitForState<T extends RoomView>(client: TestClient, predicate: (view: RoomView) => view is T): Promise<T>;
function waitForState(client: TestClient, predicate: (view: RoomView) => boolean): Promise<RoomView>;
function waitForState(client: TestClient, predicate: (view: RoomView) => boolean): Promise<RoomView> {
  if (client.latest !== null && predicate(client.latest)) return Promise.resolve(client.latest);
  return new Promise((resolve) => {
    const listener = (view: RoomView) => {
      if (!predicate(view)) return;
      client.socket.off('room:state', listener);
      resolve(view);
    };
    client.socket.on('room:state', listener);
  });
}

const isBidding = (view: RoomView): view is BiddingView => view.phase === 'bidding';

function expectSession(result: { ok: true; session: SessionInfo } | { ok: false; error: string }): SessionInfo {
  if (!result.ok) throw new Error(result.error);
  return result.session;
}

describe('multiplayer flow over Socket.io', () => {
  it('plays a round with an interruption, a Katzel and a Liar call, and resumes a dropped player', async () => {
    const alice = await newClient();
    const bob = await newClient();
    const carol = await newClient();

    const aliceSession = expectSession(await alice.socket.emitWithAck('room:create', { name: 'Alice' }));
    const bobSession = expectSession(
      await bob.socket.emitWithAck('room:join', { roomCode: aliceSession.roomCode.toLowerCase(), name: 'Bob' }),
    );
    expectSession(await carol.socket.emitWithAck('room:join', { roomCode: aliceSession.roomCode, name: 'Carol' }));

    const duplicate = await (
      await newClient()
    ).socket.emitWithAck('room:join', {
      roomCode: aliceSession.roomCode,
      name: 'alice',
    });
    expect(duplicate).toEqual({ ok: false, error: 'That name is already taken in this room.' });

    expect(await bob.socket.emitWithAck('game:start')).toEqual({
      ok: false,
      error: 'Only the host can start the game.',
    });
    expect(await alice.socket.emitWithAck('game:start')).toEqual({ ok: true });

    const clients = [alice, bob, carol];
    const views = await Promise.all(clients.map((client) => waitForState(client, isBidding)));
    for (const view of views) {
      expect(view.myDice).toHaveLength(5);
      expect(view.players.map((player) => player.name)).toEqual(['Alice', 'Bob', 'Carol']);
    }

    // Seat order is Alice → Bob → Carol; find who starts and who sits after them.
    const seatIds = views[0]!.players.map((player) => player.id);
    const starterIndex = seatIds.indexOf(views[0]!.turnPlayerId);
    const clientAt = (offset: number) => clients[(starterIndex + offset) % 3]!;
    const idAt = (offset: number) => seatIds[(starterIndex + offset) % 3]!;

    // Opening bid by the starter → turn passes to the next seat.
    const opener = clientAt(0);
    expect(
      await opener.socket.emitWithAck('game:raise', { bid: { quantity: 2, face: 3 }, seq: views[0]!.seq }),
    ).toEqual({ ok: true });
    let view = await waitForState(
      clientAt(2),
      (next): next is BiddingView => isBidding(next) && next.currentBid !== null,
    );
    expect(view.turnPlayerId).toBe(idAt(1));

    // The third seat jumps in → the turn skips to the seat after them (the opener).
    expect(
      await clientAt(2).socket.emitWithAck('game:raise', { bid: { quantity: 3, face: 3 }, seq: view.seq }),
    ).toEqual({
      ok: true,
    });
    view = await waitForState(opener, (next): next is BiddingView => isBidding(next) && next.bidderId === idAt(2));
    expect(view.turnPlayerId).toBe(idAt(0));
    expect(view.lastAction).toMatchObject({ kind: 'raise', interruption: true });

    // A stale sequence number is rejected.
    expect(await opener.socket.emitWithAck('game:liar', { seq: view.seq - 1 })).toMatchObject({ ok: false });

    // Katzel by the opener → turn passes to the second seat, who calls Liar (checked for an exact count).
    expect(await opener.socket.emitWithAck('game:katzel', { seq: view.seq })).toEqual({ ok: true });
    view = await waitForState(
      clientAt(1),
      (next): next is BiddingView => isBidding(next) && next.katzelCallerId !== null,
    );
    expect(view.turnPlayerId).toBe(idAt(1));
    expect(await clientAt(1).socket.emitWithAck('game:liar', { seq: view.seq })).toEqual({ ok: true });

    const reveal = await waitForState(alice, (next) => next.phase === 'reveal');
    if (reveal.phase !== 'reveal') throw new Error('Expected reveal');
    expect(Object.values(reveal.reveal.dice).flat()).toHaveLength(15);
    expect(reveal.reveal.katzelCallerId).toBe(idAt(0));
    expect([idAt(0), idAt(1)]).toContain(reveal.reveal.loserId);
    expect(reveal.players.reduce((total, player) => total + player.diceCount, 0)).toBe(14);

    // Bob's connection drops; a fresh socket reclaims his seat with the saved session.
    bob.socket.disconnect();
    const aliceSeesBobOffline = await waitForState(
      alice,
      (next) => next.players.find((player) => player.name === 'Bob')?.connected === false,
    );
    expect(aliceSeesBobOffline.players.find((player) => player.name === 'Bob')?.connected).toBe(false);

    const bobAgain = await newClient();
    expect(await bobAgain.socket.emitWithAck('room:resume', bobSession)).toEqual({ ok: true });
    expect(await bobAgain.socket.emitWithAck('room:resume', bobSession)).toEqual({ ok: true }); // repeat is harmless
    const resumed = await waitForState(bobAgain, (next) => next.phase !== 'lobby');
    expect(resumed.myPlayerId).toBe(bobSession.playerId);

    expect(
      await (await newClient()).socket.emitWithAck('room:resume', { ...bobSession, token: 'forged' }),
    ).toMatchObject({ ok: false });
  });

  it('rejects malformed input instead of crashing', async () => {
    const client = await newClient();
    expect(await client.socket.emitWithAck('room:create', { name: '   ' })).toMatchObject({ ok: false });
    expect(await client.socket.emitWithAck('room:join', { roomCode: 'ZZZZ', name: 'X' })).toEqual({
      ok: false,
      error: 'No room with that code.',
    });
    expectSession(await client.socket.emitWithAck('room:create', { name: 'Solo' }));
    const badBid = { bid: { quantity: -1, face: 9 }, seq: 0 } as unknown as Parameters<
      ClientToServerEvents['game:raise']
    >[0];
    expect(await client.socket.emitWithAck('game:raise', badBid)).toMatchObject({ ok: false });
    expect(await client.socket.emitWithAck('game:start')).toEqual({
      ok: false,
      error: 'At least 2 players are needed.',
    });
  });

  it('delivers chat messages, keeps recent history for (re)joining players, and validates input', async () => {
    const host = await newClient();
    const hostHistory = new Promise<ChatMessage[]>((resolve) => host.socket.once('chat:history', resolve));
    const hostSession = expectSession(await host.socket.emitWithAck('room:create', { name: 'Host' }));
    expect(await hostHistory).toEqual([]);

    const firstMessage = new Promise<ChatMessage>((resolve) => host.socket.once('chat:message', resolve));
    expect(await host.socket.emitWithAck('chat:send', { text: '  Good luck\neveryone! 🍀  ' })).toEqual({ ok: true });
    expect(await firstMessage).toMatchObject({
      playerId: hostSession.playerId,
      name: 'Host',
      text: 'Good luck everyone! 🍀',
    });

    // A player joining later receives the history.
    const guest = await newClient();
    const guestHistory = new Promise<ChatMessage[]>((resolve) => guest.socket.once('chat:history', resolve));
    const guestSession = expectSession(
      await guest.socket.emitWithAck('room:join', { roomCode: hostSession.roomCode, name: 'Guest' }),
    );
    expect((await guestHistory).map((message) => message.text)).toEqual(['Good luck everyone! 🍀']);

    // Everyone, including the sender, receives new messages.
    const hostReceives = new Promise<ChatMessage>((resolve) => host.socket.once('chat:message', resolve));
    expect(await guest.socket.emitWithAck('chat:send', { text: 'Thanks!' })).toEqual({ ok: true });
    expect(await hostReceives).toMatchObject({ name: 'Guest', text: 'Thanks!' });

    // Spam guard, empty and oversized messages.
    expect(await guest.socket.emitWithAck('chat:send', { text: 'again' })).toEqual({
      ok: false,
      error: 'Slow down a little!',
    });
    expect(await host.socket.emitWithAck('chat:send', { text: '   ' })).toMatchObject({ ok: false });
    expect(await host.socket.emitWithAck('chat:send', { text: 'x'.repeat(201) })).toMatchObject({ ok: false });

    // Reconnecting gets the history again.
    guest.socket.disconnect();
    const guestAgain = await newClient();
    const resumedHistory = new Promise<ChatMessage[]>((resolve) => guestAgain.socket.once('chat:history', resolve));
    expect(await guestAgain.socket.emitWithAck('room:resume', guestSession)).toEqual({ ok: true });
    expect((await resumedHistory).map((message) => message.text)).toEqual(['Good luck everyone! 🍀', 'Thanks!']);
  });

  it('broadcasts emoji reactions to the room and rate-limits them', async () => {
    const host = await newClient();
    const guest = await newClient();
    const hostSession = expectSession(await host.socket.emitWithAck('room:create', { name: 'Host' }));
    expectSession(await guest.socket.emitWithAck('room:join', { roomCode: hostSession.roomCode, name: 'Guest' }));

    const received = new Promise<Reaction>((resolve) => guest.socket.once('room:reaction', resolve));
    expect(await host.socket.emitWithAck('room:react', { emoji: '🔥' })).toEqual({ ok: true });
    expect(await received).toMatchObject({ playerId: hostSession.playerId, emoji: '🔥' });

    expect(await host.socket.emitWithAck('room:react', { emoji: '🔥' })).toMatchObject({ ok: false });
    expect(await guest.socket.emitWithAck('room:react', { emoji: '💩' })).toEqual({
      ok: false,
      error: 'Unknown reaction.',
    });
  });
});
