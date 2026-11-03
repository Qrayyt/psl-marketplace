import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { successResponse, paginatedResponse } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { logAudit } from '../../services/audit.service';
import { enqueueEmail } from '../../jobs/email.queue';
import { OrderStatus } from '@prisma/client';

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

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
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
    successResponse(res, order);
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

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: true } },
        deliveryAddress: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'order_status_changed',
      entityType: 'order',
      entityId: id,
      details: { orderNumber: order.orderNumber, from: order.status, to: status },
      ip: req.ip,
    });

    if (order.user) {
      await enqueueEmail({ type: 'order-status', to: order.user.email, name: order.user.name, orderNumber: order.orderNumber, status });
    }

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
}
