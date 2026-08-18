import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/appError';

export const isAdmin = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return next(new AppError('Forbidden: Admin access required', 403));
    }

    next();
  } catch (error) {
    next(error);
  }
};
