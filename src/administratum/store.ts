import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DUTIES } from './duties.js';
import type { DutyKey } from './duties.js';
import { TABLE_NAME, DYNAMO_ENDPOINT } from '../config.js';

export type AdministratumState = Record<DutyKey, string | null>;

if (!TABLE_NAME) {
  throw new Error('DYNAMO_TABLE env var is required');
}

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient(DYNAMO_ENDPOINT ? { endpoint: DYNAMO_ENDPOINT } : {}),
);

export function emptyState(): AdministratumState {
  const state = {} as AdministratumState;
  for (const duty of DUTIES) {
    state[duty.key] = null;
  }
  return state;
}

export async function getStoredState(
  messageId: string,
): Promise<Partial<AdministratumState> | null> {
  const res = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
    }),
  );
  const stored = res.Item?.['state'] as Partial<AdministratumState> | undefined;
  return stored ?? null;
}

export async function getState(
  messageId: string,
): Promise<AdministratumState> {
  const stored = await getStoredState(messageId);
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
