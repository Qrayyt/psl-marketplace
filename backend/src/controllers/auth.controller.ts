import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';
import { successResponse } from '../utils/apiResponse';
import { enqueueEmail } from '../jobs/email.queue';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from '../services/token.service';
import { logAudit } from '../services/audit.service';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone,
      },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);
    await storeRefreshToken(user.id, refreshToken);

    await logAudit({
      userId: user.id,
      action: 'register',
      entityType: 'user',
      entityId: user.id,
      ip: req.ip,
    });

    await enqueueEmail({ type: 'welcome', to: user.email, name: user.name });

    successResponse(res, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.isBlocked) {
      throw new AppError('Account is blocked', 403);
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);
    await storeRefreshToken(user.id, refreshToken);

    await logAudit({
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      ip: req.ip,
    });

    successResponse(res, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      throw new AppError('Refresh token is required', 400);
    }

    const payload = await verifyRefreshToken(token);
    if (!payload) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Revoke old, issue new (rotation)
    await revokeRefreshToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.isBlocked) {
      throw new AppError('User not found or blocked', 401);
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.role);
    await storeRefreshToken(user.id, newRefreshToken);

    successResponse(res, { accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await revokeRefreshToken(token);
    }
    successResponse(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    // Always return success to prevent email enumeration
    if (user) {
      // TODO: generate reset token, store in Redis, send email via queue
      console.log(`[Auth] Password reset requested for ${data.email}`);
    }

    successResponse(res, { message: 'If the email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const data = resetPasswordSchema.parse(req.body);

    // TODO: verify reset token from Redis
    // For now — placeholder
    throw new AppError('Password reset not yet implemented', 501);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    successResponse(res, user);
  } catch (err) {
    next(err);
  }
}
