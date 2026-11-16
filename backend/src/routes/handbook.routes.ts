import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

const router = Router();
const directory = path.resolve(process.env.HANDBOOK_DIR || '/var/lib/psl/handbook');
const id = z.string().regex(/^[a-f0-9]{64}$/);
const manifest = z.object({
  documents: z.array(z.object({
    id,
    title: z.string(),
    filename: z.string(),
    section: z.enum(['technical', 'certificates']),
    pages: z.number().int().positive(),
  })),
});

router.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' });
  next();
}, authenticate, async (req, _res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true, isBlocked: true, handbookAccess: true },
    });
    if (!user || user.isBlocked || (!user.handbookAccess && user.role !== 'ADMIN')) {
      return next(new AppError('Доступ к справочнику не выдан', 403));
    }
    next();
  } catch (error) {
    next(error);
  }
});

async function loadDocuments() {
  try {
    return manifest.parse(JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'))).documents;
  } catch {
    throw new AppError('Архив справочника пока недоступен', 503);
  }
}

router.get('/', async (_req, res, next) => {
  try {
    successResponse(res, await loadDocuments());
  } catch (error) {
    next(error);
  }
});

router.get('/documents/:id', async (req, res, next) => {
  try {
    const parsed = id.safeParse(req.params.id);
    const document = parsed.success && (await loadDocuments()).find(item => item.id === parsed.data);
    if (!document) return next(new AppError('Документ не найден', 404));
    res.download(path.join(directory, document.id + '.pdf'), document.filename, { cacheControl: false }, error => {
      if (error) next(res.headersSent ? error : new AppError('Файл недоступен', 404));
    });
  } catch (error) {
    next(error);
  }
});

export default router;
