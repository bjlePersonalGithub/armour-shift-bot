import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, DYNAMO_ENDPOINT } from '../config.js';

export interface ShiftState {
  shift1_main: string | null;
  shift1_secondary: string | null;
  shift2_main: string | null;
  shift2_secondary: string | null;
  shift3_main: string | null;
  shift3_secondary: string | null;
  shift4_main: string | null;
  shift4_secondary: string | null;
  tank_squire: string | null;
  reserve: string[];
}
if (!TABLE_NAME) {
  throw new Error('DYNAMO_TABLE env var is required');
}

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient(DYNAMO_ENDPOINT ? { endpoint: DYNAMO_ENDPOINT } : {}),
);

export function emptyState(): ShiftState {
  return {
    shift1_main: null,
    shift1_secondary: null,
    shift2_main: null,
    shift2_secondary: null,
    shift3_main: null,
    shift3_secondary: null,
    shift4_main: null,
    shift4_secondary: null,
    tank_squire: null,
    reserve: [],
  };
}

export async function getState(messageId: string): Promise<ShiftState> {
  const res = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
    }),
  );
  // Spread over a fresh state so items written before a slot existed come back
  // with that slot as null rather than undefined.
  const stored = res.Item?.['state'] as Partial<ShiftState> | undefined;
  return { ...emptyState(), ...stored };
}

export async function setState(
  messageId: string,
  state: ShiftState,
): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { messageId, state },
    }),
  );
}
