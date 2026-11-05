import type { SessionInfo } from '@perudo/shared';

// sessionStorage survives a refresh but is separate per tab, so several tabs can play as different players.
const SESSION_KEY = 'perudo.session';
// The last used name is a per-device convenience only.
const NAME_KEY = 'perudo.name';

export function loadSession(): SessionInfo | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw === null ? null : (JSON.parse(raw) as SessionInfo);
}

export function saveSession(session: SessionInfo): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function loadLastName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveLastName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
