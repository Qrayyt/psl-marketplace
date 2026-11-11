import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Product } from '@prisma/client';
import { prisma } from '../../config/db';
import { successResponse, paginatedResponse } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { logAudit } from '../../services/audit.service';
import { processImage, saveProductCover, removeProductCover } from '../../services/image.service';
import { invalidateProductsCache } from '../../services/cache.service';

const createProductSchema = z.object({
  name: z.string().min(1),
  brand: z.string().trim().max(100).nullable().optional(),
  sku: z.string().trim().max(120).nullable().optional(),
  sourceUrl: z.string().url().refine(url => /^https?:\/\//i.test(url)).nullable().optional(),
  isActive: z.boolean().optional(),
  logoOnly: z.boolean().optional(),
  price: z.number().min(0),
  oldPrice: z.number().min(0).optional().nullable(),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).default(0),
  reviewsCount: z.number().min(0).default(0),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  details: z.array(z.string()).default([]),
  accent: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

const editorSchema = createProductSchema.extend({
  guardexDescription: z.string().trim().max(4000).nullable().optional(),
});

function editorProduct({ guardex, ...product }: Product & { guardex: { description: string | null } | null }) {
  return { ...product, guardexDescription: guardex?.description ?? null };
}

export async function getAdminProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id as string }, include: { guardex: true } });
    if (!product) throw new AppError('Товар не найден', 404);
    successResponse(res, editorProduct(product));
  } catch (error) {
    next(error);
  }
}

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const isActive = req.query.is_active !== undefined
      ? req.query.is_active === 'true'
      : undefined;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.product.count({ where }),
    ]);

    paginatedResponse(res, products, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

function productBody(req: Request): unknown {
  if (!req.is('multipart/form-data')) return req.body;
  try {
    return JSON.parse(req.body.product);
  } catch {
    throw new AppError('Не удалось прочитать данные товара', 400);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { guardexDescription, ...data } = editorSchema.parse(productBody(req));
    const image = req.file ? await saveProductCover(req.file.buffer) : undefined;
    const product = await prisma.product.create({
      data: {
        ...data,
        ...(image && { imageUrl: image.url, imageUrls: [image.url], logoOnly: false }),
        guardex: guardexDescription ? { create: { description: guardexDescription } } : undefined,
      },
      include: { guardex: true },
    }).catch(async error => {
      if (image) await removeProductCover(image.filename);
      throw error;
    });
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'product_created',
      entityType: 'product',
      entityId: product.id,
      details: { name: product.name },
      ip: req.ip,
    });

    successResponse(res, editorProduct(product), 201);
  } catch (err) {
    next(err);
  }
}

// Поля, которые 1С контролирует целиком - нельзя править вручную у 1С-товаров,
// иначе при следующем обмене всё затрётся. Ручная картинка (imageUrl) разрешена.
const FIELDS_OWNED_BY_1C = [
  'name', 'sku', 'price', 'oldPrice', 'category',
  'description', 'color', 'sizes', 'tags', 'details',
] as const;

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { guardexDescription, ...data } = editorSchema.partial().parse(productBody(req));

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Товар не найден', 404);

    if (existing.externalId) {
      const blocked = FIELDS_OWNED_BY_1C.filter(f => f in data);
      if (blocked.length) {
        throw new AppError(
          `Товар синхронизирован с 1С, поля ${blocked.join(', ')} редактируются только в 1С`,
          409,
        );
      }
    }

    const image = req.file ? await saveProductCover(req.file.buffer) : undefined;
    const cover = image?.url ?? data.imageUrl;
    const imageUrls = cover && cover !== existing.imageUrl && (image || existing.imageUrls.length)
      ? [cover, ...existing.imageUrls.filter(url => url !== cover)]
      : undefined;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(image && { imageUrl: image.url, logoOnly: false }),
        imageUrls,
        guardex: guardexDescription === undefined ? undefined : { upsert: {
          create: { description: guardexDescription },
          update: { description: guardexDescription },
        } },
      },
      include: { guardex: true },
    }).catch(async error => {
      if (image) await removeProductCover(image.filename);
      throw error;
    });
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'product_updated',
      entityType: 'product',
      entityId: id,
      details: { changes: Object.keys(data) },
      ip: req.ip,
    });

    successResponse(res, editorProduct(product));
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Товар не найден', 404);

    // Soft delete
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'product_deleted',
      entityType: 'product',
      entityId: id,
      details: { name: existing.name },
      ip: req.ip,
    });

    successResponse(res, { message: 'Товар деактивирован' });
  } catch (err) {
    next(err);
  }
}

export async function restoreProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Товар не найден', 404);

    await prisma.product.update({ where: { id }, data: { isActive: true } });
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'product_restored',
      entityType: 'product',
      entityId: id,
      details: { name: existing.name },
      ip: req.ip,
    });

    successResponse(res, { message: 'Товар восстановлен' });
  } catch (err) {
    next(err);
  }
}

export async function hardDeleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Товар не найден', 404);

    if (existing.externalId) {
      throw new AppError(
        'Товар синхронизирован с 1С, полное удаление невозможно. Скройте товар или удалите его в 1С',
        409,
      );
    }

    // Удаляем связанные записи
    await prisma.cartItem.deleteMany({ where: { productId: id } });
    await prisma.favorite.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'product_hard_deleted',
      entityType: 'product',
      entityId: id,
      details: { name: existing.name },
      ip: req.ip,
    });

    successResponse(res, { message: 'Товар полностью удалён' });
  } catch (err) {
    next(err);
  }
}

export async function importProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.array(createProductSchema);
    const products = schema.parse(req.body);

    let created = 0;
    for (const data of products) {
      await prisma.product.create({ data });
      created++;
    }
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'products_imported',
      entityType: 'product',
      details: { count: created },
      ip: req.ip,
    });

    successResponse(res, { imported: created }, 201);
  } catch (err) {
    next(err);
  }
}

export async function uploadProductImage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Товар не найден', 404);

    if (!req.file) throw new AppError('Файл не загружен', 400);

    const image = await processImage(req.file);

    const currentUrls = existing.imageUrls || [];
    const newUrls = [...currentUrls, image.url];

    await prisma.product.update({
      where: { id },
      data: {
        imageUrl: image.url,
        imageUrls: newUrls,
      },
    });
    await invalidateProductsCache();

    await logAudit({
      userId: req.user!.id,
      action: 'product_image_uploaded',
      entityType: 'product',
      entityId: id,
      details: { filename: image.filename },
      ip: req.ip,
    });

    successResponse(res, { imageUrl: image.url, imageUrls: newUrls });
  } catch (err) {
    next(err);
  }
}

export async function deleteProductImage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { imageUrl: urlToDelete } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Товар не найден', 404);

    const newUrls = (existing.imageUrls || []).filter((u: string) => u !== urlToDelete);
    const newMain = urlToDelete === existing.imageUrl ? (newUrls[0] || null) : existing.imageUrl;

    await prisma.product.update({
      where: { id },
      data: { imageUrl: newMain, imageUrls: newUrls },
    });
    await invalidateProductsCache();

    successResponse(res, { imageUrl: newMain, imageUrls: newUrls });
  } catch (err) {
    next(err);
  }
}
