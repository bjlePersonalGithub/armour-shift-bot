# Shift Bot

A Discord bot that posts a shift sign-up panel. Users click buttons to claim officer slots, toggle reserve status, or take a Tank Squire role. Assignments persist across restarts.

Runs over **HTTP interactions** (no Gateway connection) using TypeScript + Express. Deployable to **AWS Lambda** with DynamoDB-backed state, or runnable locally behind a tunnel.

## Features

- `/shift` command posts an embed with three shifts (Main + Secondary officer slots), a Tank Squire slot, and a Reserve list.
- Click a slot to claim it. Click your own slot to unassign. Occupied slots can't be stolen.
- Reserve is unlimited and can be held alongside a shift slot.
- State is persisted to **DynamoDB**, keyed by Discord message ID — each `/shift` post is independent.

## Prerequisites

- Node.js 20+ (uses native `fetch`)
- A Discord Application with a bot user — https://discord.com/developers/applications
- For Lambda deploy: an AWS account with the AWS CLI configured
- For local dev: a way to expose `localhost` publicly (ngrok, cloudflared, a VPS, etc.)
- For Docker-based local dev (recommended): Docker Desktop with Compose v2

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
| `DYNAMO_TABLE` | Name of the DynamoDB table (e.g. `shift-bot-state` or `shift-state` for Docker). Required in both local and Lambda environments. |
| `AWS_REGION` | AWS region the table lives in. Set to `us-east-1` for Docker; Lambda sets this automatically. |
| `DYNAMO_ENDPOINT` | **Local dev only.** Set to `http://localhost:8000` when running `npm start` against a dockerized DynamoDB Local. Leave blank in production — the SDK will talk to real AWS. Compose sets this automatically for the `app` container. |
| `OFFICER_ROLE_ID` | Optional. Discord role ID allowed to click shift buttons. Defaults to the hardcoded value in [src/config.ts](src/config.ts). |
| `SHIFT_TIMEZONE` | Optional. IANA timezone for shift labels. Defaults to `America/New_York`. |
| `PORT` | Local HTTP port, defaults to 3000 |

For local dev against **real AWS DynamoDB**, credentials are read from your `~/.aws/credentials` / environment (the same place the AWS CLI uses). For Docker-based local dev, Compose injects dummy credentials that DynamoDB Local accepts.

### 3. Invite the bot

In the Developer Portal → **OAuth2 → URL Generator**:

- Scopes: `bot`, `applications.commands`
- Bot permissions: `Send Messages`, `Embed Links`

Open the generated URL and add the bot to your server.

### 4. Register the slash command

```bash
npm run register
```

This `PUT`s the `/shift` command to Discord. Re-run it whenever you change command definitions in [src/register.ts](src/register.ts). Registration is per-application, not per-endpoint — you only need to do it once (or when commands change).

## Running locally

There are two paths: **Docker Compose** (recommended — fully self-contained, no AWS account needed) or **npm start** (runs Node on your host, talks to real AWS DynamoDB).

### Option A: Docker Compose (recommended)

Spins up the bot and an in-memory DynamoDB Local in one command. No AWS credentials or real tables required.

```bash
docker compose up --build
```

This starts three services:

| Service | Purpose |
| --- | --- |
| `dynamodb` | `amazon/dynamodb-local` on port 8000 (in-memory, shared DB) |
| `dynamodb-init` | One-shot `aws-cli` container that waits for DynamoDB, then creates the `shift-state` table. Exits when done. |
| `app` | Builds the Dockerfile, runs the bot on port 3000, points the SDK at `http://dynamodb:8000`. |

You should see `listening on :3000` from the `app` service.

`DYNAMO_ENDPOINT`, `AWS_REGION`, and dummy AWS credentials are all injected by [docker-compose.yml](docker-compose.yml) — the only required value in your `.env` is `DISCORD_PUBLIC_KEY`.

**Data is in-memory** — everything resets on `docker compose down` or a `dynamodb` container restart. To persist across restarts, swap `-inMemory` for `-dbPath ./data` in [docker-compose.yml](docker-compose.yml) and add a named volume.

To stop: `Ctrl+C`, then `docker compose down`.

### Option B: `npm start` (host Node, real AWS)

```bash
npm start
```

Requires a real AWS DynamoDB table (see [§1 under Deploying to AWS Lambda](#1-create-the-dynamodb-table)) and AWS credentials on your host. Do **not** set `DYNAMO_ENDPOINT` — leave it blank so the SDK talks to real AWS.

You can also mix: run only DynamoDB Local in Docker (`docker compose up dynamodb dynamodb-init`) and the app on your host with `DYNAMO_ENDPOINT=http://localhost:8000`.

### Expose the endpoint

Either path, in another terminal:

```bash
ngrok http 3000
```

Copy the `https://...ngrok-free.dev` URL.

### Point Discord at it

In the Developer Portal → General Information → **Interactions Endpoint URL**, paste:

```
https://<your-ngrok-host>/interactions
```

Click **Save Changes**. Discord will send a `PING` to verify — save succeeds only if your server responds with a valid signed `PONG`. If it fails, check `DISCORD_PUBLIC_KEY` in `.env`.

> ngrok free URLs change on every restart. Update the portal URL each time.

### Try it

In your server, run `/shift`. The embed appears with clickable buttons.

## Deploying to AWS Lambda

The bot bundles into a single zip file for manual upload to Lambda behind a Function URL. DynamoDB stores per-message state.

### 1. Create the DynamoDB table

AWS Console → DynamoDB → **Create table**:

- **Table name:** `shift-bot-state`
- **Partition key:** `messageId` (String)
- **Capacity mode:** On-demand (pay-per-request)

### 2. Build the zip

```bash
npm run build
```

Produces `dist/lambda.zip` (~500 KB — everything bundled with esbuild).

### 3. Create the Lambda function

AWS Console → Lambda → **Create function**:

- **Function name:** `shift-bot`
- **Runtime:** Node.js 20.x
- **Architecture:** x86_64
- **Execution role:** Create a new role with basic Lambda permissions

After creation:

- **Code** tab → **Upload from** → **.zip file** → select `dist/lambda.zip`
- **Runtime settings** → **Edit** → set **Handler** to `lambda.handler`
- **Configuration** → **General configuration** → Memory `512 MB`, Timeout `10 sec`

### 4. Grant DynamoDB access

**Configuration** → **Permissions** → click the execution role → IAM opens →
**Add permissions** → **Attach policies** → `AmazonDynamoDBFullAccess` (or a scoped inline policy for just `shift-bot-state`).

### 5. Set environment variables

**Configuration** → **Environment variables** → **Edit**:

| Key | Value |
| --- | --- |
| `DISCORD_PUBLIC_KEY` | From the Developer Portal |
| `DISCORD_APP_ID` | From the Developer Portal |
| `DISCORD_BOT_TOKEN` | From the Developer Portal |
| `DYNAMO_TABLE` | `shift-bot-state` |

### 6. Create a Function URL

**Configuration** → **Function URL** → **Create function URL**:

- **Auth type:** `NONE` (Discord authenticates via signature)
- **Invoke mode:** `BUFFERED`
- CORS: leave off

Copy the generated URL (`https://<id>.lambda-url.<region>.on.aws/`).

### 7. Point Discord at it

Developer Portal → General Information → **Interactions Endpoint URL**:

```
https://<id>.lambda-url.<region>.on.aws/interactions
```

Save. Discord sends a `PING` — a successful save means signature verification works.

### Updating the deployed function

```bash
npm run build
```

Then in the Lambda Console: **Code** tab → **Upload from** → **.zip file** → `dist/lambda.zip`. Changes go live within a few seconds.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Runs [src/index.ts](src/index.ts) via tsx |
| `npm run register` | Registers/updates the `/shift` command with Discord |
| `npm run build` | Bundles `src/lambda.ts` with esbuild and zips it to `dist/lambda.zip` |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
src/
├── index.ts              — HTTP entry, exports `app`
├── lambda.ts             — Lambda handler (wraps app with serverless-http)
├── register.ts           — slash-command registration script
├── config.ts             — env + shift definitions
├── shift/
│   ├── interactions.ts   — handleCommand / handleButton
│   ├── ui.ts             — buildEmbed / buildComponents
│   └── store.ts          — DynamoDB-backed per-message state
└── util/
    └── time.ts           — discordTime, isSaturdayIn, etc.

scripts/
└── build.mjs             — esbuild bundler + zip

Dockerfile                — node:24-alpine runtime image for the bot
docker-compose.yml        — bot + DynamoDB Local + table bootstrap
```

## How interactions flow

1. Discord sends a signed POST to `/interactions` (either your ngrok host or the Lambda Function URL).
2. [src/index.ts](src/index.ts) verifies the Ed25519 signature with `discord-interactions`.
3. Based on `body.type`:
   - `PING` (1): respond with `PONG`. Used by Discord to verify the endpoint.
   - `APPLICATION_COMMAND` (2): delegate to [handleCommand](src/shift/interactions.ts).
   - `MESSAGE_COMPONENT` (3): delegate to [handleButton](src/shift/interactions.ts).
4. Button handlers read state from DynamoDB, mutate it, write it back, and return an `UPDATE_MESSAGE` response that replaces the original embed in place.

Responses must be returned within **3 seconds** or Discord shows "The application did not respond". On Lambda, cold starts typically run 400–800 ms for this bundle — well inside the budget.

## State model

State is stored in DynamoDB, one item per Discord message:

```
Table: shift-bot-state
Partition key: messageId (String)
Attribute:     state     (Map / document)
```

The `state` document matches:

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

Each `/shift` post has its own item, so you can run multiple concurrently (e.g. different ops on different days).

## Button IDs

| `custom_id` | Slot |
| --- | --- |
| `s:1:m` / `s:1:s` | Shift 1 Main / Secondary |
| `s:2:m` / `s:2:s` | Shift 2 Main / Secondary |
| `s:3:m` / `s:3:s` | Shift 3 Main / Secondary |
| `ts` | Tank Squire |
| `r` | Toggle Reserve |

## Customizing shifts

Edit [src/config.ts](src/config.ts) to change labels or times. The button layout in [src/shift/ui.ts](src/shift/ui.ts) and slot keys in [src/shift/store.ts](src/shift/store.ts) assume exactly three shifts — adding or removing shifts requires updating both.

## Troubleshooting

**"The application did not respond"** — Discord couldn't reach your endpoint within 3s. Check: server is running (or Lambda isn't erroring), the Interactions Endpoint URL matches the current host, no crashes in logs. For Lambda, check CloudWatch logs (Lambda Console → Monitor → View CloudWatch logs).

**`Missing Access` (50001) when registering** — Bot wasn't invited with the `applications.commands` scope, or `DISCORD_GUILD_ID` points to a guild the bot isn't in. Re-invite with both `bot` and `applications.commands` scopes.

**Signature verification fails** — `DISCORD_PUBLIC_KEY` env var doesn't match the one in the Developer Portal. Copy it again (no whitespace, no quotes).

**`ResourceNotFoundException` on button clicks** — the Lambda is in a different region than the DynamoDB table, or `DYNAMO_TABLE` env var doesn't match the table name. Both must match.

**`AccessDeniedException` from DynamoDB** — the Lambda execution role doesn't have DynamoDB permissions. Attach `AmazonDynamoDBFullAccess` (or a scoped policy) to the role.

**Platform-specific esbuild error** — `node_modules` was installed on a different OS than it's running on. Delete `node_modules` and `package-lock.json`, then `npm install` in the environment where you'll run it.
