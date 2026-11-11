import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { successResponse } from '../../utils/apiResponse';

const brandSchema = z.object({
  name: z.string().trim().min(1).max(100).transform(name => name.replace(/\s+/g, ' ')),
  description: z.string().trim().max(4000).optional(),
});

export async function listBrands(_req: Request, res: Response, next: NextFunction) {
  try {
    const [brands, products] = await Promise.all([
      prisma.brand.findMany(),
      prisma.product.findMany({ where: { brand: { not: null } }, select: { brand: true }, distinct: ['brand'] }),
    ]);
    const byKey = new Map(brands.map(brand => [brand.key, brand]));
    for (const { brand } of products) {
      const name = brand?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { key, name, description: null });
    }
    successResponse(res, [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  } catch (error) {
    next(error);
  }
}

export async function createBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description } = brandSchema.parse(req.body);
    const key = name.toLowerCase();
    await prisma.brand.createMany({ data: [{ key, name, description: description || null }], skipDuplicates: true });
    successResponse(res, await prisma.brand.findUniqueOrThrow({ where: { key } }), 201);
  } catch (error) {
    next(error);
  }
}
