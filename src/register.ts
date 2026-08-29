import 'dotenv/config';
import {
  DISCORD_APP_ID,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
} from './config.js';

if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error('DISCORD_APP_ID and DISCORD_BOT_TOKEN are required in .env');
  process.exit(1);
}

const commands = [
  {
    name: 'shift',
    description: 'Post a shift sign-up panel',
    type: 1,
    dm_permission: false,
  },
  {
    name: 'administratum',
    description: 'Post weekly duties and administrative tasks',
    type: 1,
    dm_permission: false,
  }
];

const url = DISCORD_GUILD_ID
  ? `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error('register failed:', res.status, await res.text());
  process.exit(1);
}

console.log(`registered ${DISCORD_GUILD_ID ? `to guild ${DISCORD_GUILD_ID}` : 'globally'}:`);
console.log(await res.json());
