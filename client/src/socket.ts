import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@perudo/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** In development the server runs next to Vite on port 3001 (also works from a phone on the LAN). */
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: GameSocket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
