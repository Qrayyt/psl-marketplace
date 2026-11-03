import app from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { redis } from './config/redis';
import { startEmailWorker } from './jobs/email.queue';
import { syncOrderStatusesFrom1C } from './services/exchange1c.service';
import { cleanupOldAuditLogs } from './jobs/audit-cleanup';

async function bootstrap() {
  // Verify DB connection
  await prisma.$connect();
  console.log('[DB] Connected');

  // Запуск воркеров
  startEmailWorker();

  // Синхронизация статусов заказов из 1С каждые 5 минут
  setInterval(async () => {
    try {
      const updated = await syncOrderStatusesFrom1C();
      if (updated > 0) {
        console.log(`[1C Sync] Обновлено статусов: ${updated}`);
      }
    } catch (err) {
      console.error('[1C Sync] Ошибка синхронизации:', err);
    }
  }, 5 * 60 * 1000);

  // Ротация audit_log — удаление записей старше 365 дней, раз в сутки
  setInterval(async () => {
    try {
      await cleanupOldAuditLogs();
    } catch (err) {
      console.error('[AuditCleanup] Ошибка очистки:', err);
    }
  }, 86_400_000);

  app.listen(env.port, () => {
    console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
  });
}

bootstrap().catch((err) => {
  console.error('[Fatal] Failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[Server] Shutting down...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
