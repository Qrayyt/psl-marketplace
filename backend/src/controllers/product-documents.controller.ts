import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';
import { successResponse } from '../utils/apiResponse';

const documentFields = {
  id: true, title: true, kind: true, filename: true, createdAt: true, version: true, supersededById: true,
} as const;

const metadata = z.object({
  title: z.string().trim().min(1).max(160),
  kind: z.enum(['technical', 'certificate', 'safety', 'other']),
});

export async function listProductDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: (req.params.id as string) }, { catalogSlug: (req.params.id as string) }], isActive: true },
      select: {
        documents: { where: { supersededById: null }, select: documentFields, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!product) throw new AppError('Товар не найден', 404);
    successResponse(res, product.documents);
  } catch (error) {
    next(error);
  }
}

export async function listAdminProductDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const documents = await prisma.productDocument.findMany({
      where: { productId: (req.params.id as string) },
      select: documentFields,
      orderBy: { createdAt: 'desc' },
    });
    successResponse(res, documents);
  } catch (error) {
    next(error);
  }
}

export async function uploadProductDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const data = metadata.parse(req.body);
    const file = req.file;
    if (!file || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AppError('Выберите PDF-файл', 400);
    }
    const productId = (req.params.id as string);
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new AppError('Товар не найден', 404);

    const document = await prisma.productDocument.create({
      data: {
        ...data,
        productId,
        filename: data.title + '.pdf',
        content: new Uint8Array(file.buffer),
      },
      select: documentFields,
    });
    successResponse(res, document, 201);
  } catch (error) {
    next(error);
  }
}

export async function replaceProductDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AppError('Выберите PDF-файл', 400);
    }
    const productId = req.params.id as string;
    const id = req.params.documentId as string;
    const document = await prisma.$transaction(async tx => {
      const previous = await tx.productDocument.findFirst({
        where: { id, productId, supersededById: null },
        select: { title: true, kind: true, filename: true, version: true },
      });
      if (!previous) throw new AppError('Актуальная версия документа не найдена', 404);
      const updated = await tx.productDocument.create({
        data: { ...previous, version: previous.version + 1, productId, content: new Uint8Array(file.buffer) },
        select: documentFields,
      });
      const changed = await tx.productDocument.updateMany({
        where: { id, productId, supersededById: null },
        data: { supersededById: updated.id },
      });
      if (!changed.count) throw new AppError('Документ уже обновлён. Откройте его заново.', 409);
      return updated;
    });
    successResponse(res, document, 201);
  } catch (error) {
    next(error);
  }
}

export async function deleteProductDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.productDocument.deleteMany({
      where: { id: (req.params.documentId as string), productId: (req.params.id as string) },
    });
    if (!result.count) throw new AppError('Документ не найден', 404);
    successResponse(res, { message: 'Документ удалён' });
  } catch (error) {
    next(error);
  }
}

export async function downloadProductDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = req.params.id as string;
    const admin = req.baseUrl === '/api/admin' && req.user?.role === 'ADMIN';
    const document = await prisma.productDocument.findFirst({
      where: {
        id: req.params.documentId as string,
        ...(admin ? { productId } : {
          supersededById: null,
          product: { isActive: true, OR: [{ id: productId }, { catalogSlug: productId }] },
        }),
      },
      select: { content: true, filename: true },
    });
    if (!document) throw new AppError('Документ не найден', 404);
    res.set('Cache-Control', 'no-store');
    res.attachment(document.filename.replace(/[\r\n]/g, ' ')).type('application/pdf');
    res.send(Buffer.from(document.content));
  } catch (error) {
    next(error);
  }
}
