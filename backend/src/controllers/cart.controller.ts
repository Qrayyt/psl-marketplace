import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { calculateProductDiscount, applyPromoCode } from '../services/discount.service';

const addToCartSchema = z.object({
  productId: z.string().regex(/^[a-z0-9-]{1,100}$/i),
  size: z.string().min(1),
  quantity: z.coerce.number().min(1).default(1),
});

const updateCartSchema = z.object({
  quantity: z.coerce.number().min(1),
});

const syncCartSchema = z.object({
  items: z.array(z.object({
    productId: z.string().regex(/^[a-z0-9-]{1,100}$/i),
    size: z.string().min(1),
    quantity: z.coerce.number().min(1),
  })),
});

export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    // Рассчитываем скидки для каждого товара
    let total = 0;
    let discountTotal = 0;
    const itemsWithDiscount = [];

    for (const item of items) {
      const discount = await calculateProductDiscount(
        item.product.price,
        item.product.tags,
        req.user!.id,
      );
      const itemTotal = item.product.price * item.quantity;
      const itemDiscount = discount.totalDiscount * item.quantity;
      total += itemTotal;
      discountTotal += itemDiscount;
      itemsWithDiscount.push({
        ...item,
        discountedPrice: discount.discountedPrice,
        itemDiscount,
        appliedRules: discount.appliedRules,
      });
    }

    successResponse(res, {
      items: itemsWithDiscount,
      total: Math.round(total * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      finalTotal: Math.round((total - discountTotal) * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
}

export async function addToCart(req: Request, res: Response, next: NextFunction) {
  try {
    const data = addToCartSchema.parse(req.body);

    // Проверка существования товара и размера
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product || !product.isActive) {
      throw new AppError('Товар не найден', 404);
    }
    if (!product.sizes.includes(data.size)) {
      throw new AppError('Размер недоступен', 400);
    }

    // Upsert - если уже есть, увеличиваем количество
    const existing = await prisma.cartItem.findUnique({
      where: {
        userId_productId_size: {
          userId: req.user!.id,
          productId: data.productId,
          size: data.size,
        },
      },
    });

    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + data.quantity },
        include: { product: true },
      });
    } else {
      item = await prisma.cartItem.create({
        data: {
          userId: req.user!.id,
          productId: data.productId,
          size: data.size,
          quantity: data.quantity,
        },
        include: { product: true },
      });
    }

    successResponse(res, item, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = updateCartSchema.parse(req.body);

    const item = await prisma.cartItem.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!item) {
      throw new AppError('Элемент корзины не найден', 404);
    }

    const updated = await prisma.cartItem.update({
      where: { id },
      data: { quantity: data.quantity },
      include: { product: true },
    });

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function removeCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const item = await prisma.cartItem.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!item) {
      throw new AppError('Элемент корзины не найден', 404);
    }

    await prisma.cartItem.delete({ where: { id } });
    successResponse(res, { message: 'Удалено' });
  } catch (err) {
    next(err);
  }
}

export async function clearCart(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.cartItem.deleteMany({ where: { userId: req.user!.id } });
    successResponse(res, { message: 'Корзина очищена' });
  } catch (err) {
    next(err);
  }
}

export async function syncCart(req: Request, res: Response, next: NextFunction) {
  try {
    const data = syncCartSchema.parse(req.body);

    for (const item of data.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) continue;
      if (!product.sizes.includes(item.size)) continue;

      const existing = await prisma.cartItem.findUnique({
        where: {
          userId_productId_size: {
            userId: req.user!.id,
            productId: item.productId,
            size: item.size,
          },
        },
      });

      // Серверные данные приоритетнее - добавляем только если нет дубля
      if (!existing) {
        await prisma.cartItem.create({
          data: {
            userId: req.user!.id,
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
          },
        });
      }
    }

    // Возвращаем актуальную корзину
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    successResponse(res, { items, total, discountTotal: 0 });
  } catch (err) {
    next(err);
  }
}

export async function removePromo(_req: Request, res: Response, next: NextFunction) {
  try {
    // Промокод хранится на клиенте, сервер просто подтверждает удаление
    successResponse(res, { message: 'Промокод убран' });
  } catch (err) {
    next(err);
  }
}

export async function applyPromo(req: Request, res: Response, next: NextFunction) {
  try {
    const { promoCode } = z.object({ promoCode: z.string().min(1) }).parse(req.body);

    const items = await prisma.cartItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
    });

    if (items.length === 0) {
      throw new AppError('Корзина пуста', 400);
    }

    const cartForDiscount = items.map(i => ({
      productId: i.productId,
      price: i.product.price,
      quantity: i.quantity,
      tags: i.product.tags,
    }));

    const result = await applyPromoCode(promoCode, cartForDiscount, req.user!.id);

    if (!result.valid) {
      throw new AppError('Промокод недействителен', 400);
    }

    successResponse(res, {
      promoCode,
      discount: result.discount,
      ruleName: result.ruleName,
    });
  } catch (err) {
    next(err);
  }
}
