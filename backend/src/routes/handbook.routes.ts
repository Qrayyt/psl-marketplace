import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

const router = Router();
export const productHandbookRoutes = Router({ mergeParams: true });
const directory = path.resolve(process.env.HANDBOOK_DIR || '/var/lib/psl/handbook');
const id = z.string().regex(/^[a-f0-9]{64}$/);
const manifest = z.object({
  documents: z.array(z.object({
    id,
    title: z.string(),
    filename: z.string(),
    section: z.enum(['technical', 'certificates']),
    pages: z.number().int().positive(),
    product: z.string(),
  })),
  articles: z.array(z.object({
    title: z.string(), section: z.string(),
    source: z.string().regex(/^https:\/\/psl-handbook-insight\.tilda\.ws\/page[0-9]+\.html$/),
  })),
});

async function loadHandbook() {
  try {
    return manifest.parse(JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')));
  } catch {
    throw new AppError('Архив справочника пока недоступен', 503);
  }
}

function normalizeProduct(name: string) {
  return name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

async function productDocuments(slug: string) {
  const product = await prisma.product.findFirst({
    where: { isActive: true, OR: [{ id: slug }, { catalogSlug: slug }] },
    select: { name: true },
  });
  if (!product) throw new AppError('Товар не найден', 404);
  const name = normalizeProduct(product.name);
  return (await loadHandbook()).documents.filter(item => item.section === 'technical' && normalizeProduct(item.product) === name);
}

router.get('/', async (_req, res, next) => {
  try {
    const data = await loadHandbook();
    successResponse(res, { articles: data.articles, documents: data.documents.filter(item => item.section === 'certificates') });
  } catch (error) {
    next(error);
  }
});

productHandbookRoutes.get<{ id: string }>('/', async (req, res, next) => {
  try {
    successResponse(res, await productDocuments(req.params.id as string));
  } catch (error) {
    next(error);
  }
});

function serveDocument(documents: (req: import('express').Request) => Promise<z.infer<typeof manifest>['documents']>) {
  const handler: import('express').RequestHandler = async (req, res, next) => {
    try {
      const parsed = id.safeParse(req.params.documentId);
      const document = parsed.success && (await documents(req)).find(item => item.id === parsed.data);
      if (!document) throw new AppError('Документ не найден', 404);
      res.download(path.join(directory, document.id + '.pdf'), document.filename, error => {
        if (error) next(res.headersSent ? error : new AppError('Файл недоступен', 404));
      });
    } catch (error) {
      next(error);
    }
  };
  return handler;
}

router.get('/documents/:documentId', serveDocument(async () =>
  (await loadHandbook()).documents.filter(item => item.section === 'certificates')));
productHandbookRoutes.get('/:documentId', serveDocument(req => productDocuments((req.params as { id: string }).id)));

export default router;
