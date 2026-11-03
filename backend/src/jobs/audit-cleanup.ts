import { prisma } from '../config/db';

/**
 * Удаляет записи audit_log старше 365 дней.
 * Запускается по расписанию (раз в сутки).
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    console.log(`[AuditCleanup] Удалено ${result.count} записей старше 365 дней`);
  }

  return result.count;
}
