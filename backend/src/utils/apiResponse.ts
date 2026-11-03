import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function successResponse(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function paginatedResponse(
  res: Response,
  data: unknown[],
  meta: PaginationMeta,
) {
  return res.status(200).json({
    success: true,
    data,
    meta,
  });
}

export function errorResponse(
  res: Response,
  message: string,
  status = 400,
  errors?: unknown,
) {
  return res.status(status).json({
    success: false,
    error: { message, ...(errors ? { details: errors } : {}) },
  });
}
