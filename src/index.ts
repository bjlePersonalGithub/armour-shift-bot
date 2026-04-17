import 'dotenv/config';
import express from 'express';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { handleButton, handleCommand } from './shift/interactions.js';

const PUBLIC_KEY = process.env['DISCORD_PUBLIC_KEY'];
if (!PUBLIC_KEY) {
  console.error('DISCORD_PUBLIC_KEY is required in .env');
  process.exit(1);
}

const app = express();

app.post(
  '/interactions',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.header('x-signature-ed25519');
    const ts = req.header('x-signature-timestamp');
    if (!sig || !ts) {
      res.status(401).send('missing signature headers');
      return;
    }

    const valid = await verifyKey(req.body as Buffer, sig, ts, PUBLIC_KEY);
    if (!valid) {
      res.status(401).send('invalid signature');
      return;
    }

    const body = JSON.parse((req.body as Buffer).toString('utf8'));

    if (body.type === InteractionType.PING) {
      res.json({ type: InteractionResponseType.PONG });
      return;
    }

    if (body.type === InteractionType.APPLICATION_COMMAND) {
      if (body.data?.name === 'shift') {
        res.json(handleCommand());
        return;
      }
      res.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Unknown command.', flags: 64 },
      });
      return;
    }

    if (body.type === InteractionType.MESSAGE_COMPONENT) {
      res.json(handleButton(body));
      return;
    }

    res.status(400).send('unknown interaction type');
  },
);

app.get('/', (_req, res) => {
  res.send('shift-bot ok');
});

const PORT = Number(process.env['PORT']) || 3000;
app.listen(PORT, () => {
  console.log(`listening on :${PORT}`);
});
