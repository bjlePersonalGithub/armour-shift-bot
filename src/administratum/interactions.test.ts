import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { OFFICER_ROLE_ID, FACILITY_TEAM_ROLE_ID } from '../config.js';
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
  getStoredState: vi.fn(
    async (id: string): Promise<MockState | null> => store.get(id) ?? null,
  ),
  setState: vi.fn(async (id: string, s: MockState): Promise<void> => {
    store.set(id, s);
  }),
}));

const { fetchMembersWithRoles } = vi.hoisted(() => ({
  fetchMembersWithRoles: vi.fn(async (): Promise<string[]> => []),
}));

vi.mock('../util/discord.js', () => ({
  fetchMembersWithRoles,
}));

const { handleCommand, handleButton } = await import('./interactions.js');

type ResponseShape = {
  type: number;
  data?: {
    content?: string;
    flags?: number;
    embeds?: { description: string }[];
    components?: unknown[];
    allowed_mentions?: { parse?: string[]; roles?: string[] };
  };
};

const GUILD_ID = 'g1';

function officer(userId: string, extraRoles: string[] = []) {
  return {
    member: { user: { id: userId }, roles: [OFFICER_ROLE_ID, ...extraRoles] },
    guild_id: GUILD_ID,
  };
}

function nonOfficer(userId: string) {
  return {
    member: { user: { id: userId }, roles: [] },
    guild_id: GUILD_ID,
  };
}

beforeEach(() => {
  store.clear();
  fetchMembersWithRoles.mockReset();
  fetchMembersWithRoles.mockResolvedValue([]);
});

describe('handleCommand', () => {
  it('returns embed, components, and officer role mention', async () => {
    const res = (await handleCommand(GUILD_ID)) as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(res.data?.content).toBe(`<@&${OFFICER_ROLE_ID}>`);
    expect(res.data?.embeds).toHaveLength(1);
    expect(Array.isArray(res.data?.components)).toBe(true);
    expect(res.data?.allowed_mentions).toEqual({ roles: [OFFICER_ROLE_ID] });
  });

  it('initial embed has all duties empty when no FTL candidates exist', async () => {
    const res = (await handleCommand(GUILD_ID)) as ResponseShape;
    const embed = res.data?.embeds?.[0]!;
    expect(embed.description).not.toMatch(/<@\d+>/);
  });

  it('initial embed includes every duty label', async () => {
    const res = (await handleCommand(GUILD_ID)) as ResponseShape;
    const embed = res.data?.embeds?.[0]!;
    for (const duty of DUTIES) {
      expect(embed.description).toContain(duty.label);
    }
  });

  it('queries members with both officer and facility team roles', async () => {
    await handleCommand(GUILD_ID);
    expect(fetchMembersWithRoles).toHaveBeenCalledWith(GUILD_ID, [
      OFFICER_ROLE_ID,
      FACILITY_TEAM_ROLE_ID,
    ]);
  });

  it('auto-assigns FTL when a single candidate has both roles', async () => {
    fetchMembersWithRoles.mockResolvedValue(['u-ftl']);
    const res = (await handleCommand(GUILD_ID)) as ResponseShape;
    const embed = res.data?.embeds?.[0]!;
    expect(embed.description).toContain('Facility Team Liason — <@u-ftl>');
  });

  it('picks the first candidate when multiple have both roles', async () => {
    fetchMembersWithRoles.mockResolvedValue(['u-ftl', 'u-other']);
    const res = (await handleCommand(GUILD_ID)) as ResponseShape;
    const embed = res.data?.embeds?.[0]!;
    expect(embed.description).toContain('<@u-ftl>');
    expect(embed.description).not.toContain('<@u-other>');
  });

  it('skips the lookup when guild_id is missing', async () => {
    const res = (await handleCommand(undefined)) as ResponseShape;
    expect(fetchMembersWithRoles).not.toHaveBeenCalled();
    const embed = res.data?.embeds?.[0]!;
    expect(embed.description).not.toMatch(/<@\d+>/);
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

describe('handleButton - facility team liason role enforcement', () => {
  it('rejects FTL claim when officer lacks the Facility Team role', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:ftl' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/facility team liason role holder/i);
    expect(store.get('m1')).toBeUndefined();
  });

  it('assigns FTL when officer has the Facility Team role', async () => {
    const res = (await handleButton({
      data: { custom_id: 'a:ftl' },
      message: { id: 'm1' },
      ...officer('u1', [FACILITY_TEAM_ROLE_ID]),
    })) as ResponseShape;
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(store.get('m1')?.facility_team_liason).toBe('u1');
  });

  it('releases FTL when the role holder presses again', async () => {
    store.set('m1', { ...fresh(), facility_team_liason: 'u1' });
    await handleButton({
      data: { custom_id: 'a:ftl' },
      message: { id: 'm1' },
      ...officer('u1', [FACILITY_TEAM_ROLE_ID]),
    });
    expect(store.get('m1')?.facility_team_liason).toBeNull();
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

  it('allows a single user to hold one weekly and one war long duty', async () => {
    await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    await handleButton({
      data: { custom_id: 'a:abo' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.tankmaster).toBe('u1');
    expect(store.get('m1')?.ar_base_overseer).toBe('u1');
  });

  it('rejects a second weekly duty when user already holds one', async () => {
    store.set('m1', { ...fresh(), tankmaster: 'u1' });
    const res = (await handleButton({
      data: { custom_id: 'a:cs' },
      message: { id: 'm1' },
      ...officer('u1'),
    })) as ResponseShape;
    expect(res.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(res.data?.content).toMatch(/already hold a weekly duty/i);
    expect(store.get('m1')?.company_scribe).toBeNull();
    expect(store.get('m1')?.tankmaster).toBe('u1');
  });

  it('allows holding multiple war_long duties', async () => {
    await handleButton({
      data: { custom_id: 'a:ftl' },
      message: { id: 'm1' },
      ...officer('u1', [FACILITY_TEAM_ROLE_ID]),
    });
    await handleButton({
      data: { custom_id: 'a:abo' },
      message: { id: 'm1' },
      ...officer('u1', [FACILITY_TEAM_ROLE_ID]),
    });
    expect(store.get('m1')?.facility_team_liason).toBe('u1');
    expect(store.get('m1')?.ar_base_overseer).toBe('u1');
  });

  it('allows claiming a weekly duty after releasing the previous one', async () => {
    store.set('m1', { ...fresh(), tankmaster: 'u1' });
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
    expect(store.get('m1')?.tankmaster).toBeNull();
    expect(store.get('m1')?.company_scribe).toBe('u1');
  });

  it('maps every duty custom_id to the correct field', async () => {
    for (const duty of DUTIES) {
      store.clear();
      const extraRoles =
        duty.key === 'facility_team_liason' ? [FACILITY_TEAM_ROLE_ID] : [];
      await handleButton({
        data: { custom_id: duty.customId },
        message: { id: 'm1' },
        ...officer('u1', extraRoles),
      });
      expect(store.get('m1')?.[duty.key]).toBe('u1');
    }
  });
});

describe('handleButton - FTL auto-assignment seed on first interaction', () => {
  it('seeds FTL into stored state when a non-FTL button is clicked first', async () => {
    fetchMembersWithRoles.mockResolvedValue(['u-ftl']);
    await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.facility_team_liason).toBe('u-ftl');
    expect(store.get('m1')?.tankmaster).toBe('u1');
  });

  it('does not re-seed FTL once state has been persisted', async () => {
    fetchMembersWithRoles.mockResolvedValue(['u-ftl']);
    store.set('m1', { ...fresh(), facility_team_liason: null });
    await handleButton({
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      ...officer('u1'),
    });
    expect(store.get('m1')?.facility_team_liason).toBeNull();
    expect(fetchMembersWithRoles).not.toHaveBeenCalled();
  });
});

describe('handleButton - unknown', () => {
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