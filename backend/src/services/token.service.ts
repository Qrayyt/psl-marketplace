import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { Role } from '@prisma/client';

const REFRESH_PREFIX = 'refresh:';

export function generateAccessToken(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, env.jwt.accessSecret, {
    expiresIn: parseDuration(env.jwt.accessExpiresIn),
  });
}

export function generateRefreshToken(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, env.jwt.refreshSecret, {
    expiresIn: parseDuration(env.jwt.refreshExpiresIn),
  });
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const ttl = parseDuration(env.jwt.refreshExpiresIn);
  await redis.set(`${REFRESH_PREFIX}${token}`, userId, 'EX', ttl);
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; role: Role } | null> {
  const stored = await redis.get(`${REFRESH_PREFIX}${token}`);
  if (!stored) return null;

  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret) as { userId: string; role: Role };
    return payload;
  } catch {
    await redis.del(`${REFRESH_PREFIX}${token}`);
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await redis.del(`${REFRESH_PREFIX}${token}`);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const keys = await redis.keys(`${REFRESH_PREFIX}*`);
  for (const key of keys) {
    const val = await redis.get(key);
    if (val === userId) {
      await redis.del(key);
    }
  }
}

function parseDuration(dur: string): number {
  const match = dur.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86400; // default 7d
  const [, num, unit] = match;
  const n = parseInt(num, 10);
  switch (unit) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return 7 * 86400;
  }
}
