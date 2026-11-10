import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { successResponse, paginatedResponse } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { enqueueEmail } from '../../jobs/email.queue';
import { OrderStatus, Prisma } from '@prisma/client';

const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status as OrderStatus | undefined;
    const userId = req.query.user_id as string | undefined;

    const where: Prisma.OrderWhereInput = {};
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 160) : '';
    if (search) {
      const match = { contains: search, mode: 'insensitive' } as const;
      where.OR = [
        { orderNumber: match }, { contactName: match }, { contactEmail: match }, { contactPhone: match },
        { company: match }, { user: { OR: [{ name: match }, { email: match }, { phone: match }] } },
      ];
    }
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
          deliveryAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    paginatedResponse(res, orders, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
        items: { include: { product: true } },
        deliveryAddress: true,
      },
    });

    if (!order) throw new AppError('Заказ не найден', 404);
    const history = await prisma.auditLog.findMany({
      where: { entityType: 'order', entityId: id, action: { in: ['order_created', 'order_status_changed', 'order_cancelled'] } },
      select: { id: true, action: true, details: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    successResponse(res, { ...order, history });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { status } = updateStatusSchema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!order) throw new AppError('Заказ не найден', 404);

    if (order.status === status) {
      successResponse(res, order);
      return;
    }
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({ where: { id, status: order.status }, data: { status } });
      if (!changed.count) throw new AppError('Статус уже изменился. Откройте заказ заново.', 409);
      await tx.auditLog.create({
        data: {
          userId: req.user!.id, action: 'order_status_changed', entityType: 'order', entityId: id,
          details: { orderNumber: order.orderNumber, from: order.status, to: status }, ip: req.ip,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id }, include: { items: { include: { product: true } }, deliveryAddress: true },
      });
    });

    successResponse(res, updated);
    if (env.smtp.host && (order.contactEmail || order.user.email)) {
      void enqueueEmail({
        type: 'order-status', to: order.contactEmail || order.user.email,
        name: order.contactName || order.user.name, orderNumber: order.orderNumber, status,
      }).catch(error => console.error('Order status email could not be queued:', error));
    }
  } catch (err) {
    next(err);
  }
}
