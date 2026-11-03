import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { OnecAuthedRequest } from '../middleware/onec-auth';
import { parseImportXml } from '../services/commerceml/parse-import';
import { parseOffersXml } from '../services/commerceml/parse-offers';
import { applyImport, applyOffers } from '../services/commerceml/apply-catalog';
import { serializeOrdersXml, markOrdersSynced } from '../services/commerceml/serialize-orders';
import { applyOrderUpdates } from '../services/commerceml/apply-order-updates';

const COOKIE_NAME = 'PSL_1C';
const SESSION_TTL_MINUTES = 60;
// Пределы, которые 1С запрашивает в mode=init
const FILE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 МБ на чанк
const USE_ZIP = 'no'; // не принимаем zip (для простоты)

const EXCHANGE_BASE_DIR = path.resolve(env.upload.dir, '..', '1c-exchange');

// Текстовый ответ согласно протоколу CommerceML
function sendText(res: Response, body: string, status = 200): void {
  res.status(status).type('text/plain; charset=utf-8').send(body);
}

function sendSuccess(res: Response, extraLines: string[] = []): void {
  sendText(res, ['success', ...extraLines].join('\n'));
}

function sendFailure(res: Response, reason: string, status = 500): void {
  sendText(res, `failure\n${reason}`, status);
}

async function ensureSessionDir(cookie: string): Promise<string> {
  const dir = path.join(EXCHANGE_BASE_DIR, cookie);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function logExchange(direction: 'INCOMING' | 'OUTGOING', entityType: string, status: 'PENDING' | 'SUCCESS' | 'FAILED', payload: Record<string, unknown>): Promise<void> {
  try {
    await prisma.exchangeLog.create({
      data: {
        direction,
        entityType,
        status,
        request: payload.request as object | undefined,
        response: payload.response as object | undefined,
        error: payload.error as string | undefined,
      },
    });
  } catch {
    // Логирование не должно ломать обмен
  }
}

// ============================================================
// Режим 1: checkauth
// GET /api/1c/exchange?type=catalog&mode=checkauth
// Basic Auth, ответ: "success\n<cookieName>\n<cookieValue>"
// ============================================================
export async function checkauthHandler(req: Request, res: Response): Promise<void> {
  const authedReq = req as OnecAuthedRequest;
  if (!authedReq.onecUser) {
    sendFailure(res, 'Authentication required', 401);
    return;
  }

  const cookie = crypto.randomBytes(24).toString('hex');
  const tempDir = await ensureSessionDir(cookie);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  await prisma.onecSession.create({
    data: { userId: authedReq.onecUser.id, cookie, tempDir, expiresAt },
  });

  sendSuccess(res, [COOKIE_NAME, cookie]);
}

// ============================================================
// Режим 2: init
// GET /api/1c/exchange?type=catalog&mode=init
// Ответ: "zip=no\nfile_limit=<bytes>"
// ============================================================
export async function initHandler(req: Request, res: Response): Promise<void> {
  const authedReq = req as OnecAuthedRequest;
  if (!authedReq.onecSession) {
    sendFailure(res, 'No session', 401);
    return;
  }

  // Чистим временную папку от прошлых файлов
  try {
    const files = await fs.readdir(authedReq.onecSession.tempDir);
    await Promise.all(files.map(f => fs.unlink(path.join(authedReq.onecSession!.tempDir, f))));
  } catch {
    // no-op
  }

  sendText(res, `zip=${USE_ZIP}\nfile_limit=${FILE_LIMIT_BYTES}`);
}

// ============================================================
// Режим 3: file
// POST /api/1c/exchange?type=catalog&mode=file&filename=<name>
// Тело: raw-байты. 1С может дробить файл на чанки — мы дописываем в конец.
// ============================================================
export async function fileHandler(req: Request, res: Response): Promise<void> {
  const authedReq = req as OnecAuthedRequest;
  if (!authedReq.onecSession) {
    sendFailure(res, 'No session', 401);
    return;
  }

  const filename = String(req.query.filename || '').trim();
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    sendFailure(res, 'Invalid filename', 400);
    return;
  }

  const filePath = path.join(authedReq.onecSession.tempDir, filename);

  // Тело — буфер байт (раздаётся через express.raw middleware в роуте)
  const chunk = req.body as Buffer;
  if (!Buffer.isBuffer(chunk)) {
    sendFailure(res, 'Raw body required', 400);
    return;
  }

  await fs.appendFile(filePath, chunk);
  sendSuccess(res);
}

// ============================================================
// Режим 4: import
// GET /api/1c/exchange?type=catalog&mode=import&filename=<name>
// Обрабатываем ранее загруженный файл
// ============================================================
export async function importHandler(req: Request, res: Response): Promise<void> {
  const authedReq = req as OnecAuthedRequest;
  if (!authedReq.onecSession) {
    sendFailure(res, 'No session', 401);
    return;
  }

  const type = String(req.query.type || '').trim();
  const filename = String(req.query.filename || '').trim();
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    sendFailure(res, 'Invalid filename', 400);
    return;
  }

  const filePath = path.join(authedReq.onecSession.tempDir, filename);
  try {
    await fs.access(filePath);
  } catch {
    sendFailure(res, 'File not found on server', 404);
    return;
  }

  try {
    if (type === 'catalog') {
      if (filename.startsWith('import') && filename.endsWith('.xml')) {
        const parsed = await parseImportXml(filePath);
        const result = await applyImport(parsed);
        await logExchange('INCOMING', 'catalog_import', 'SUCCESS', { response: { file: filename, ...result } });
      } else if (filename.startsWith('offers') && filename.endsWith('.xml')) {
        const offers = await parseOffersXml(filePath);
        const result = await applyOffers(offers);
        await logExchange('INCOMING', 'catalog_offers', 'SUCCESS', { response: { file: filename, ...result } });
      } else {
        // Любые прочие файлы (картинки и т.п.) — просто оставляем в temp
        await logExchange('INCOMING', 'catalog_file_received', 'SUCCESS', { response: { file: filename } });
      }
    } else if (type === 'sale') {
      // 1С присылает обновления заказов (например смена статуса) в orders.xml
      if (filename.endsWith('.xml')) {
        const result = await applyOrderUpdates(filePath);
        await logExchange('INCOMING', 'sale_updates', 'SUCCESS', { response: { file: filename, ...result } });
      }
    }
    sendSuccess(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logExchange('INCOMING', `${type}_import`, 'FAILED', { error: msg });
    sendFailure(res, `Import failed: ${msg}`);
  }
}

// ============================================================
// Режим 5: query (только type=sale)
// GET /api/1c/exchange?type=sale&mode=query
// Ответ: orders.xml с новыми/изменёнными заказами
// ============================================================
export async function queryHandler(req: Request, res: Response): Promise<void> {
  const authedReq = req as OnecAuthedRequest;
  if (!authedReq.onecSession) {
    sendFailure(res, 'No session', 401);
    return;
  }

  try {
    const xml = await serializeOrdersXml();
    await logExchange('OUTGOING', 'sale_query', 'SUCCESS', { response: { bytes: xml.length } });
    res.status(200).type('application/xml; charset=utf-8').send(xml);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logExchange('OUTGOING', 'sale_query', 'FAILED', { error: msg });
    sendFailure(res, `Query failed: ${msg}`);
  }
}

// ============================================================
// Режим 6: success (только type=sale)
// GET /api/1c/exchange?type=sale&mode=success
// 1С подтверждает, что приняла orders.xml — помечаем заказы как синхронизированные
// ============================================================
export async function successHandler(req: Request, res: Response): Promise<void> {
  const authedReq = req as OnecAuthedRequest;
  if (!authedReq.onecSession) {
    sendFailure(res, 'No session', 401);
    return;
  }

  try {
    const count = await markOrdersSynced();
    await logExchange('OUTGOING', 'sale_success', 'SUCCESS', { response: { marked: count } });
    sendSuccess(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logExchange('OUTGOING', 'sale_success', 'FAILED', { error: msg });
    sendFailure(res, `Success ack failed: ${msg}`);
  }
}
