import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse, paginatedResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { serializeProduct, serializeProducts } from '../utils/serializers';
import { getCachedAllProducts } from '../services/cache.service';
import { calculateProductDiscount } from '../services/discount.service';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  tags: z.string().optional(), // через запятую: "oversize,cotton"
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'rating']).optional(),
});

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query);
    const { page, limit, category, tags, price_min, price_max, search, sort } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };

    if (category) where.category = category;
    if (tags) where.tags = { hasSome: tags.split(',').map(t => t.trim()) };

    if (price_min !== undefined || price_max !== undefined) {
      where.price = {};
      if (price_min !== undefined) (where.price as Record<string, number>).gte = price_min;
      if (price_max !== undefined) (where.price as Record<string, number>).lte = price_max;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    switch (sort) {
      case 'price_asc': orderBy = { price: 'asc' }; break;
      case 'price_desc': orderBy = { price: 'desc' }; break;
      case 'newest': orderBy = { createdAt: 'desc' }; break;
      case 'popular': orderBy = { reviewsCount: 'desc' }; break;
      case 'rating': orderBy = { rating: 'desc' }; break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy, skip, take: limit }),
      prisma.product.count({ where }),
    ]);

    // Рассчитываем скидки для авторизованного пользователя
    let discountedPrices: Map<string, number> | undefined;
    if (req.user) {
      discountedPrices = new Map();
      const discountResults = await Promise.all(
        products.map(p => calculateProductDiscount(p.price, p.tags, req.user!.id)),
      );
      products.forEach((p, i) => {
        discountedPrices!.set(p.id, discountResults[i].discountedPrice);
      });
    }

    // Сериализуем в формат фронтенда
    paginatedResponse(res, serializeProducts(products, discountedPrices), {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || !product.isActive) {
      throw new AppError('Товар не найден', 404);
    }

    // Рассчитываем скидку для авторизованного пользователя
    let discountedPrice: number | undefined;
    if (req.user) {
      const discountResult = await calculateProductDiscount(product.price, product.tags, req.user.id);
      discountedPrice = discountResult.discountedPrice;
    }

    successResponse(res, serializeProduct(product, discountedPrice));
  } catch (err) {
    next(err);
  }
}

// GET /api/products/all - все товары для фронтенда (замена window.PRODUCTS)
export async function getAllProducts(_req: Request, res: Response, next: NextFunction) {
  try {
    const products = await getCachedAllProducts();
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

    successResponse(res, categories.map(c => c.category));
  } catch (err) {
    next(err);
  }
}
