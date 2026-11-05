# Perudo

Real-time multiplayer Perudo (Liar's Dice) with **Pacos**, **Katzel** and **jump-in** calls, built as an installable PWA.

- **Frontend**: React + TypeScript (Vite), hand-written `manifest.json` + service worker → GitHub Pages
- **Backend**: Node.js + Socket.io (authoritative game server) → Render
- **Shared**: one TypeScript package with the types and pure rule functions used by both sides

## Repository layout

```
.
├── .github/workflows/deploy.yml   # CI: typecheck + tests + build → GitHub Pages
├── render.yaml                    # Render Blueprint for the game server
├── package.json                   # npm workspaces root (shared, server, client)
├── shared/src/
│   ├── constants.ts               # MAX_DICE, TURN_DURATION_MS, player limits, reaction emoji…
│   ├── types.ts                   # RoomView (per-player state), socket event contracts
│   ├── rules.ts                   # bid legality, Paco conversion, counting, Liar/Katzel resolution
│   └── rules.test.ts
├── server/src/
│   ├── index.ts                   # entry: reads PORT / CLIENT_ORIGIN and listens
│   ├── app.ts                     # HTTP (/health) + Socket.io handlers, input validation
│   ├── roomRegistry.ts            # room codes → rooms
│   ├── room.ts                    # lobby, sessions/reconnect, host, timers, per-player views
│   ├── game.ts                    # game state machine (no timers, no sockets)
│   ├── game.test.ts               # rule-level tests of the engine
│   └── app.e2e.test.ts            # real Socket.io clients against a real server
└── client/
    ├── index.html
    ├── vite.config.ts             # base './' so the build works under /<repo>/ on Pages
    ├── public/
    │   ├── manifest.json          # PWA manifest
    │   ├── sw.js                  # service worker (app-shell cache)
    │   └── icons/                 # SVG + PNG icons (incl. maskable)
    └── src/
        ├── main.tsx               # React root + service worker registration (production only)
        ├── App.tsx                # chooses Home / Lobby / Game screen
        ├── useRoom.ts             # socket state + actions, auto-resume of a saved seat
        ├── socket.ts, session.ts  # connection URL, per-tab session storage
        ├── screens/               # HomeScreen, LobbyScreen, GameScreen
        ├── sound.ts               # Web Audio sound effects + vibration (no audio files)
        ├── useGameEffects.ts      # plays sounds on table events
        ├── useRevealStage.ts      # timing of the step-by-step reveal
        └── components/            # Table (seats, cups, die animations), Cup, Die, ActionPanel, RevealSummary…
```

## Run locally

Requirements: **Node.js 20+** (22 recommended).

```bash
npm install
npm run dev          # server on :3001 and client on :5173 together
```

Open <http://localhost:5173> in two or more tabs (each tab is a separate player), create a room in one and
join with the code (or the invite link) in the others.

**Play from phones on your Wi-Fi:** run `npm run dev:server` and `npm run dev:client -- --host`, then open
`http://<your-computer-LAN-IP>:5173` on the phone. The client automatically connects to port 3001 on the same host.

Other scripts:

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm test`          | Rule, engine and end-to-end Socket.io tests (Vitest) |
| `npm run typecheck` | TypeScript check of all three packages               |
| `npm run build`     | Production build of the client into `client/dist`    |
| `npm start`         | Run the game server (what Render runs)               |
| `npm run format`    | Prettier                                             |

## Deploy

The frontend is static (GitHub Pages); the Socket.io server needs a host that supports WebSockets (Render).

### 1. Game server on Render

1. Push this repository to GitHub.
2. Render dashboard → **New → Blueprint** → select the repository (it reads `render.yaml`).
3. When asked for `CLIENT_ORIGIN`, enter your Pages origin, e.g. `https://amitaimyers.github.io`
   (origin only: no `/Perudo` path, no trailing slash; separate several with commas).
4. After the deploy, note the service URL (e.g. `https://perudo-server.onrender.com`) and check
   `https://…onrender.com/health` returns `ok`.

> The free Render plan sleeps after ~15 minutes without traffic; the first visitor then waits ~30–60 s while it
> wakes up (the home screen shows "Connecting…"). Rooms live in memory, so a restart/sleep ends running games.

### 2. Frontend on GitHub Pages

1. GitHub repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   `VITE_SERVER_URL` = your Render URL (e.g. `https://perudo-server.onrender.com`).
3. Push to `main` (or run the workflow manually). The workflow typechecks, runs the tests, builds, and deploys to
   `https://<user>.github.io/<repo>/`. It fails fast if `VITE_SERVER_URL` is missing.

### Configuration

| Variable          | Where        | Default                             | Purpose                                 |
| ----------------- | ------------ | ----------------------------------- | --------------------------------------- |
| `VITE_SERVER_URL` | client build | `<page protocol>//<page host>:3001` | Socket.io server URL                    |
| `CLIENT_ORIGIN`   | server       | unset → any origin (dev only)       | Comma-separated allowed browser origins |
| `PORT`            | server       | `3001`                              | HTTP port (Render sets it)              |

## Game rules as implemented

Objective: be the last player with at least one die. Each player starts with 5 dice; 2–6 players per room.

**Pacos.** The 1 face is the Paco (bird). It is wild and counts toward any other face being bid.
A bid _on_ Pacos counts only Pacos. The first bid of a round cannot be on Pacos.

**Raising.** Bid a higher quantity of any face, or the same quantity of a higher face. Paco conversions:

| From → to      | Minimum quantity | Example                |
| -------------- | ---------------- | ---------------------- |
| normal → Pacos | half, rounded up | six 4s → three Pacos   |
| Pacos → Pacos  | +1               | three → four Pacos     |
| Pacos → normal | double + 1       | three Pacos → seven 5s |

**Turns & the 30-second timer.** Play is clockwise (seat order = join order). Each turn has 30 seconds;
when it expires the server acts for that player:

- no bid yet this round → the minimum opening bid (one 2)
- otherwise → **Liar** (counts as an in-turn call)

**Jumping in.** Anyone may act at any time, including making the opening bid or raising over their own bid.
After any action, the turn passes to the player clockwise after **whoever acted**. Nobody may call Liar on their
own call: not on their own bid, and not on their own pending Katzel. While a Katzel is pending, Liar challenges the
Katzel, so the bidder **may** call it (in a 2-player game the bidder is always the next player after a Katzel).

**Katzel.** Recorded against the current bid (one Katzel per bid); the turn passes clockwise from the Katzel
caller. A later raise cancels it. If Liar is called while it is pending, the dice are checked for an **exact**
count:

- not exact → the **Katzel caller** loses a die (Liar was right)
- exact → the **Liar caller** loses a die

**Liar.** The round stops, all dice are revealed and counted (Pacos included):

- fewer than bid → the **bidder** loses a die; otherwise the **Liar caller** loses a die
- **Jump-in bonus:** if Liar was called out of turn and was right, the caller regains a die (max 5).
  This also applies to an out-of-turn Liar on a Katzel.

**Next round.** The player who lost a die starts (if they were eliminated, the next player clockwise).
The reveal stays on screen for 10 seconds. Losing your last die eliminates you; you can keep watching.

### Lobby, reconnects and rematch

- The creator is host and starts the game. If the host goes offline, the first connected player becomes host.
- Invite links look like `https://<user>.github.io/Perudo/?room=ABCD`.
- **Refresh / dropped connection:** the seat is saved per browser tab (`sessionStorage`) and reclaimed
  automatically. The turn timer keeps running while you are away. In the lobby an offline seat is freed after
  30 seconds; during a game it is kept. **Leave** during a game keeps your seat (the timer plays for you).
- **Rematch:** after the game the host restarts with every player still connected.
- Rooms with nobody connected are deleted after 10 minutes.

## Playing experience

- **Round table:** players sit around an oval felt table, each behind their own colored, patterned cup (red, blue,
  yellow, green, magenta, orange). Every phone puts you at the bottom, with play running clockwise. Each cup shows its
  owner's **dice count** for everyone, and the middle of the table shows the current bid and the total dice in play.
- **Your dice match your cup.** At the reveal the cups lift one at a time to show each player's colored dice
  (matching dice glow) while the count ticks up in the middle of the table.
- **Losing and winning dice:** after the verdict the loser's cup comes back down and a die pops out and flies away
  (−1); a correct jump-in caller gets a die that flies into their cup, which bounces (+1). An eliminated player's
  cup is left lying on its side.

- **Your turn is unmistakable:** a glowing dock, a "YOUR TURN!" badge, a chime (plus vibration on Android), a ring
  draining around the active player's avatar, and ticks in your last 5 seconds.
- **Bid builder:** the bid you are about to make is previewed between the − / + buttons ("3 × ⚃") with a hint of how
  many you hold yourself; illegal options are disabled and every disabled button says why.
- **Liar needs two taps** ("Sure? tap again", 2 s window), so a mis-tap can't end the round; a new bid disarms it.
- **Dramatic reveal:** cups lift one player at a time, the matching count ticks up, then a big ✔ / ✘ verdict lands and
  the loser's seat shakes (the bonus winner's glows green).
- **Fun:** cup-shake and dice-tumble at the start of each round, emoji reactions (😀 button in the top bar, 1 per
  second), synthesized sound effects with a mute toggle, and confetti + fanfare for the winner.
- **Chat:** in the lobby the chat sits under the player list; in game the 💬 button (with an unread badge) opens a
  slide-up chat panel, and every new message also pops up as a speech bubble at the sender's seat. Quick-phrase chips
  ("Nice bluff! 😏", "No way! 😱"…) send in one tap. The server keeps the last 50 messages per room (in memory) and
  sends them to players who join or reconnect; messages are 1–200 characters, at most one every 0.6 s per player.
- **Help:** "How to play" sheet on the home screen, in the lobby and behind the **?** in game.
- **Accessibility:** respects the OS _reduce motion_ setting (no shakes, tumbles, staged reveal or confetti), 44 px+
  touch targets, labelled controls.

## How it works

- The server is **authoritative**: clients send intents (`game:raise`, `game:katzel`, `game:liar`), the server
  validates them with the shared rules and broadcasts a **personalized** `room:state`. Each player only ever
  receives their own dice until the reveal.
- Every state change bumps a sequence number that actions must echo. When two players jump in at the same moment,
  the first one wins and the second gets "The table changed…". Nobody can accidentally call Liar on a bid they
  never saw.
- Timers live on the server; clients get "milliseconds remaining" and count down locally, so device clocks don't
  matter.
- The service worker precaches the app shell (instant start, installable), uses network-first for pages so new
  deployments show up on the next load, and never intercepts the game server connection. The game itself needs
  a connection.
