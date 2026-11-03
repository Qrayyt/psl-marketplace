import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { successResponse, paginatedResponse } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { logAudit } from '../../services/audit.service';

const discountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().min(0),
  targetTags: z.array(z.string()).default([]),
  targetUserIds: z.array(z.string()).default([]),
  targetUserEmails: z.array(z.string()).default([]),
  promoCode: z.string().optional().nullable(),
  priority: z.number().default(0),
  isStackable: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
});

// Резолв email-ов в userId-ы
async function resolveUserEmails(emails: string[]): Promise<string[]> {
  if (!emails.length) return [];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  return users.map(u => u.id);
}

export async function listDiscounts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [discounts, total] = await Promise.all([
      prisma.discountRule.findMany({ orderBy: { priority: 'desc' }, skip, take: limit }),
      prisma.discountRule.count(),
    ]);

    paginatedResponse(res, discounts, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function createDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = discountSchema.parse(req.body);
    // Резолвим email-ы в ID-ы если указаны
    const emailIds = await resolveUserEmails(data.targetUserEmails);
    const allUserIds = [...new Set([...data.targetUserIds, ...emailIds])];
    const { targetUserEmails, ...createData } = data;
    const discount = await prisma.discountRule.create({
      data: {
        ...createData,
        targetUserIds: allUserIds,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'discount_created',
      entityType: 'discount_rule',
      entityId: discount.id,
      details: { name: discount.name },
      ip: req.ip,
    });

    successResponse(res, discount, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = discountSchema.partial().parse(req.body);

    const existing = await prisma.discountRule.findUnique({ where: { id } });
    if (!existing) throw new AppError('Правило скидки не найдено', 404);

    const discount = await prisma.discountRule.update({
      where: { id },
      data: {
        ...data,
        validFrom: data.validFrom !== undefined
          ? (data.validFrom ? new Date(data.validFrom) : null)
          : undefined,
        validUntil: data.validUntil !== undefined
          ? (data.validUntil ? new Date(data.validUntil) : null)
          : undefined,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'discount_updated',
      entityType: 'discount_rule',
      entityId: id,
      details: { changes: Object.keys(data) },
      ip: req.ip,
    });

    successResponse(res, discount);
  } catch (err) {
    next(err);
  }
}

export async function deleteDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.discountRule.findUnique({ where: { id } });
    if (!existing) throw new AppError('Правило скидки не найдено', 404);

    await prisma.discountRule.delete({ where: { id } });

    await logAudit({
      userId: req.user!.id,
      action: 'discount_deleted',
      entityType: 'discount_rule',
      entityId: id,
      details: { name: existing.name },
      ip: req.ip,
    });

    successResponse(res, { message: 'Правило удалено' });
  } catch (err) {
    next(err);
  }
}
