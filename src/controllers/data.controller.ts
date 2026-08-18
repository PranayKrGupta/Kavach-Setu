import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';

/**
 * GET /api/data: Rate-limited mock data endpoint
 */
export async function getProtectedData(_req: Request, res: Response): Promise<void> {
  ApiResponse.success(
    res,
    {
      timestamp: new Date().toISOString(),
      randomValue: Math.floor(Math.random() * 1000)
    },
    200,
    'Success! You have accessed the protected data route.'
  );
}
