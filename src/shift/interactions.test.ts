import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { OFFICER_ROLE_ID } from '../config.js';

interface MockShiftState {
  shift1_main: string | null;
  shift1_secondary: string | null;
  shift2_main: string | null;
  shift2_secondary: string | null;
  shift3_main: string | null;
  shift3_secondary: string | null;
  tank_squire: string | null;
  reserve: string[];
}

const store = new Map<string, MockShiftState>();

function fresh(): MockShiftState {
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

vi.mock('./store.js', () => ({
  emptyState: (): MockShiftState => fresh(),
  getState: vi.fn(
    async (id: string): Promise<MockShiftState> => store.get(id) ?? fresh(),
  ),
  setState: vi.fn(async (id: string, s: MockShiftState): Promise<void> => {
    store.set(id, s);
  }),
}));

vi.mock('../util/time.js', () => ({
  isSaturdayIn: vi.fn(() => false),
  discordTime: vi.fn(() => '<t:0:t>'),
  unixTimestampNextSaturdayAt: vi.fn(() => 0),
}));

const { handleCommand, handleButton } = await import('./interactions.js');
const { isSaturdayIn } = await import('../util/time.js');
const mockedIsSaturday = vi.mocked(isSaturdayIn);

type ResponseShape = {
  type: number;
  data?: {
    content?: string;
    flags?: number;
    embeds?: unknown[];
    components?: unknown[];
    allowed_mentions?: { parse?: string[]; roles?: string[] };
  };
};

function officer(userId: string) {
  return {
    member: { user: { id: userId }, roles: [OFFICER_ROLE_ID] },
  };
}

function nonOfficer(userId: string) {
  return {
    member: { user: { id: userId }, roles: [] },
  };
}

beforeEach(() => {
  store.clear();
  mockedIsSaturday.mockReturnValue(false);
});

describe('handleCommand', () => {
  it('returns ephemeral block message on Saturday', () => {
    mockedIsSaturday.mockReturnValue(true);
    const res = handleCommand() as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/Saturday/i);
  });

  it('returns embed, components, and role mention on weekdays', () => {
    const res = handleCommand() as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(res.data?.content).toBe(`<@&${OFFICER_ROLE_ID}>`);
    expect(res.data?.embeds).toHaveLength(1);
    expect(Array.isArray(res.data?.components)).toBe(true);
    expect(res.data?.allowed_mentions).toEqual({ roles: [OFFICER_ROLE_ID] });
  });

  it('initial embed has all slots empty', () => {
    const res = handleCommand() as ResponseShape;
    const embed = res.data?.embeds?.[0] as { description: string };
    expect(embed.description).not.toMatch(/<@\d+>/);
  });
});

describe('handleButton - authorization', () => {
  it('rejects when member has no officer role', async () => {
    const res = (await handleButton({
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
      ...nonOfficer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/officers/i);
  });

  it('rejects when no user can be identified', async () => {
    const res = (await handleButton({
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/identify/i);
  });
});

describe('handleButton - slot claim/release', () => {
  it('claims an empty slot and persists state', async () => {
    const res = (await handleButton({
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(store.get('m1')?.shift1_main).toBe('u1');
  });

  it('releases own slot when pressed again', async () => {
    store.set('m1', { ...fresh(), shift1_main: 'u1' });
    await handleButton({
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.shift1_main).toBeNull();
  });

  it('rejects claim when slot is held by another user', async () => {
    store.set('m1', { ...fresh(), shift1_main: 'u1' });
    const res = (await handleButton({
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
      ...officer('u2'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/already held/i);
    expect(store.get('m1')?.shift1_main).toBe('u1');
  });

  it('maps every shift slot custom_id to the correct field', async () => {
    const pairs: Array<[string, keyof MockShiftState]> = [
      ['s:1:m', 'shift1_main'],
      ['s:1:s', 'shift1_secondary'],
      ['s:2:m', 'shift2_main'],
      ['s:2:s', 'shift2_secondary'],
      ['s:3:m', 'shift3_main'],
      ['s:3:s', 'shift3_secondary'],
      ['ts', 'tank_squire'],
    ];
    for (const [customId, field] of pairs) {
      store.clear();
      await handleButton({
        data: { custom_id: customId },
        message: { id: 'm1' },
        ...officer('u1'),
      });
      expect(store.get('m1')?.[field]).toBe('u1');
    }
  });
});

describe('handleButton - reserve toggle', () => {
  it('adds the user to reserve when not present', async () => {
    await handleButton({
      data: { custom_id: 'r' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.reserve).toEqual(['u1']);
  });

  it('removes the user from reserve when present', async () => {
    store.set('m1', { ...fresh(), reserve: ['u1', 'u2'] });
    await handleButton({
      data: { custom_id: 'r' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.reserve).toEqual(['u2']);
  });

  it('supports multiple distinct reserves', async () => {
    await handleButton({
      data: { custom_id: 'r' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    await handleButton({
      data: { custom_id: 'r' },
      message: { id: 'm1' },
      ...officer('u2'),
    });
    expect(store.get('m1')?.reserve).toEqual(['u1', 'u2']);
  });
});

describe('handleButton - finalize and unknown', () => {
  it('finalize returns an ephemeral plaintext block', async () => {
    const res = (await handleButton({
      data: { custom_id: 'fin' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/Copy the text/i);
    expect(res.data?.content).toContain('```');
  });

  it('rejects unknown custom_id', async () => {
    const res = (await handleButton({
      data: { custom_id: 'not-a-real-id' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/unknown/i);
  });
});
