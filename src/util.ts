import { SHIFT_TIMEZONE } from './config.js';
import type { TimeOfDay } from './config.js';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function weekdayIndexIn(timeZone: string, date: Date): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  return WEEKDAY_INDEX[short]!;
}

function ymdIn(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isSaturdayIn(timeZone: string = SHIFT_TIMEZONE): boolean {
  return weekdayIndexIn(timeZone, new Date()) === 6;
}

function nextSaturdayYmd(timeZone: string): string {
  const now = new Date();
  const offset = (6 - weekdayIndexIn(timeZone, now) + 7) % 7;
  const todayYmd = ymdIn(timeZone, now);
  const todayUtc = Date.parse(`${todayYmd}T00:00:00Z`);
  const target = new Date(todayUtc + offset * 86_400_000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function unixTimestampNextSaturdayAt(
  t: TimeOfDay,
  timeZone: string,
): number {
  const ymd = nextSaturdayYmd(timeZone);
  const hhmm = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  const guessMs = Date.parse(`${ymd}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guessMs));
  const part = (type: string): number =>
    Number(parts.find((p) => p.type === type)!.value);
  const asIfUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  const offsetMs = asIfUtc - guessMs;
  return Math.floor((guessMs - offsetMs) / 1000);
}

export function discordTime(t: TimeOfDay): string {
  return `<t:${unixTimestampNextSaturdayAt(t, SHIFT_TIMEZONE)}:t>`;
}
