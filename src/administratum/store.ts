import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DUTIES } from './duties.js';
import type { DutyKey } from './duties.js';

export type AdministratumState = Record<DutyKey, string | null>;

const TABLE_NAME = process.env['DYNAMO_TABLE'];
if (!TABLE_NAME) {
  throw new Error('DYNAMO_TABLE env var is required');
}

const endpoint = process.env['DYNAMO_ENDPOINT'];
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient(endpoint ? { endpoint } : {}),
);

export function emptyState(): AdministratumState {
  const state = {} as AdministratumState;
  for (const duty of DUTIES) {
    state[duty.key] = null;
  }
  return state;
}

export async function getState(
  messageId: string,
): Promise<AdministratumState> {
  const res = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
    }),
  );
  const stored = res.Item?.['state'] as Partial<AdministratumState> | undefined;
  if (!stored) return emptyState();
  return { ...emptyState(), ...stored };
}

export async function setState(
  messageId: string,
  state: AdministratumState,
): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { messageId, state },
    }),
  );
}
