import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { successResponse } from '../../utils/apiResponse';

// Категории и теги хранятся в самих товарах (tags[], category).
// Эти эндпоинты позволяют получить/управлять уникальными значениями.

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    successResponse(res, categories.map(c => c.category));
  } catch (err) {
    next(err);
  }
}

export async function listTags(_req: Request, res: Response, next: NextFunction) {
  try {
    const products = await prisma.product.findMany({
      select: { tags: true },
      where: { isActive: true },
    });

    // Собираем уникальные теги из всех товаров
    const tagSet = new Set<string>();
    for (const p of products) {
      for (const tag of p.tags) {
        tagSet.add(tag);
      }
    }

    const tags = Array.from(tagSet).sort();
    successResponse(res, tags);
  } catch (err) {
    next(err);
  }
}

// Массовое переименование категории
export async function renameCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: { message: 'oldName и newName обязательны' } });
    }

    const result = await prisma.product.updateMany({
      where: { category: oldName },
      data: { category: newName },
    });

    successResponse(res, { updated: result.count });
  } catch (err) {
    next(err);
  }
}

// Массовое переименование тега
export async function renameTag(req: Request, res: Response, next: NextFunction) {
  try {
    const { oldTag, newTag } = req.body;
    if (!oldTag || !newTag) {
      return res.status(400).json({ success: false, error: { message: 'oldTag и newTag обязательны' } });
    }

    // Находим товары с этим тегом и заменяем
    const products = await prisma.product.findMany({
      where: { tags: { has: oldTag } },
      select: { id: true, tags: true },
    });

    let updated = 0;
    for (const p of products) {
      const newTags = p.tags.map(t => t === oldTag ? newTag : t);
      await prisma.product.update({
        where: { id: p.id },
        data: { tags: newTags },
      });
      updated++;
    }

    successResponse(res, { updated });
  } catch (err) {
    next(err);
  }
}
