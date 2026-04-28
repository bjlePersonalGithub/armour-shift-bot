import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions';
import request from 'supertest';

const mocks = vi.hoisted(() => {
  process.env['DISCORD_PUBLIC_KEY'] = 'test-public-key';
  process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'test';
  process.env['DYNAMO_TABLE'] = 'test-table';
  return {
    verifyKey: vi.fn(),
    handleCommand: vi.fn(),
    handleButton: vi.fn(),
    handleAdministratumCommand: vi.fn(),
    handleAdministratumButton: vi.fn(),
  };
});

vi.mock('discord-interactions', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('discord-interactions')>();
  return { ...actual, verifyKey: mocks.verifyKey };
});

vi.mock('./shift/interactions.js', () => ({
  handleCommand: mocks.handleCommand,
  handleButton: mocks.handleButton,
}));

vi.mock('./administratum/interactions.js', () => ({
  handleCommand: mocks.handleAdministratumCommand,
  handleButton: mocks.handleAdministratumButton,
}));

const { app } = await import('./index.js');

function postInteraction(body: unknown, signed = true) {
  const req = request(app)
    .post('/interactions')
    .set('Content-Type', 'application/json');
  if (signed) {
    req.set('x-signature-ed25519', 'sig').set('x-signature-timestamp', 'ts');
  }
  return req.send(JSON.stringify(body));
}

beforeEach(() => {
  mocks.verifyKey.mockReset();
  mocks.handleCommand.mockReset();
  mocks.handleButton.mockReset();
  mocks.handleAdministratumCommand.mockReset();
  mocks.handleAdministratumButton.mockReset();
  mocks.verifyKey.mockResolvedValue(true);
});

describe('GET /', () => {
  it('responds with health string', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('shift-bot ok');
  });
});

describe('POST /interactions - signature', () => {
  it('rejects requests with no signature headers (401)', async () => {
    const res = await postInteraction({ type: InteractionType.PING }, false);
    expect(res.status).toBe(401);
    expect(mocks.verifyKey).not.toHaveBeenCalled();
  });

  it('rejects requests with invalid signature (401)', async () => {
    mocks.verifyKey.mockResolvedValue(false);
    const res = await postInteraction({ type: InteractionType.PING });
    expect(res.status).toBe(401);
  });
});

describe('POST /interactions - dispatch', () => {
  it('PING -> PONG', async () => {
    const res = await postInteraction({ type: InteractionType.PING });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: InteractionResponseType.PONG });
    expect(mocks.handleCommand).not.toHaveBeenCalled();
  });

  it('routes /shift APPLICATION_COMMAND to handleCommand with channel_id', async () => {
    const stub = { type: 4, data: { content: 'shift-response' } };
    mocks.handleCommand.mockReturnValue(stub);
    const res = await postInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: 'shift' },
      channel_id: '1494671599561998486',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
    expect(mocks.handleCommand).toHaveBeenCalledOnce();
    expect(mocks.handleCommand).toHaveBeenCalledWith('1494671599561998486');
  });

  it('routes /administratum APPLICATION_COMMAND to handleAdministratumCommand', async () => {
    const stub = { type: 4, data: { content: 'admin-response' } };
    mocks.handleAdministratumCommand.mockReturnValue(stub);
    const res = await postInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: 'administratum' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
    expect(mocks.handleAdministratumCommand).toHaveBeenCalledOnce();
    expect(mocks.handleCommand).not.toHaveBeenCalled();
  });

  it('responds "Unknown command." for any other command name', async () => {
    const res = await postInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: 'something-else' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Unknown command.');
    expect(mocks.handleCommand).not.toHaveBeenCalled();
    expect(mocks.handleAdministratumCommand).not.toHaveBeenCalled();
  });

  it('routes shift MESSAGE_COMPONENT to shift handleButton', async () => {
    const stub = { type: 7, data: { content: 'btn-response' } };
    mocks.handleButton.mockResolvedValue(stub);
    const body = {
      type: InteractionType.MESSAGE_COMPONENT,
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
      member: { user: { id: 'u1' }, roles: [] },
    };
    const res = await postInteraction(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
    expect(mocks.handleButton).toHaveBeenCalledOnce();
    expect(mocks.handleAdministratumButton).not.toHaveBeenCalled();
  });

  it('routes administratum MESSAGE_COMPONENT (a: prefix) to administratum handleButton', async () => {
    const stub = { type: 7, data: { content: 'admin-btn-response' } };
    mocks.handleAdministratumButton.mockResolvedValue(stub);
    const body = {
      type: InteractionType.MESSAGE_COMPONENT,
      data: { custom_id: 'a:tm' },
      message: { id: 'm1' },
      member: { user: { id: 'u1' }, roles: [] },
    };
    const res = await postInteraction(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
    expect(mocks.handleAdministratumButton).toHaveBeenCalledOnce();
    expect(mocks.handleButton).not.toHaveBeenCalled();
  });

  it('returns 400 for unknown interaction types', async () => {
    const res = await postInteraction({ type: 999 });
    expect(res.status).toBe(400);
  });

  it('returns 500 when a handler throws', async () => {
    mocks.handleButton.mockRejectedValue(new Error('boom'));
    const res = await postInteraction({
      type: InteractionType.MESSAGE_COMPONENT,
      data: { custom_id: 's:1:m' },
      message: { id: 'm1' },
      member: { user: { id: 'u1' }, roles: [] },
    });
    expect(res.status).toBe(500);
  });
});
