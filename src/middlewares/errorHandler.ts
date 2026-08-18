import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/appError';

/**
 * Centralized Express Error Handling Middleware.
 * Catches all operational AppError instances and unhandled runtime exceptions.
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal server error';

  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error('[Unhandled Exception]:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message
  });
};
