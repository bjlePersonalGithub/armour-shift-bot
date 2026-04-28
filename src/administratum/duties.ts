export type DutyKey =
  | 'tankmaster'
  | 'company_scribe'
  | 'manufactorum_master'
  | 'guardsmen_engagement_officer'
  | 'facility_team_liason'
  | 'ar_base_overseer';

export type DutyCategory = 'weekly' | 'warlord';

export interface DutyDef {
  key: DutyKey;
  customId: string;
  label: string;
  category: DutyCategory;
  responsibilities: string[];
}

export const DUTIES: readonly DutyDef[] = [
  {
    key: 'tankmaster',
    customId: 'a:tm',
    label: 'Tankmaster',
    category: 'weekly',
    responsibilities: ['Sets MPF queues', 'Runs upgrade patrol for OP'],
  },
  {
    key: 'company_scribe',
    customId: 'a:cs',
    label: 'Company Scribe',
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
    category: 'warlord',
    responsibilities: [],
  },
  {
    key: 'ar_base_overseer',
    customId: 'a:abo',
    label: 'AR Base Overseer',
    category: 'warlord',
    responsibilities: [],
  },
];
