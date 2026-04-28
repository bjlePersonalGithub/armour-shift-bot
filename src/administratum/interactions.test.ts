import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { OFFICER_ROLE_ID } from '../config.js';
import { DUTIES } from './duties.js';
import type { DutyKey } from './duties.js';

type MockState = Record<DutyKey, string | null>;

function fresh(): MockState {
  const state = {} as MockState;
  for (const duty of DUTIES) {
    state[duty.key] = null;
  }
  return state;
}

const store = new Map<string, MockState>();

vi.mock('./store.js', () => ({
  emptyState: (): MockState => fresh(),
  getState: vi.fn(
    async (id: string): Promise<MockState> => store.get(id) ?? fresh(),
  ),
  setState: vi.fn(async (id: string, s: MockState): Promise<void> => {
    store.set(id, s);
  }),
}));

const { handleCommand, handleButton } = await import('./interactions.js');

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
});

describe('handleCommand', () => {
  it('returns embed, components, and officer role mention', () => {
    const res = handleCommand() as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(res.data?.content).toBe(`<@&${OFFICER_ROLE_ID}>`);
    expect(res.data?.embeds).toHaveLength(1);
    expect(Array.isArray(res.data?.components)).toBe(true);
    expect(res.data?.allowed_mentions).toEqual({ roles: [OFFICER_ROLE_ID] });
  });

  it('initial embed has all duties empty', () => {
    const res = handleCommand() as ResponseShape;
    const embed = res.data?.embeds?.[0] as { description: string };
    expect(embed.description).not.toMatch(/<@\d+>/);
  });

  it('initial embed includes every duty label', () => {
    const res = handleCommand() as ResponseShape;
    const embed = res.data?.embeds?.[0] as { description: string };
    for (const duty of DUTIES) {
      expect(embed.description).toContain(duty.label);
    }
  });
});

describe('handleButton - authorization', () => {
  it('rejects when member has no officer role', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...nonOfficer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/officers/i);
  });

  it('rejects when no user can be identified', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/identify/i);
  });
});

describe('handleButton - duty claim/release', () => {
  it('claims an empty duty and persists state', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(store.get('m1')?.tankmaster).toBe('u1');
  });

  it('releases own duty when pressed again', async () => {
    store.set('m1', { ...fresh(), tankmaster: 'u1' });
    await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.tankmaster).toBeNull();
  });

  it('rejects claim when duty is held by another user', async () => {
    store.set('m1', { ...fresh(), tankmaster: 'u1' });
    const res = (await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u2'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/already held/i);
    expect(store.get('m1')?.tankmaster).toBe('u1');
  });

  it('allows a single user to hold multiple distinct duties', async () => {
    await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    await handleButton({
      data: { custom_id: 'a:cs' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.tankmaster).toBe('u1');
    expect(store.get('m1')?.company_scribe).toBe('u1');
  });

  it('maps every duty custom_id to the correct field', async () => {
    for (const duty of DUTIES) {
      store.clear();
      await handleButton({
        data: { custom_id: duty.customId },
        message: { id: 'm1' },
        ...officer('u1'),
      });
      expect(store.get('m1')?.[duty.key]).toBe('u1');
    }
  });
});

describe('handleButton - finalize and unknown', () => {
  it('finalize returns an ephemeral plaintext block', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:fin' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/Copy the text/i);
    expect(res.data?.content).toContain('```');
  });

  it('rejects unknown custom_id', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:not-real' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/unknown/i);
  });
});
