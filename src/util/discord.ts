import {DISCORD_BOT_TOKEN} from "../config.js";

const DISCORD_API = 'https://discord.com/api/v10';

interface GuildMember {
  user?: { id: string };
  roles: string[];
}

export async function fetchMembersWithRoles(
  guildId: string,
  roleIds: readonly string[],
): Promise<string[]> {
  const token: string | undefined = DISCORD_BOT_TOKEN
  if (!token) {
    console.warn('DISCORD_BOT_TOKEN missing, cannot fetch guild members');
    return [];
  }
  const url = `${DISCORD_API}/guilds/${guildId}/members?limit=1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    console.log('Res response:', {res})
    console.warn('failed to fetch guild members', { status: res.status });
    return [];
  }

  const members = (await res.json()) as GuildMember[];
  const out: string[] = [];
  for (const m of members) {
    if (m.user === undefined) continue;
    if (roleIds.every((r) => m.roles.includes(r))) {
      out.push(m.user.id);
    }
  }
  return out;
}