import { createGameServer } from './app';

const PORT = Number(process.env.PORT ?? 3001);

/**
 * Comma-separated list of origins allowed to connect, e.g. https://<user>.github.io in production.
 * Unset (local development) means any origin, so phones on your LAN can join the Vite dev server.
 */
const CLIENT_ORIGINS: string[] | true =
  process.env.CLIENT_ORIGIN === undefined ? true : process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());

createGameServer(CLIENT_ORIGINS).listen(PORT, () => {
  const origins = CLIENT_ORIGINS === true ? 'any (CLIENT_ORIGIN not set: development mode)' : CLIENT_ORIGINS.join(', ');
  console.log(`Perudo server listening on port ${PORT}; allowed origins: ${origins}`);
});
