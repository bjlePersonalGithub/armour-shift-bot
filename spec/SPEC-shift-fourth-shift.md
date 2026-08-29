# Spec: Fourth Shift for `/shift`

**Status:** Draft — awaiting review
**Branch:** `fourth-shift` (based on `master`)

## Objective

The `/shift` sign-up panel currently covers three shifts, the last of which is open-ended
("3:30 Hours after OP Start / Op end", 16:30 → End). Operations now run long enough that the
third shift is too broad to staff meaningfully.

Add a **fourth shift** that begins two hours after shift 3 starts and runs until the end of the
operation. Shift 3 becomes bounded; shift 4 inherits the open-ended tail.

**User:** Officers in the shift channel clicking sign-up buttons. **Success:** an officer can
claim Shift 4 Main or Shift 4 Secondary exactly as they claim shifts 1–3, the assignment
persists, and the embed and finalize text both show four shifts.

### Derived times

Existing labels imply **OP Start = 13:00** (shift 2 at 14:30 is labelled "1:30 Hours after OP
Start"; shift 3 at 16:30 is "3:30 Hours after OP Start"). Two hours after shift 3 is therefore
**18:30**, which is 5:30 after OP Start.

| Shift | Label | Start | End | Change |
|---|---|---|---|---|
| 1 | Pre-OP / OP Start | 11:30 | 14:30 | unchanged |
| 2 | 1:30 Hours after OP Start | 14:30 | 16:30 | unchanged |
| 3 | 3:30 Hours after OP Start | 16:30 | **18:30** | end added; `/ Op end` dropped from label |
| 4 | **5:30 Hours after OP Start / Op end** | **18:30** | End (open-ended) | new |

## Assumptions

Correct any of these before implementation starts:

1. "2 hours after shift 3" means two hours after shift 3 **starts** (18:30), not after some other
   anchor. Shift 3 gains a hard end at that time rather than overlapping shift 4.
2. Shift 4 has the same shape as every other shift: **Main + Secondary** officer slots, same
   claim/release/conflict rules, same officer-role gate.
3. Shift 4 participates in the existing reserve mutual-exclusion rule (holding Shift 4 Main blocks
   joining reserves, and vice versa).
4. The `/administratum` command is untouched.
5. No new environment variables; times stay hardcoded in `src/config.ts` like the existing three.
6. Existing `/shift` posts already in DynamoDB should keep working — they render Shift 4 as empty
   rather than crashing.

## Tech Stack

Unchanged. TypeScript 6, Express 5, `discord-interactions` 4, AWS SDK v3 (DynamoDB Document
Client), Vitest 4. Node 24 on Lambda.

## Commands

```
Typecheck: npm run typecheck
Test:      npm test
Single:    npx vitest run src/shift/interactions.test.ts
Dev:       npm run dev
Deploy:    npm run deploy
```

`npm run register` is **not** required — the command definition (`/shift`, no options) does not
change, only its response payload.

## Project Structure

Files this change touches:

```
spec/SPEC-shift-fourth-shift.md   → this document
src/config.ts                     → ShiftDef.id union + SHIFTS array
src/shift/store.ts                → ShiftState fields, emptyState(), getState() back-compat
src/shift/interactions.ts         → SLOT_MAP entries for s:4:m / s:4:s
src/shift/ui.ts                   → button rows, plaintext emoji hint
src/shift/interactions.test.ts    → mock state shape, slot mapping coverage, new tests
README.md                         → docs: three shifts → four
```

`src/administratum/`, `src/index.ts`, `src/lambda.ts`, `src/register.ts` and the Docker/deploy
files are out of scope.

## Design decisions

### 1. Button layout — Discord's five-action-row limit (blocking)

The panel currently uses **all five** allowed action rows:

```
[ Shift 1 Main ][ Shift 1 Secondary ]
[ Shift 2 Main ][ Shift 2 Secondary ]
[ Shift 3 Main ][ Shift 3 Secondary ]
[ Toggle Reserve ][ Tank Squire ]
[ Finalize Sign-Up ]
```

A message may carry at most **5 action rows** (5 buttons each). Naively adding a Shift 4 row makes
six and Discord rejects the payload. The rows must be reorganised.

**Chosen: Option A — merge the utility buttons into one row.**

```
[ Shift 1 Main ][ Shift 1 Secondary ]
[ Shift 2 Main ][ Shift 2 Secondary ]
[ Shift 3 Main ][ Shift 3 Secondary ]
[ Shift 4 Main ][ Shift 4 Secondary ]
[ Toggle Reserve ][ Tank Squire ][ Finalize Sign-Up ]
```

Keeps one row per shift and full-length labels; exactly 5 rows.

**Tradeoff:** this consumes the last row. A future fifth shift forces a further restructure —
likely Option B (two shifts per row with shortened `S1 Main` labels), which frees rows now but
makes the panel harder to read. Recorded here so the next change knows the ceiling was reached
deliberately.

### 2. Backward compatibility for stored state

`getState` currently returns the stored map as-is. Items written before this change have no
`shift4_main` / `shift4_secondary` keys, so those fields would come back `undefined` while typed
`string | null`. Fix by spreading over a fresh empty state:

```ts
return { ...emptyState(), ...(res.Item?.['state'] as Partial<ShiftState> | undefined) };
```

This makes old posts render Shift 4 as empty and claimable, and keeps the type honest.

## Code Style

Match the existing modules: named exports, explicit return types, `.js` extensions on relative
imports, `process.env['X']` bracket access, Unicode escapes for non-ASCII in string literals.
The `SHIFTS` array drives the embed, so adding a shift is a data change plus the slot plumbing:

```ts
export interface ShiftDef {
  id: 1 | 2 | 3 | 4;
  label: string;
  start: TimeOfDay;
  end: TimeOfDay | null;
}

// src/config.ts — appended to SHIFTS
{
  id: 4,
  label: '5:30 Hours after OP Start / Op end',
  start: { hour: 18, minute: 30 },
  end: null,
},
```

## Testing Strategy

Vitest, tests co-located as `src/**/*.test.ts`. `./store.js` and `../util/time.js` stay mocked at
the module boundary — no DynamoDB, no network.

Changes to `src/shift/interactions.test.ts`:

- Extend `MockShiftState` and `fresh()` with `shift4_main` / `shift4_secondary`.
- Add `['s:4:m', 'shift4_main']` and `['s:4:s', 'shift4_secondary']` to the slot-mapping table test.
- New: claiming Shift 4 while in reserves is rejected.
- New: joining reserves while holding a Shift 4 slot is rejected.
- New: `buildComponents()` returns at most 5 rows, each with at most 5 buttons, and includes
  `s:4:m` and `s:4:s` — this is the regression guard for the Discord limit.

Existing tests must pass unchanged apart from the state-shape additions.

## Boundaries

- **Always:** run `npm run typecheck` and `npm test` before committing; keep the four shifts driven
  off `SHIFTS` rather than hardcoding a fourth block in `ui.ts`.
- **Ask first:** changing shift 1/2 times, altering the DynamoDB table or key schema, adding
  dependencies, touching `src/administratum/`, pushing the branch or opening a PR, running
  `npm run deploy`.
- **Never:** commit secrets or `.env`; delete or weaken existing tests to make new code pass;
  rename existing `custom_id` values (`s:1:m` … `s:3:s`, `r`, `ts`, `fin`) — live messages still
  send them.

## Success Criteria

1. `npm run typecheck` and `npm test` both pass.
2. `SHIFTS` has four entries; shift 3 ends 18:30, shift 4 runs 18:30 → open-ended.
3. `buildEmbed` renders four shift blocks, each with Main and Secondary lines.
4. `buildComponents()` returns ≤ 5 rows of ≤ 5 buttons, including `s:4:m` and `s:4:s`.
5. `s:4:m` / `s:4:s` claim, release, and conflict exactly like `s:3:m` / `s:3:s`, and persist.
6. Reserve mutual exclusion covers shift 4 in both directions.
7. `buildPlainText` lists four shifts and its emoji hint reads `1️⃣ 2️⃣ 3️⃣ 4️⃣`.
8. A stored state written before this change loads without error and shows Shift 4 empty.
9. README reflects four shifts (feature list, state model, button-ID table, customizing note).

## Open Questions

All resolved at review; none outstanding.

1. ~~**18:30 confirmed?**~~ Confirmed. Shift 3 becomes bounded at 18:30; shift 4 takes the
   open-ended tail.
2. ~~**Shift 4 label wording**~~ Confirmed as "5:30 Hours after OP Start / Op end", following the
   existing "hours after OP Start" pattern.
3. ~~**Button layout**~~ Confirmed as Option A — one row per shift, utility buttons merged into
   row 5. The panel is now at Discord's row ceiling by deliberate choice.
