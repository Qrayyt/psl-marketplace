import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const CSRF_COOKIE = 'psl_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * CSRF-защита через double-submit cookie.
 * Для JWT API это дополнительный слой безопасности.
 *
 * Как работает:
 * 1. Сервер устанавливает cookie psl_csrf с токеном
 * 2. Клиент читает cookie и отправляет его в заголовке X-CSRF-Token
 * 3. Сервер сравнивает cookie и заголовок
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Устанавливаем/обновляем CSRF cookie если нет
  if (!req.cookies[CSRF_COOKIE]) {
    const token = uuidv4();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // Клиент должен читать
      sameSite: 'strict',
      secure: req.secure,
      maxAge: 86400000, // 24 часа
    });
  }

  // Для безопасных методов - пропускаем проверку
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Для API-запросов с Authorization header (Bearer token) - пропускаем
  // CSRF актуален только для cookie-based auth
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  // Для JSON API-запросов (Content-Type: application/json) - пропускаем
  // Браузер не может отправить JSON POST через форму (CORS защищает)
  if (req.headers['content-type']?.includes('application/json')) {
    return next();
  }

  // Проверяем CSRF для остальных мутирующих запросов
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      error: { message: 'Invalid CSRF token' },
    });
  }

  next();
}
