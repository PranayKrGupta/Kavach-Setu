import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { AppError } from '../utils/appError';

export { AuthenticatedRequest, AuthenticatedRequest as AuthRequest } from '../types';

export const authenticateToken = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('Access token required', 401));
  }

  jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      return next(new AppError('Invalid or expired token', 403));
    }

    req.user = decoded as JwtPayload;
    next();
  });
};
