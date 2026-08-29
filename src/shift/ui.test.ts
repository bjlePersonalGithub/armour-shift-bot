import { describe, it, expect, vi } from 'vitest';
import { SHIFTS } from '../config.js';

vi.mock('../util/time.js', () => ({
  discordTime: vi.fn(() => '<t:0:t>'),
  unixTimestampNextSaturdayAt: vi.fn(() => 0),
  isSaturdayIn: vi.fn(() => false),
}));

const { buildComponents, buildEmbed, buildPlainText } = await import('./ui.js');

interface TestComponent {
  type: number;
  custom_id?: string;
  label?: string;
  components?: TestComponent[];
}

function emptyState() {
  return {
    shift1_main: null,
    shift1_secondary: null,
    shift2_main: null,
    shift2_secondary: null,
    shift3_main: null,
    shift3_secondary: null,
    shift4_main: null,
    shift4_secondary: null,
    tank_squire: null,
    reserve: [],
  };
}

function customIds(rows: TestComponent[]): string[] {
  return rows.flatMap((r) => (r.components ?? []).map((b) => b.custom_id!));
}

describe('buildComponents - Discord payload limits', () => {
  it('stays within 5 action rows', () => {
    expect(buildComponents().length).toBeLessThanOrEqual(5);
  });

  it('puts at most 5 buttons in each row', () => {
    for (const row of buildComponents() as TestComponent[]) {
      expect(row.components?.length ?? 0).toBeLessThanOrEqual(5);
    }
  });
});

describe('buildComponents - slot coverage', () => {
  it('exposes a main and secondary button for every configured shift', () => {
    const ids = customIds(buildComponents() as TestComponent[]);
    for (const s of SHIFTS) {
      expect(ids).toContain(`s:${s.id}:m`);
      expect(ids).toContain(`s:${s.id}:s`);
    }
  });

  it('includes the shift 4 buttons', () => {
    const ids = customIds(buildComponents() as TestComponent[]);
    expect(ids).toContain('s:4:m');
    expect(ids).toContain('s:4:s');
  });

  it('keeps the reserve, tank maid, and finalize buttons', () => {
    const ids = customIds(buildComponents() as TestComponent[]);
    expect(ids).toEqual(expect.arrayContaining(['r', 'ts', 'fin']));
  });

  it('has no duplicate custom_ids', () => {
    const ids = customIds(buildComponents() as TestComponent[]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildEmbed', () => {
  it('renders a block for every configured shift', () => {
    const { description } = buildEmbed(emptyState()) as { description: string };
    for (const s of SHIFTS) {
      expect(description).toContain(`**Shift ${s.id} - ${s.label}**`);
    }
  });

  it('renders shift 4 with main and secondary lines', () => {
    const state = { ...emptyState(), shift4_main: 'u1', shift4_secondary: 'u2' };
    const { description } = buildEmbed(state) as { description: string };
    expect(description).toContain('<@u1>');
    expect(description).toContain('<@u2>');
  });
});

describe('buildPlainText', () => {
  it('lists every configured shift', () => {
    const text = buildPlainText(emptyState());
    for (const s of SHIFTS) {
      expect(text).toContain(`**Shift ${s.id} - ${s.label}**`);
    }
  });

  it('numbers the attendance hint through shift 4', () => {
    const text = buildPlainText(emptyState());
    expect(text).toContain('1️⃣ 2️⃣ 3️⃣ 4️⃣');
  });
});
