export interface ShiftDef {
  id: 1 | 2 | 3;
  label: string;
  timing: string;
}

export const SHIFTS: readonly ShiftDef[] = [
  { id: 1, label: 'Pre-OP / OP Start', timing: '11:30 AM -> 2:30 PM' },
  { id: 2, label: '1:30 Hours after OP Start', timing: '2:30 PM -> 4:30 PM' },
  { id: 3, label: '3:30 Hours after OP Start / Op end', timing: '4:30 PM -> End' },
];
