import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { successResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

const addressSchema = z.object({
  address: z.string().min(1, 'Адрес обязателен'),
  city: z.string().min(1, 'Город обязателен'),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function getAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const addresses = await prisma.deliveryAddress.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    successResponse(res, addresses);
  } catch (err) {
    next(err);
  }
}

export async function createAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const data = addressSchema.parse(req.body);

    // Если это первый адрес или помечен как дефолтный - сбросить другие
    if (data.isDefault) {
      await prisma.deliveryAddress.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }

    const count = await prisma.deliveryAddress.count({ where: { userId: req.user!.id } });

    const address = await prisma.deliveryAddress.create({
      data: {
        userId: req.user!.id,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        isDefault: data.isDefault || count === 0, // первый адрес = дефолтный
      },
    });

    successResponse(res, address, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = addressSchema.partial().parse(req.body);

    const existing = await prisma.deliveryAddress.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError('Адрес не найден', 404);
    }

    if (data.isDefault) {
      await prisma.deliveryAddress.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.deliveryAddress.update({
      where: { id },
      data,
    });

    successResponse(res, address);
  } catch (err) {
    next(err);
  }
}

export async function deleteAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.deliveryAddress.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError('Адрес не найден', 404);
    }

    await prisma.deliveryAddress.delete({ where: { id } });
    successResponse(res, { message: 'Адрес удален' });
  } catch (err) {
    next(err);
  }
}

export async function setDefaultAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.deliveryAddress.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError('Адрес не найден', 404);
    }

    await prisma.deliveryAddress.updateMany({
      where: { userId: req.user!.id },
      data: { isDefault: false },
    });

    const address = await prisma.deliveryAddress.update({
      where: { id },
      data: { isDefault: true },
    });

    successResponse(res, address);
  } catch (err) {
    next(err);
  }
}
