import fs from 'node:fs';
import path from 'node:path';

export interface ShiftState {
  shift1_main: string | null;
  shift1_secondary: string | null;
  shift2_main: string | null;
  shift2_secondary: string | null;
  shift3_main: string | null;
  shift3_secondary: string | null;
  tank_squire: string | null;
  reserve: string[];
}

type Store = Record<string, ShiftState>;

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'shifts.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Store {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

export function emptyState(): ShiftState {
  return {
    shift1_main: null,
    shift1_secondary: null,
    shift2_main: null,
    shift2_secondary: null,
    shift3_main: null,
    shift3_secondary: null,
    tank_squire: null,
    reserve: [],
  };
}

export function getState(messageId: string): ShiftState {
  const store = load();
  return store[messageId] ?? emptyState();
}

export function setState(messageId: string, state: ShiftState): void {
  const store = load();
  store[messageId] = state;
  save(store);
}
