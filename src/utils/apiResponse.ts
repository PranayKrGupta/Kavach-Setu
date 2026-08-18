import { Response } from 'express';

export class ApiResponse {
  /**
   * Send a formatted JSON success response
   */
  static success<T>(res: Response, data: T, statusCode: number = 200, message?: string): Response {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return res.status(statusCode).json({
        success: true,
        ...(message ? { message } : {}),
        ...data
      });
    }

    return res.status(statusCode).json({
      success: true,
      ...(message ? { message } : {}),
      data
    });
  }

  /**
   * Send a formatted JSON error response
   */
  static error(res: Response, message: string, statusCode: number = 400): Response {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
}
