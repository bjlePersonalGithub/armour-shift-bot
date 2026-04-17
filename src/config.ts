export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface ShiftDef {
  id: 1 | 2 | 3;
  label: string;
  start: TimeOfDay;
  end: TimeOfDay | null;
}

export const SHIFT_TIMEZONE = process.env['SHIFT_TIMEZONE'] ?? 'America/New_York';

export const OFFICER_ROLE_ID =
  process.env['OFFICER_ROLE_ID'] ?? '1020840585625616424';

export const SHIFTS: readonly ShiftDef[] = [
  {
    id: 1,
    label: 'Pre-OP / OP Start',
    start: { hour: 11, minute: 30 },
    end: { hour: 14, minute: 30 },
  },
  {
    id: 2,
    label: '1:30 Hours after OP Start',
    start: { hour: 14, minute: 30 },
    end: { hour: 16, minute: 30 },
  },
  {
    id: 3,
    label: '3:30 Hours after OP Start / Op end',
    start: { hour: 16, minute: 30 },
    end: null,
  },
];
