import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validatsiya xatosi',
      details: err.errors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Bu ma\'lumot allaqachon mavjud',
        field: (err.meta?.target as string[])?.[0],
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Ma\'lumot topilmadi' });
    }
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Server xatoligi' : err.message,
  });
}

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
