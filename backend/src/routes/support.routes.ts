import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';
import { successResponse } from '../utils/apiResponse';
import { logAudit } from '../services/audit.service';
import { summarizeSupport, suggestSupportNote } from '../services/support-context.service';

const router = Router();
const contact = { id: true, name: true, email: true, phone: true } as const;
const messageFields = { id: true, author: true, body: true, createdAt: true } as const;
const body = z.string().trim().min(1).max(4000);
const uuid = z.string().uuid();
const handoff = z.object({
  id: uuid,
  messages: z.array(z.object({ author: z.enum(['CUSTOMER', 'GUARDEX']), body })).max(40),
});
const reply = z.object({ key: uuid, body });
type Handler = (req: Request, res: Response) => Promise<void>;
const run = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  void fn(req, res).catch(next);
};

router.use(authenticate, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.id }, select: { role: true, isBlocked: true },
    });
    if (!actor || actor.isBlocked) throw new AppError('Аккаунт недоступен', 403);
    req.user!.role = actor.role;
    next();
  } catch (error) { next(error); }
});

function staff(req: Request) {
  if (req.user!.role === 'USER') throw new AppError('Раздел доступен сотрудникам PSL', 403);
  return req.user!;
}

function caseScope(req: Request): Prisma.SupportCaseWhereInput {
  const actor = staff(req);
  return actor.role === 'ADMIN' ? {} : { OR: [{ status: 'WAITING' }, { managerId: actor.id }] };
}

function caseId(req: Request) {
  return uuid.parse(req.params.id);
}

router.post('/cases', run(async (req, res) => {
  const { id, messages } = handoff.parse(req.body);
  const customerId = req.user!.id;
  const existing = await prisma.supportCase.findUnique({ where: { id }, select: { id: true, customerId: true } });
  if (existing) {
    if (existing.customerId !== customerId) throw new AppError('Диалог недоступен', 404);
    successResponse(res, { id });
    return;
  }
  const summary = await summarizeSupport(messages);
  try {
    await prisma.supportCase.create({
      data: { id, customerId, summary: summary.text, generated: summary.generated, messages: { create: messages } },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002'
      || !await prisma.supportCase.findFirst({ where: { id, customerId }, select: { id: true } })) throw error;
  }
  successResponse(res, { id }, 201);
}));

router.get('/cases', run(async (req, res) => {
  const data = await prisma.supportCase.findMany({
    where: { customerId: req.user!.id },
    select: { id: true, status: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }, take: 30,
  });
  successResponse(res, data);
}));

router.get('/staff/queue', run(async (req, res) => {
  const scope = caseScope(req);
  const select = {
    id: true, status: true, summary: true, generated: true, updatedAt: true,
    customer: { select: { name: true } }, manager: { select: { name: true } },
  } as const;
  const [waiting, active, closed] = await Promise.all(
    (['WAITING', 'ACTIVE', 'CLOSED'] as const).map(status => prisma.supportCase.findMany({
      where: { ...scope, status }, orderBy: { updatedAt: status === 'WAITING' ? 'asc' : 'desc' }, take: 50, select,
    })),
  );
  successResponse(res, [...waiting, ...active, ...closed]);
}));

router.get('/staff/team', run(async (req, res) => {
  if (staff(req).role !== 'ADMIN') throw new AppError('Нужны права администратора', 403);
  successResponse(res, await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { ...contact, role: true, isBlocked: true }, orderBy: { name: 'asc' },
  }));
}));

router.put('/staff/team', run(async (req, res) => {
  const actor = staff(req);
  if (actor.role !== 'ADMIN') throw new AppError('Нужны права администратора', 403);
  const { email, role } = z.object({
    email: z.string().trim().email().max(254), role: z.enum(['USER', 'MANAGER']),
  }).parse(req.body);
  const target = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, role: true },
  });
  if (!target) throw new AppError('Сначала сотрудник должен зарегистрироваться на сайте', 404);
  if (target.role === 'ADMIN') throw new AppError('Роль администратора здесь не меняется', 409);
  const user = await prisma.$transaction(async tx => {
    const changed = await tx.user.updateMany({
      where: { id: target.id, role: { in: ['USER', 'MANAGER'] } }, data: { role },
    });
    if (!changed.count) throw new AppError('Роль аккаунта изменилась. Обновите список.', 409);
    if (role === 'USER') await tx.supportCase.updateMany({
      where: { managerId: target.id, status: 'ACTIVE' }, data: { managerId: null, status: 'WAITING' },
    });
    return tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { ...contact, role: true } });
  });
  await logAudit({ userId: actor.id, action: 'support_role_updated', entityType: 'user', entityId: user.id, details: { role }, ip: req.ip });
  successResponse(res, user);
}));

router.get('/cases/:id', run(async (req, res) => {
  const actor = req.user!;
  const id = caseId(req);
  const asStaff = req.query.staff === '1';
  const scope = asStaff ? caseScope(req) : { customerId: actor.id };
  const after = z.coerce.number().int().min(0).max(2147483647).parse(req.query.after ?? 0);
  const conversation = await prisma.supportCase.findFirst({
    where: { id, ...scope },
    select: {
      id: true, status: true, managerId: true, manager: { select: { name: true } },
      ...(asStaff ? { customer: { select: contact }, summary: true, generated: true } : {}),
      messages: { where: { id: { gt: after } }, select: messageFields, orderBy: { id: 'asc' }, take: 200 },
    },
  });
  if (!conversation) throw new AppError('Диалог недоступен', 404);
  const { managerId, ...publicCase } = conversation;
  if (!asStaff) {
    successResponse(res, publicCase);
    return;
  }
  const assigned = managerId === actor.id;
  const canReply = conversation.status === 'ACTIVE' && assigned;
  const customerId = conversation.customer?.id;
  const notes = customerId && (managerId === actor.id || actor.role === 'ADMIN')
    ? await prisma.clientNote.findMany({
        where: { customerId, OR: [
          { status: 'ACCEPTED' },
          { status: 'PENDING', message: { caseId: id } },
        ] },
        select: { id: true, body: true, status: true, generated: true },
        orderBy: { createdAt: 'desc' }, take: 100,
      })
    : [];
  successResponse(res, { ...publicCase, canReply, canReview: assigned, notes });
}));

router.post('/staff/cases/:id/claim', run(async (req, res) => {
  const actor = staff(req);
  const id = caseId(req);
  const claimed = await prisma.supportCase.updateMany({
    where: { id, status: 'WAITING', customerId: { not: actor.id } },
    data: { status: 'ACTIVE', managerId: actor.id },
  });
  if (!claimed.count && !await prisma.supportCase.findFirst({ where: { id, status: 'ACTIVE', managerId: actor.id }, select: { id: true } })) {
    throw new AppError('Диалог уже взят или недоступен', 409);
  }
  successResponse(res, { id });
}));

router.post('/staff/cases/:id/close', run(async (req, res) => {
  const actor = staff(req);
  const id = caseId(req);
  const closed = await prisma.supportCase.updateMany({
    where: { id, status: 'ACTIVE', managerId: actor.id }, data: { status: 'CLOSED' },
  });
  if (!closed.count) throw new AppError('Диалог уже завершён или недоступен', 409);
  successResponse(res, { id });
}));

router.post('/cases/:id/messages', run(async (req, res) => {
  const id = caseId(req);
  const actor = req.user!;
  const { key, body: text } = reply.parse(req.body);
  const asStaff = req.query.staff === '1';
  if (asStaff) staff(req);
  const author = asStaff ? 'MANAGER' : 'CUSTOMER';
  const result = await prisma.$transaction(async tx => {
    const scope = asStaff ? { managerId: actor.id } : { customerId: actor.id };
    const updated = await tx.supportCase.updateMany({
      where: { id, ...scope, status: asStaff ? 'ACTIVE' : { in: ['WAITING', 'ACTIVE'] } },
      data: { updatedAt: new Date() },
    });
    if (!updated.count) throw new AppError('Диалог завершён или недоступен', 409);
    const message = await tx.supportMessage.upsert({
      where: { caseId_clientKey: { caseId: id, clientKey: author + ':' + key } },
      update: {}, create: { caseId: id, author, body: text, clientKey: author + ':' + key },
      select: messageFields,
    });
    const conversation = await tx.supportCase.findUniqueOrThrow({
      where: { id }, select: { customerId: true, status: true },
    });
    return { message, ...conversation };
  });

  if (!asStaff && result.status === 'ACTIVE') {
    try {
      const recent = await prisma.supportMessage.findMany({
        where: { caseId: id, id: { lte: result.message.id } },
        orderBy: { id: 'desc' }, take: 18, select: { body: true, author: true },
      });
      const suggestion = await suggestSupportNote(recent.reverse());
      if (suggestion) await prisma.clientNote.upsert({
        where: { messageId: result.message.id },
        create: { customerId: result.customerId, messageId: result.message.id, body: suggestion.text, generated: suggestion.generated },
        update: {},
      });
    } catch {
      console.warn('Support note suggestion could not be saved');
    }
  }
  successResponse(res, result.message, 201);
}));

router.patch('/staff/cases/:id/notes/:noteId', run(async (req, res) => {
  const actor = staff(req);
  const id = caseId(req);
  const noteId = uuid.parse(req.params.noteId);
  const status = z.enum(['ACCEPTED', 'DISMISSED']).parse(req.body.status);
  const updated = await prisma.clientNote.updateMany({
    where: { id: noteId, status: 'PENDING', message: { caseId: id, conversation: { managerId: actor.id } } },
    data: { status, managerId: actor.id },
  });
  if (!updated.count) throw new AppError('Предложение уже обработано или недоступно', 409);
  successResponse(res, { id: noteId, status });
}));

export default router;
