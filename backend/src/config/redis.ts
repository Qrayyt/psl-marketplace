import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});
