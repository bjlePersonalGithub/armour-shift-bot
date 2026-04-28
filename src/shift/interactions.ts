import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { emptyState, getState, setState } from './store.js';
import type { ShiftState } from './store.js';
import { buildComponents, buildEmbed, buildPlainText } from './ui.js';
import { isSaturdayIn } from '../util/time.js';
import { OFFICER_ROLE_ID, SHIFT_CHANNEL_ID } from '../config.js';

type SlotKey = Exclude<keyof ShiftState, 'reserve'>;

const SLOT_MAP: Record<string, SlotKey> = {
  's:1:m': 'shift1_main',
  's:1:s': 'shift1_secondary',
  's:2:m': 'shift2_main',
  's:2:s': 'shift2_secondary',
  's:3:m': 'shift3_main',
  's:3:s': 'shift3_secondary',
  ts: 'tank_squire',
};

function ephemeral(content: string): Record<string, unknown> {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
      allowed_mentions: { parse: [] },
    },
  };
}

function rerender(state: ShiftState, asUpdate: boolean): Record<string, unknown> {
  return {
    type: asUpdate
      ? InteractionResponseType.UPDATE_MESSAGE
      : InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [buildEmbed(state)],
      components: buildComponents(),
      allowed_mentions: { parse: [] },
    },
  };
}

export function handleCommand(channelId?: string): Record<string, unknown> {
  if (channelId !== SHIFT_CHANNEL_ID) {
    return ephemeral(
      `This command can only be used in <#${SHIFT_CHANNEL_ID}>.`,
    );
  }
  if (isSaturdayIn()) {
    return ephemeral(
      'Shift sign-ups cannot be started on Saturday. Please run this command on a day before the upcoming Saturday.',
    );
  }
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `<@&${OFFICER_ROLE_ID}>`,
      embeds: [buildEmbed(emptyState())],
      components: buildComponents(),
      allowed_mentions: { roles: [OFFICER_ROLE_ID] },
    },
  };
}

interface ButtonInteraction {
  data: { custom_id: string };
  message: { id: string };
  member?: { user: { id: string }; roles: string[] };
  user?: { id: string };
}

export async function handleButton(
  body: ButtonInteraction,
): Promise<Record<string, unknown>> {
  const customId = body.data.custom_id;
  const userId = body.member?.user.id ?? body.user?.id;
  if (!userId) return ephemeral('Could not identify user.');

  if (!body.member?.roles?.includes(OFFICER_ROLE_ID)) {
    return ephemeral('Only officers can use these buttons.');
  }

  const messageId = body.message.id;
  const state = await getState(messageId);

  if (customId === 'r') {
    const idx = state.reserve.indexOf(userId);
    if (idx >= 0) {
      state.reserve.splice(idx, 1);
    } else {
      const heldSlot = (Object.values(SLOT_MAP) as SlotKey[]).find(
        (k) => state[k] === userId,
      );
      if (heldSlot) {
        return ephemeral(
          'You are already signed up for a shift slot. Release it before joining reserves.',
        );
      }
      state.reserve.push(userId);
    }
    await setState(messageId, state);
    return rerender(state, true);
  }

  if (customId === 'fin') {
    return ephemeral(
      `Copy the text below and paste it wherever you want to share the sign-up:\n\`\`\`\n${buildPlainText(state)}\n\`\`\``,
    );
  }

  const slot = SLOT_MAP[customId];
  if (!slot) return ephemeral('Unknown button.');

  const current = state[slot];
  if (current === userId) {
    state[slot] = null;
  } else if (current && current !== userId) {
    return ephemeral(`That slot is already held by <@${current}>. Ask them to release it first.`);
  } else {
    if (state.reserve.includes(userId)) {
      return ephemeral(
        'You are in reserves. Leave reserves before signing up for a shift slot.',
      );
    }
    state[slot] = userId;
  }
  await setState(messageId, state);
  return rerender(state, true);
}
