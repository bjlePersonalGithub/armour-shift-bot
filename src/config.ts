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

export const SHIFT_TIMEZONE: string = process.env['SHIFT_TIMEZONE'] ?? 'America/New_York';

export const OFFICER_ROLE_ID: string =
  process.env['OFFICER_ROLE_ID'] ?? '1020840585625616424';

export const SHIFT_CHANNEL_ID: string =
  process.env['SHIFT_CHANNEL_ID'] ?? '1494671599561998486';

export const FACILITY_TEAM_ROLE_ID: string =
  process.env['FACILITY_TEAM_ROLE_ID'] ?? '1498520759310618665';

export const DISCORD_PUBLIC_KEY: string | undefined = process.env['DISCORD_PUBLIC_KEY'];

export const DISCORD_BOT_TOKEN: string | undefined = process.env['DISCORD_BOT_TOKEN'];

export const DISCORD_APP_ID: string | undefined = process.env['DISCORD_APP_ID'];

export const DISCORD_GUILD_ID: string | undefined = process.env['DISCORD_GUILD_ID'];

export const TABLE_NAME: string | undefined = process.env['DYNAMO_TABLE'];

export const DYNAMO_ENDPOINT: string | undefined = process.env['DYNAMO_ENDPOINT'];

export const AWS_LAMBDA_FUNCTION_NAME: string | undefined =
  process.env['AWS_LAMBDA_FUNCTION_NAME'];

export const PORT: number = Number(process.env['PORT']) || 3000;

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
