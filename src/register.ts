import 'dotenv/config';

const APP_ID = process.env['DISCORD_APP_ID'];
const TOKEN = process.env['DISCORD_BOT_TOKEN'];
const GUILD_ID = process.env['DISCORD_GUILD_ID'];

if (!APP_ID || !TOKEN) {
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

const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${APP_ID}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error('register failed:', res.status, await res.text());
  process.exit(1);
}

console.log(`registered ${GUILD_ID ? `to guild ${GUILD_ID}` : 'globally'}:`);
console.log(await res.json());
