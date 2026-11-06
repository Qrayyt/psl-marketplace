import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse, paginatedResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { logAudit } from '../services/audit.service';
import { enqueueEmail } from '../jobs/email.queue';

const createOrderSchema = z.object({
  addressId: z.string().uuid().optional(),
  address: z.object({
    address: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().optional(),
  }).optional(),
  deliveryMethod: z.string().optional(),
});

// Генерация номера заказа: PSL-YYYYMMDD-XXXX
function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PSL-${date}-${random}`;
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createOrderSchema.parse(req.body);
    const userId = req.user!.id;

    // Получаем корзину
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw new AppError('Корзина пуста', 400);
    }

    if (cartItems.some(item => !item.product.isActive || item.product.price <= 0)) {
      throw new AppError('В корзине есть скрытые материалы или позиции с ценой по запросу', 409);
    }

    // Определяем адрес доставки
    let deliveryAddressId = data.addressId;
    if (!deliveryAddressId && data.address) {
      const newAddress = await prisma.deliveryAddress.create({
        data: {
          userId,
          address: data.address.address,
          city: data.address.city,
          postalCode: data.address.postalCode,
        },
      });
      deliveryAddressId = newAddress.id;
    }

    // Считаем итого
    const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    // Создаем заказ
    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber: generateOrderNumber(),
        deliveryAddressId: deliveryAddressId,
        deliveryMethod: data.deliveryMethod,
        total,
        discountTotal: 0, // TODO: движок скидок
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
            price: item.product.price,
            discountAmount: 0,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        deliveryAddress: true,
      },
    });

    // Очищаем корзину
    await prisma.cartItem.deleteMany({ where: { userId } });

    // Аудит
    await logAudit({
      userId,
      action: 'order_created',
      entityType: 'order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, total: order.total },
      ip: req.ip,
    });

    // Email-уведомление о создании заказа
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (user) {
      await enqueueEmail({ type: 'order-status', to: user.email, name: user.name, orderNumber: order.orderNumber, status: 'NEW' });
    }

    successResponse(res, order, 201);
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

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        items: { include: { product: true } },
        deliveryAddress: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'order_cancelled',
      entityType: 'order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber },
      ip: req.ip,
    });

    const cancelUser = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, name: true } });
    if (cancelUser) {
      await enqueueEmail({ type: 'order-status', to: cancelUser.email, name: cancelUser.name, orderNumber: order.orderNumber, status: 'CANCELLED' });
    }

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
}
