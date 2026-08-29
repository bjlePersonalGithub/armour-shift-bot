export type DutyKey =
  | 'tankmaster'
  | 'company_scribe'
  | 'manufactorum_master'
  | 'guardsmen_engagement_officer'
  | 'facility_team_liason'
  | 'ar_base_overseer';

export type DutyCategory = 'weekly' | 'war_long';

export interface DutyDef {
  key: DutyKey;
  customId: string;
  label: string;
  emote: string;
  category: DutyCategory;
  responsibilities: string[];
}

export const DUTIES: readonly DutyDef[] = [
  {
    key: 'tankmaster',
    customId: 'a:tm',
    label: 'Tankmaster',
    emote: '<:Armoured:1020843480400019456>',
    category: 'weekly',
    responsibilities: ['Sets MPF queues', 'Runs upgrade patrol for OP'],
  },
  {
    key: 'company_scribe',
    customId: 'a:cs',
    label: 'Company Scribe',
    emote: ':scroll:',
    category: 'weekly',
    responsibilities: [
      'Prepares Log List',
      'Posts welcome message for new members',
      'Post Shift list the Friday before OP',
      'Post new Duty Sheet next Sunday after Officer Meeting',
      'Refreshes Armor stockpiles every day and updates list as needed',
    ],
  },
  {
    key: 'manufactorum_master',
    customId: 'a:mm',
    label: 'Manufactorum Master',
    emote: '<:Machine_spirit:1468729031485554719>',
    category: 'weekly',
    responsibilities: [
      'Cooks Ammo for OP',
      'Maintains proper levels of tanker kit in Armor Stockpiles',
      'Leads scrap patrol if Rmat stocks are low',
    ],
  },
  {
    key: 'guardsmen_engagement_officer',
    customId: 'a:geo',
    label: 'Guardsmen Engagement Officer',
    emote: ':partying_face:',
    category: 'weekly',
    responsibilities: [
      'Leads a midweek Armor patrol',
      'Keeps the section engaged and focused',
    ],
  },
  {
    key: 'facility_team_liason',
    customId: 'a:ftl',
    label: 'Facility Team Liason',
    emote: ':factory:',
    category: 'war_long',
    responsibilities: [],
  },
  {
    key: 'ar_base_overseer',
    customId: 'a:abo',
    label: 'AR Base Overseer',
    emote: ':european_castle:',
    category: 'war_long',
    responsibilities: [],
  },
];
