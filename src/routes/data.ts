import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { rateLimiter } from '../middlewares/rateLimiter';
import { getProtectedData } from '../controllers/data.controller';

const router = Router();

// Protect sample endpoint with rate limiting
router.get('/', rateLimiter, asyncHandler(getProtectedData));

export default router;
