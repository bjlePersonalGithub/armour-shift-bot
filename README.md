# Shift Bot

A Discord bot that posts a shift sign-up panel. Users click buttons to claim officer slots, toggle reserve status, or take a Tank Squire role. Assignments persist across restarts.

Runs over **HTTP interactions** (no Gateway connection) using TypeScript + Express.

## Features

- `/shift` command posts an embed with three shifts (Main + Secondary officer slots), a Tank Squire slot, and a Reserve list.
- Click a slot to claim it. Click your own slot to unassign. Occupied slots can't be stolen.
- Reserve is unlimited and can be held alongside a shift slot.
- State is persisted to `data/shifts.json`, keyed by Discord message ID — each `/shift` post is independent.

## Prerequisites

- Node.js 18+ (uses native `fetch`)
- A Discord Application with a bot user — https://discord.com/developers/applications
- A way to expose `localhost` publicly (ngrok, cloudflared, a VPS, etc.)

## Setup

### 1. Install

```bash
npm install
```

> Note: if you switch between Windows and WSL, delete `node_modules` and reinstall in the new environment — esbuild ships native binaries that aren't cross-platform.

### 2. Configure `.env`

Copy `.env.example` to `.env` and fill in:

| Variable | Where to find it |
| --- | --- |
| `DISCORD_APP_ID` | Developer Portal → General Information → Application ID |
| `DISCORD_PUBLIC_KEY` | Developer Portal → General Information → Public Key |
| `DISCORD_BOT_TOKEN` | Developer Portal → Bot → Token (click Reset to reveal) |
| `DISCORD_GUILD_ID` | Optional. Right-click your server → Copy Server ID (Developer Mode must be on). Set this for instant command registration in one guild. Leave blank to register globally (takes up to 1 hour to propagate). |
| `PORT` | Local HTTP port, defaults to 3000 |

### 3. Invite the bot

In the Developer Portal → **OAuth2 → URL Generator**:

- Scopes: `bot`, `applications.commands`
- Bot permissions: `Send Messages`, `Embed Links`

Open the generated URL and add the bot to your server.

### 4. Register the slash command

```bash
npm run register
```

This `PUT`s the `/shift` command to Discord. Re-run it whenever you change command definitions in [src/register.ts](src/register.ts).

### 5. Start the server

```bash
npm start
```

You should see `listening on :3000`.

### 6. Expose the endpoint

In another terminal:

```bash
ngrok http 3000
```

Copy the `https://...ngrok-free.dev` URL.

### 7. Point Discord at it

In the Developer Portal → General Information → **Interactions Endpoint URL**, paste:

```
https://<your-ngrok-host>/interactions
```

Click **Save Changes**. Discord will send a `PING` to verify — save succeeds only if your server responds with a valid signed `PONG`. If it fails, check `DISCORD_PUBLIC_KEY` in `.env`.

> ngrok free URLs change on every restart. Update the portal URL each time.

### 8. Try it

In your server, run `/shift`. The embed appears with clickable buttons.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Runs [src/index.ts](src/index.ts) via tsx |
| `npm run register` | Registers/updates the `/shift` command with Discord |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
src/
  index.ts          Express server, verifies signatures, routes interactions
  interactions.ts   Handlers for /shift and button clicks
  ui.ts             Embed + button component builders
  store.ts          JSON persistence (data/shifts.json)
  config.ts         Shift definitions (times, labels)
  register.ts       One-off script to register the slash command
data/
  shifts.json       Persistent state, created on first interaction
```

## How interactions flow

1. Discord sends a signed POST to `/interactions`.
2. [src/index.ts](src/index.ts) verifies the Ed25519 signature with `discord-interactions`.
3. Based on `body.type`:
   - `PING` (1): respond with `PONG`. Used by Discord to verify the endpoint.
   - `APPLICATION_COMMAND` (2): delegate to [handleCommand](src/interactions.ts).
   - `MESSAGE_COMPONENT` (3): delegate to [handleButton](src/interactions.ts).
4. Button handlers mutate state, persist to disk, and return an `UPDATE_MESSAGE` response that replaces the original embed in place.

Responses must be returned within **3 seconds** or Discord shows "The application did not respond".

## State model

State is a flat object keyed by message ID. Each record:

```ts
interface ShiftState {
  shift1_main: string | null;      // user ID or null
  shift1_secondary: string | null;
  shift2_main: string | null;
  shift2_secondary: string | null;
  shift3_main: string | null;
  shift3_secondary: string | null;
  tank_squire: string | null;
  reserve: string[];               // unlimited user IDs
}
```

Each `/shift` post has its own entry, so you can run multiple concurrently (e.g. different ops on different days).

## Button IDs

| `custom_id` | Slot |
| --- | --- |
| `s:1:m` / `s:1:s` | Shift 1 Main / Secondary |
| `s:2:m` / `s:2:s` | Shift 2 Main / Secondary |
| `s:3:m` / `s:3:s` | Shift 3 Main / Secondary |
| `ts` | Tank Squire |
| `r` | Toggle Reserve |

## Customizing shifts

Edit [src/config.ts](src/config.ts) to change labels or times. The button layout in [src/ui.ts](src/ui.ts) and slot keys in [src/store.ts](src/store.ts) assume exactly three shifts — adding or removing shifts requires updating both.

## Troubleshooting

**"The application did not respond"** — Discord couldn't reach your endpoint within 3s. Check: server is running, ngrok is active, portal URL matches current ngrok host, no crashes in server logs.

**`Missing Access` (50001) when registering** — Bot wasn't invited with the `applications.commands` scope, or `DISCORD_GUILD_ID` points to a guild the bot isn't in. Re-invite with both `bot` and `applications.commands` scopes.

**Signature verification fails** — `DISCORD_PUBLIC_KEY` in `.env` doesn't match the one in the Developer Portal. Copy it again.

**Platform-specific esbuild error** — `node_modules` was installed on a different OS than it's running on. Delete `node_modules` and `package-lock.json`, then `npm install` in the environment where you'll run it.

**State appears to reset after restart** — check `data/shifts.json` exists and is valid JSON. State is keyed by message ID, so if that file is deleted, old `/shift` posts lose their state (the embed in Discord still shows old assignments until someone clicks, which then overwrites with a fresh empty state).

## Production notes

This repo is built for local dev. For production:

- Run behind a real reverse proxy (nginx, Caddy) with a stable TLS cert instead of ngrok.
- Use a process manager (systemd, pm2) to keep the server running.
- Back up `data/shifts.json` if assignments matter.
- Replace the flat JSON store with a database if you expect concurrent writes at any volume.
