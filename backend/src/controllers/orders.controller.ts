import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse, paginatedResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { enqueueEmail } from '../jobs/email.queue';

const createOrderSchema = z.object({
  addressId: z.string().uuid().optional(),
  address: z.object({
    address: z.string().trim().min(1).max(300),
    city: z.string().trim().min(1).max(120),
    postalCode: z.string().max(20).optional(),
  }).optional(),
  deliveryMethod: z.string().max(100).optional(),
  contact: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(32).regex(/^[+()0-9 .-]+$/).refine(value => value.replace(/\D/g, '').length >= 7),
    email: z.string().trim().email().max(254).optional(),
    company: z.string().trim().max(160).optional(),
    note: z.string().trim().max(2000).optional(),
  }).optional(),
  requestId: z.string().uuid().optional(),
  expectedItems: z.array(z.object({
    id: z.string().uuid(),
    size: z.string(),
    quantity: z.number().int(),
    price: z.number(),
  })).max(500).optional(),
}).refine(data => !data.requestId || (data.contact && data.expectedItems), {
  message: 'Укажите контакт и состав заказа',
});

const orderDetails = {
  items: { include: { product: true } },
  deliveryAddress: true,
} as const;

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createOrderSchema.parse(req.body);
    const userId = req.user!.id;
    const result = await prisma.$transaction(async tx => {
      // Serializes checkout attempts for the same buyer, including retries.
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
      if (data.requestId) {
        const previous = await tx.order.findUnique({
          where: { userId_requestId: { userId, requestId: data.requestId } },
          include: orderDetails,
        });
        if (previous) return { order: previous, created: false };
      }

      const buyer = await tx.user.findUniqueOrThrow({
        where: { id: userId }, select: { name: true, email: true, phone: true, isBlocked: true },
      });
      if (buyer.isBlocked) throw new AppError('Аккаунт заблокирован', 403);

      const cartItems = await tx.cartItem.findMany({ where: { userId }, include: { product: true } });
      if (!cartItems.length) throw new AppError('Корзина пуста', 400);
      if (cartItems.some(item => !item.product.isActive || item.product.price <= 0)) {
        throw new AppError('В корзине есть материалы, недоступные для заказа', 409);
      }
      if (data.expectedItems) {
        const expected = new Map(data.expectedItems.map(item => [item.id, item]));
        if (expected.size !== cartItems.length || cartItems.some(item => {
          const old = expected.get(item.id);
          return !old || old.size !== item.size || old.quantity !== item.quantity || old.price !== item.product.price;
        })) throw new AppError('Корзина или цены изменились. Проверьте состав заказа заново.', 409);
      }

      let deliveryAddressId = data.addressId;
      if (deliveryAddressId && !await tx.deliveryAddress.findFirst({ where: { id: deliveryAddressId, userId } })) {
        throw new AppError('Адрес доставки не найден', 404);
      }
      if (!deliveryAddressId && data.address) {
        const address = await tx.deliveryAddress.create({ data: { userId, ...data.address } });
        deliveryAddressId = address.id;
      }

      const total = cartItems.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100;
      const order = await tx.order.create({
        data: {
          userId,
          requestId: data.requestId,
          orderNumber: 'PSL-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + randomUUID().slice(0, 12).replace('-', '').toUpperCase(),
          deliveryAddressId,
          deliveryMethod: data.deliveryMethod,
          contactName: data.contact?.name ?? buyer.name,
          contactPhone: data.contact?.phone ?? buyer.phone,
          contactEmail: data.contact?.email ?? buyer.email,
          company: data.contact?.company,
          customerNote: data.contact?.note,
          total,
          items: {
            create: cartItems.map(item => ({
              productId: item.productId,
              size: item.size,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
        },
        include: orderDetails,
      });

      // Do not clear positions added or edited elsewhere after checkout began.
      for (const item of cartItems) {
        await tx.cartItem.deleteMany({
          where: { id: item.id, userId, quantity: item.quantity, size: item.size },
        });
      }
      await tx.auditLog.create({
        data: {
          userId, action: 'order_created', entityType: 'order', entityId: order.id,
          details: { orderNumber: order.orderNumber, total }, ip: req.ip,
        },
      });
      return { order, created: true };
    });

    successResponse(res, result.order, result.created ? 201 : 200);
    if (result.created && result.order.contactEmail && env.smtp.host) {
      void enqueueEmail({
        type: 'order-status', to: result.order.contactEmail, name: result.order.contactName || '',
        orderNumber: result.order.orderNumber, status: 'NEW',
      }).catch(error => console.error('Order email could not be queued:', error));
    }
  } catch (err) {
    next(err);
  }
}

export async function getOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: req.user!.id },
        include: {
          items: { include: { product: true } },
          deliveryAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: { userId: req.user!.id } }),
    ]);

    paginatedResponse(res, orders, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const order = await prisma.order.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        items: { include: { product: true } },
        deliveryAddress: true,
      },
    });

    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    successResponse(res, order);
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const order = await prisma.order.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    if (order.status !== 'NEW') {
      throw new AppError('Отменить можно только заказ в статусе "Новый"', 400);
    }

    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({
        where: { id, userId: req.user!.id, status: 'NEW' },
        data: { status: 'CANCELLED' },
      });
      if (!changed.count) throw new AppError('Статус заказа изменился. Обновите страницу.', 409);

      await tx.auditLog.create({
        data: {
          userId: req.user!.id, action: 'order_cancelled', entityType: 'order', entityId: order.id,
          details: { orderNumber: order.orderNumber }, ip: req.ip,
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderDetails });
    });

    successResponse(res, updated);
    if (env.smtp.host) {
      void prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, name: true } })
        .then(buyer => {
          const email = updated.contactEmail || buyer?.email;
          if (email) return enqueueEmail({
            type: 'order-status', to: email, name: updated.contactName || buyer?.name || '',
            orderNumber: order.orderNumber, status: 'CANCELLED',
          });
        })
        .catch(error => console.error('Order cancellation email could not be queued:', error));
    }
  } catch (err) {
    next(err);
  }
}
