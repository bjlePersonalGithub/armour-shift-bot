import {
  InteractionResponseType,
  InteractionResponseFlags,
} from 'discord-interactions';
import { emptyState, getState, setState } from './store.js';
import type { AdministratumState } from './store.js';
import { DUTIES } from './duties.js';
import type { DutyDef } from './duties.js';
import { buildComponents, buildEmbed, buildPlainText } from './ui.js';
import { OFFICER_ROLE_ID } from '../config.js';

const DUTY_BY_CUSTOM_ID: Record<string, DutyDef> = Object.fromEntries(
  DUTIES.map((d) => [d.customId, d]),
);

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

function rerender(state: AdministratumState): Record<string, unknown> {
  return {
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [buildEmbed(state)],
      components: buildComponents(),
      allowed_mentions: { parse: [] },
    },
  };
}

export function handleCommand(): Record<string, unknown> {
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

  if (customId === 'a:fin') {
    return ephemeral(
      `Copy the text below and paste it wherever you want to share the sign-up:\n\`\`\`\n${buildPlainText(state)}\n\`\`\``,
    );
  }

  const duty = DUTY_BY_CUSTOM_ID[customId];
  if (!duty) return ephemeral('Unknown button.');

  const current = state[duty.key];
  if (current === userId) {
    state[duty.key] = null;
  } else if (current && current !== userId) {
    return ephemeral(
      `That duty is already held by <@${current}>. Ask them to release it first.`,
    );
  } else {
    if (duty.category === 'weekly') {
      const existing = DUTIES.find(
        (d) => d.category === 'weekly' && state[d.key] === userId,
      );
      if (existing) {
        return ephemeral(
          `You already hold a weekly duty (${existing.label}). Release it before claiming another.`,
        );
      }
    }
    state[duty.key] = userId;
  }
  await setState(messageId, state);
  return rerender(state);
}
