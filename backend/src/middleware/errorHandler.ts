import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/apiResponse';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode);
  }

  if (err instanceof multer.MulterError) {
    return errorResponse(res, err.code === 'LIMIT_FILE_SIZE' ? 'Файл превышает допустимый размер' : 'Не удалось принять файл', 400);
  }

  if (err instanceof ZodError) {
    return errorResponse(res, 'Validation error', 422, err.errors);
  }

  console.error('[Error]', err);
  return errorResponse(
    res,
    env.isDev ? err.message : 'Internal server error',
    500,
  );
}
