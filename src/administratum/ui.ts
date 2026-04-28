import { DUTIES } from './duties.js';
import type { DutyCategory, DutyDef } from './duties.js';
import type { AdministratumState } from './store.js';

function mention(id: string | null): string {
  return id ? `<@${id}>` : '_—_';
}

function dutyBlock(duty: DutyDef, state: AdministratumState): string {
  const lines = [`**${duty.label}** = ${mention(state[duty.key])}`];
  for (const r of duty.responsibilities) {
    lines.push(`  • ${r}`);
  }
  return lines.join('\n');
}

function categoryHeading(category: DutyCategory): string {
  return category === 'weekly' ? '__**Weekly Roles:**__' : '__**Warlord Roles:**__';
}

function buildDescription(state: AdministratumState, includeFooter: boolean): string {
  const sections: string[] = [];
  const categories: DutyCategory[] = ['weekly', 'warlord'];
  for (const category of categories) {
    const duties = DUTIES.filter((d) => d.category === category);
    if (duties.length === 0) continue;
    sections.push(
      [categoryHeading(category), ...duties.map((d) => dutyBlock(d, state))].join(
        '\n\n',
      ),
    );
  }
  const description = sections.join('\n\n');
  if (!includeFooter) return description;
  return `${description}\n\n_Sign up for a duty with the buttons below. Click your own duty again to release it._`;
}

export function buildEmbed(state: AdministratumState): Record<string, unknown> {
  return {
    title: 'Weekly Duty Sign-Up',
    description: buildDescription(state, true),
    color: 0x2b2d31,
  };
}

export function buildPlainText(state: AdministratumState): string {
  return [
    '# **DUTY ASSIGNMENTS FOR THE COMING WEEK**',
    buildDescription(state, false),
  ].join('\n\n');
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function buildComponents(): Component[] {
  const buttons = DUTIES.map((d) => btn(d.customId, d.label));
  const rows = chunk(buttons, 2).map((r) => row(r));
  rows.push(row([btn('a:fin', 'Finalize Sign-Up', 2)]));
  return rows;
}
