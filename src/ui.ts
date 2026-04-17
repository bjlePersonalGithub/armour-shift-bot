import { SHIFTS } from './config.js';
import type { ShiftState } from './store.js';

type SlotKey = Exclude<keyof ShiftState, 'reserve'>;

function mention(id: string | null): string {
  return id ? `<@${id}>` : '_\u2014_';
}

function slotKey(id: number, slot: 'main' | 'secondary'): SlotKey {
  return `shift${id}_${slot}` as SlotKey;
}

export function buildEmbed(state: ShiftState): Record<string, unknown> {
  const headerLines = SHIFTS.map((s) => {
    const left = `Shift ${s.id} - ${s.label}`;
    return `${left.padEnd(48)}( ${s.timing} )`;
  });
  const header = '```\n' + headerLines.join('\n') + '\n```';

  const shiftBlocks = SHIFTS.map((s) => {
    const main = state[slotKey(s.id, 'main')];
    const sec = state[slotKey(s.id, 'secondary')];
    return [
      `**Shift ${s.id}**`,
      `\u2003\u2003Main Officer = ${mention(main)}`,
      `\u2003\u2003Secondary Officer = ${mention(sec)}`,
    ].join('\n');
  }).join('\n');

  const reserveList =
    state.reserve.length === 0
      ? '_\u2014_'
      : state.reserve.map((id) => `<@${id}>`).join(', ');

  const description = [
    header,
    shiftBlocks,
    '',
    `**Reserve officers:** ${reserveList}`,
    '',
    `**Special Role Tank Squire** = ${mention(state.tank_squire)}`,
    '',
    '_Please indicate your attendance with the buttons below._',
  ].join('\n');

  return {
    title: 'Shift Sign-Up',
    description,
    color: 0x2b2d31,
  };
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
    row([btn('r', 'Toggle Reserve', 2)]),
  ];
}
