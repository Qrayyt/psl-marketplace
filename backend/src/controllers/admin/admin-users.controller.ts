import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { successResponse, paginatedResponse } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { logAudit } from '../../services/audit.service';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, phone: true,
          role: true, isBlocked: true, createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    paginatedResponse(res, users, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, isBlocked: true, createdAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { product: true } } },
        },
        addresses: true,
      },
    });

    if (!user) throw new AppError('Пользователь не найден', 404);
    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { role, isBlocked } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('Пользователь не найден', 404);

    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (isBlocked !== undefined) data.isBlocked = isBlocked;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, isBlocked: true, createdAt: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'user_updated',
      entityType: 'user',
      entityId: id,
      details: { changes: data },
      ip: req.ip,
    });

    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}

export async function blockUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked: true },
      select: { id: true, email: true, name: true, isBlocked: true },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'user_blocked',
      entityType: 'user',
      entityId: id,
      ip: req.ip,
    });

    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}

export async function unblockUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked: false },
      select: { id: true, email: true, name: true, isBlocked: true },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'user_unblocked',
      entityType: 'user',
      entityId: id,
      ip: req.ip,
    });

    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}
