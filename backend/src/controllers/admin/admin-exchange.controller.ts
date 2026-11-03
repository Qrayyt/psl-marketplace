import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/db';
import { successResponse, paginatedResponse } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { logAudit } from '../../services/audit.service';
import { syncOrderStatusesFrom1C, receiveProductsFrom1C } from '../../services/exchange1c.service';

// Ручной запуск синхронизации статусов
export async function triggerSync(_req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await syncOrderStatusesFrom1C();
    successResponse(res, { message: 'Синхронизация завершена', updatedOrders: updated });
  } catch (err) {
    next(err);
  }
}

// Лог обмена с 1С
export async function getExchangeLog(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;
    const direction = req.query.direction as string | undefined;
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (direction) where.direction = direction;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.exchangeLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.exchangeLog.count({ where }),
    ]);

    paginatedResponse(res, logs, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// Прием каталога из 1С (заготовка)
export async function receiveProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.array(z.object({
      name: z.string().min(1),
      price: z.number().min(0),
      category: z.string().min(1),
      description: z.string().optional(),
      sizes: z.array(z.string()).optional(),
    }));

    const products = schema.parse(req.body);
    const imported = await receiveProductsFrom1C(products);

    successResponse(res, { imported }, 201);
  } catch (err) {
    next(err);
  }
}

// ----- CRUD учётных записей 1С -----
// Эти учётки 1С использует для Basic Auth при подключении к /api/1c/exchange

const onecUserCreateSchema = z.object({
  login: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, 'Только буквы, цифры, _ . -'),
  password: z.string().min(8).max(128),
  note: z.string().max(255).optional().nullable(),
});

const onecUserUpdateSchema = z.object({
  password: z.string().min(8).max(128).optional(),
  note: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function listOnecUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.onecUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, login: true, isActive: true, note: true, createdAt: true, lastSeenAt: true },
    });
    successResponse(res, users);
  } catch (err) {
    next(err);
  }
}

export async function createOnecUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = onecUserCreateSchema.parse(req.body);

    const existing = await prisma.onecUser.findUnique({ where: { login: data.login } });
    if (existing) throw new AppError('Учётка с таким логином уже существует', 409);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.onecUser.create({
      data: { login: data.login, passwordHash, note: data.note || null },
      select: { id: true, login: true, isActive: true, note: true, createdAt: true },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'onec_user_created',
      entityType: 'onec_user',
      entityId: user.id,
      details: { login: user.login },
      ip: req.ip,
    });

    successResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateOnecUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = onecUserUpdateSchema.parse(req.body);

    const existing = await prisma.onecUser.findUnique({ where: { id } });
    if (!existing) throw new AppError('Учётка не найдена', 404);

    const updateData: { passwordHash?: string; note?: string | null; isActive?: boolean } = {};
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10);
    if (data.note !== undefined) updateData.note = data.note;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const user = await prisma.onecUser.update({
      where: { id },
      data: updateData,
      select: { id: true, login: true, isActive: true, note: true, createdAt: true },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'onec_user_updated',
      entityType: 'onec_user',
      entityId: id,
      details: { changes: Object.keys(updateData) },
      ip: req.ip,
    });

    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}

export async function deleteOnecUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.onecUser.findUnique({ where: { id } });
    if (!existing) throw new AppError('Учётка не найдена', 404);

    await prisma.onecUser.delete({ where: { id } });

    await logAudit({
      userId: req.user!.id,
      action: 'onec_user_deleted',
      entityType: 'onec_user',
      entityId: id,
      details: { login: existing.login },
      ip: req.ip,
    });

    successResponse(res, { message: 'Удалено' });
  } catch (err) {
    next(err);
  }
}
