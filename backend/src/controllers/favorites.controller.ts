import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse, paginatedResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

const syncFavoritesSchema = z.object({
  productIds: z.array(z.string().uuid()),
});

export async function getFavorites(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId: req.user!.id },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.favorite.count({ where: { userId: req.user!.id } }),
    ]);

    paginatedResponse(res, favorites, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function addFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = req.params.productId as string;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new AppError('Товар не найден', 404);
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId } },
    });

    if (existing) {
      successResponse(res, existing);
      return;
    }

    const favorite = await prisma.favorite.create({
      data: { userId: req.user!.id, productId },
      include: { product: true },
    });

    successResponse(res, favorite, 201);
  } catch (err) {
    next(err);
  }
}

export async function removeFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = req.params.productId as string;

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId } },
    });

    if (!existing) {
      throw new AppError('Не найдено в избранном', 404);
    }

    await prisma.favorite.delete({ where: { id: existing.id } });
    successResponse(res, { message: 'Удалено из избранного' });
  } catch (err) {
    next(err);
  }
}

export async function favoriteToCart(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = req.params.productId as string;
    const size = (req.body.size as string) || '';

    const favorite = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId } },
      include: { product: true },
    });

    if (!favorite) {
      throw new AppError('Не найдено в избранном', 404);
    }

    // Определяем размер - первый доступный если не указан
    const targetSize = size || favorite.product.sizes[0] || 'ONE SIZE';

    // Добавляем в корзину
    const existingCart = await prisma.cartItem.findUnique({
      where: {
        userId_productId_size: { userId: req.user!.id, productId, size: targetSize },
      },
    });

    if (existingCart) {
      await prisma.cartItem.update({
        where: { id: existingCart.id },
        data: { quantity: existingCart.quantity + 1 },
      });
    } else {
      await prisma.cartItem.create({
        data: { userId: req.user!.id, productId, size: targetSize, quantity: 1 },
      });
    }

    // Удаляем из избранного
    await prisma.favorite.delete({ where: { id: favorite.id } });

    successResponse(res, { message: 'Перенесено в корзину' });
  } catch (err) {
    next(err);
  }
}

export async function syncFavorites(req: Request, res: Response, next: NextFunction) {
  try {
    const data = syncFavoritesSchema.parse(req.body);

    for (const productId of data.productIds) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) continue;

      const existing = await prisma.favorite.findUnique({
        where: { userId_productId: { userId: req.user!.id, productId } },
      });

      if (!existing) {
        await prisma.favorite.create({
          data: { userId: req.user!.id, productId },
        });
      }
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    successResponse(res, favorites);
  } catch (err) {
    next(err);
  }
}
