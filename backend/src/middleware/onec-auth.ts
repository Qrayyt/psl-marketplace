import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db';

// Ответ обмену: текстовый формат CommerceML (не JSON)
// "failure" + перевод строки + причина — стандартное поведение протокола
function sendFailure(res: Response, reason: string, code = 401): void {
  res.status(code).type('text/plain; charset=utf-8').send(`failure\n${reason}`);
}

export interface OnecAuthedRequest extends Request {
  onecUser?: { id: string; login: string };
  onecSession?: { id: string; cookie: string; tempDir: string };
}

// Basic Auth для режима checkauth: только Authorization-заголовок
export async function requireBasicAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    sendFailure(res, 'Basic authentication required');
    return;
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
  const sepIdx = decoded.indexOf(':');
  if (sepIdx === -1) {
    sendFailure(res, 'Invalid credentials format');
    return;
  }

  const login = decoded.slice(0, sepIdx);
  const password = decoded.slice(sepIdx + 1);

  const user = await prisma.onecUser.findUnique({ where: { login } });
  if (!user || !user.isActive) {
    sendFailure(res, 'Invalid credentials');
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    sendFailure(res, 'Invalid credentials');
    return;
  }

  await prisma.onecUser.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  (req as OnecAuthedRequest).onecUser = { id: user.id, login: user.login };
  next();
}

// Cookie-сессия: 1С передаёт куку, выданную на шаге checkauth
export async function requireOnecSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookieHeader = req.headers.cookie || '';
  // 1С посылает "PSL_1C=<value>" (имя куки мы возвращаем в checkauth-ответе)
  const match = /PSL_1C=([^;\s]+)/.exec(cookieHeader);
  const cookie = match?.[1];

  if (!cookie) {
    sendFailure(res, 'Session cookie required');
    return;
  }

  const session = await prisma.onecSession.findUnique({
    where: { cookie },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    sendFailure(res, 'Session expired or invalid');
    return;
  }

  (req as OnecAuthedRequest).onecUser = { id: session.user.id, login: session.user.login };
  (req as OnecAuthedRequest).onecSession = { id: session.id, cookie: session.cookie, tempDir: session.tempDir };
  next();
}
