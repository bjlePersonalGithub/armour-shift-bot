import { SHIFTS } from '../config.js';
import type { ShiftState } from './store.js';
import { discordTime } from '../util/time.js';

type SlotKey = Exclude<keyof ShiftState, 'reserve'>;

function mention(id: string | null): string {
  return id ? `<@${id}>` : '_\u2014_';
}

function slotKey(id: number, slot: 'main' | 'secondary'): SlotKey {
  return `shift${id}_${slot}` as SlotKey;
}

function buildDescription(state: ShiftState, includeFooter: boolean): string {
  const shiftBlocks = SHIFTS.map((s) => {
    const main = state[slotKey(s.id, 'main')];
    const sec = state[slotKey(s.id, 'secondary')];
    const end = s.end ? discordTime(s.end) : 'End';
    return [
      `**Shift ${s.id} - ${s.label}** (${discordTime(s.start)} \u2192 ${end})`,
      `\u2003\u2003Main Officer = ${mention(main)}`,
      `\u2003\u2003Secondary Officer = ${mention(sec)}`,
    ].join('\n');
  }).join('\n\n');

  const reserveList =
    state.reserve.length === 0
      ? '_\u2014_'
      : state.reserve.map((id) => `<@${id}>`).join(', ');

  const lines = [
    shiftBlocks,
    '',
    `**Reserve officers:** ${reserveList}`,
    '',
    `**Special Role Tank Squire** = ${mention(state.tank_squire)}`,
  ];
  if (includeFooter) {
    lines.push('', '_Please indicate your attendance with the buttons below._');
  }
  return lines.join('\n');
}

export function buildEmbed(state: ShiftState): Record<string, unknown> {
  return {
    title: 'Shift Sign-Up',
    description: buildDescription(state, true),
    color: 0x2b2d31,
  };
}

export function buildPlainText(state: ShiftState): string {
  return [
    '# **:Armoured:  THE OFFICERS IN CHARGE OF TANK LINE**',
    buildDescription(state, false),
    '',
    '_Please indicate your attendance with the presented numbers 1\uFE0F\u20E3 2\uFE0F\u20E3 3\uFE0F\u20E3_',
  ].join('\n');
}

interface Component {
  type: number;
  style?: number;
  label?: string;
  custom_id?: string;
  components?: Component[];
}

function row(components: Component[]): Component {
  return { type: 1, components };
}

function btn(custom_id: string, label: string, style = 1): Component {
  return { type: 2, style, label, custom_id };
}

export function buildComponents(): Component[] {
  return [
    row([btn('s:1:m', 'Shift 1 Main'), btn('s:1:s', 'Shift 1 Secondary')]),
    row([btn('s:2:m', 'Shift 2 Main'), btn('s:2:s', 'Shift 2 Secondary')]),
    row([btn('s:3:m', 'Shift 3 Main'), btn('s:3:s', 'Shift 3 Secondary')]),
    row([btn('ts', 'Tank Squire', 3)]),
    row([btn('r', 'Toggle Reserve', 2), btn('fin', 'Finalize Sign-Up', 2)]),
  ];
}
