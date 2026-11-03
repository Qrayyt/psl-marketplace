import { prisma } from '../config/db';

interface AuditEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : undefined,
      ip: entry.ip,
    },
  });
}
