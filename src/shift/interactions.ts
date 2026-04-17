import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { emptyState, getState, setState } from './store.js';
import type { ShiftState } from './store.js';
import { buildComponents, buildEmbed } from './ui.js';
import { isSaturdayIn } from '../util/time.js';

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

export function handleCommand(): Record<string, unknown> {
  if (isSaturdayIn()) {
    return ephemeral(
      'Shift sign-ups cannot be started on Saturday. Please run this command on a day before the upcoming Saturday.',
    );
  }
  return rerender(emptyState(), false);
}

interface ButtonInteraction {
  data: { custom_id: string };
  message: { id: string };
  member?: { user: { id: string } };
  user?: { id: string };
}

export function handleButton(body: ButtonInteraction): Record<string, unknown> {
  const customId = body.data.custom_id;
  const userId = body.member?.user.id ?? body.user?.id;
  if (!userId) return ephemeral('Could not identify user.');

  const messageId = body.message.id;
  const state = getState(messageId);

  if (customId === 'r') {
    const idx = state.reserve.indexOf(userId);
    if (idx >= 0) state.reserve.splice(idx, 1);
    else state.reserve.push(userId);
    setState(messageId, state);
    return rerender(state, true);
  }

  const slot = SLOT_MAP[customId];
  if (!slot) return ephemeral('Unknown button.');

  const current = state[slot];
  if (current === userId) {
    state[slot] = null;
  } else if (current && current !== userId) {
    return ephemeral(`That slot is already held by <@${current}>. Ask them to release it first.`);
  } else {
    state[slot] = userId;
  }
  setState(messageId, state);
  return rerender(state, true);
}
