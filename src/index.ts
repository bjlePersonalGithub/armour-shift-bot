import 'dotenv/config';
import express from 'express';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import {
  handleButton as handleShiftButton,
  handleCommand as handleShiftCommand,
} from './shift/interactions.js';
import {
  handleButton as handleAdministratumButton,
  handleCommand as handleAdministratumCommand,
} from './administratum/interactions.js';

const PUBLIC_KEY = process.env['DISCORD_PUBLIC_KEY'];
if (!PUBLIC_KEY) {
  throw new Error('DISCORD_PUBLIC_KEY is required');
}

export const app = express();

app.post(
  '/interactions',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const sig = req.header('x-signature-ed25519');
      const ts = req.header('x-signature-timestamp');
      if (!sig || !ts) {
        console.warn('interaction rejected: missing signature headers');
        res.status(401).send('missing signature headers');
        return;
      }

      const valid = await verifyKey(req.body as Buffer, sig, ts, PUBLIC_KEY);
      if (!valid) {
        console.warn('interaction rejected: invalid signature');
        res.status(401).send('invalid signature');
        return;
      }

      const body = JSON.parse((req.body as Buffer).toString('utf8'));
      console.log('interaction received', {
        id: body.id,
        type: body.type,
        command: body.data?.name,
        customId: body.data?.custom_id,
        userId: body.member?.user?.id ?? body.user?.id,
      });

      if (body.type === InteractionType.PING) {
        res.json({ type: InteractionResponseType.PONG });
        return;
      }

      if (body.type === InteractionType.APPLICATION_COMMAND) {
        if (body.data?.name === 'shift') {
          res.json(handleShiftCommand(body.channel_id));
          return;
        }
        if (body.data?.name === 'administratum') {
          res.json(handleAdministratumCommand());
          return;
        }
        console.warn('unknown command', { command: body.data?.name });
        res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Unknown command.', flags: 64 },
        });
        return;
      }

      if (body.type === InteractionType.MESSAGE_COMPONENT) {
        const customId: string | undefined = body.data?.custom_id;
        if (customId?.startsWith('a:')) {
          res.json(await handleAdministratumButton(body));
          return;
        }
        res.json(await handleShiftButton(body));
        return;
      }

      console.warn('unknown interaction type', { type: body.type });
      res.status(400).send('unknown interaction type');
    } catch (err) {
      console.error('interaction handler error', err);
      res.status(500).send('internal error');
    }
  },
);

app.get('/', (_req, res) => {
  res.send('shift-bot ok');
});

if (!process.env['AWS_LAMBDA_FUNCTION_NAME']) {
  const PORT = Number(process.env['PORT']) || 3000;
  app.listen(PORT, () => {
    console.log(`listening on :${PORT}`);
  });
}
