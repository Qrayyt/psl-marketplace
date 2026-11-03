import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';

interface JwtPayload {
  userId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
    req.user = { id: payload.userId, role: payload.role };
  } catch {
    // Token invalid — proceed without user
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

export async function checkBlocked(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next();

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isBlocked: true },
  });

  if (user?.isBlocked) {
    return next(new AppError('Account is blocked', 403));
  }
  next();
}
