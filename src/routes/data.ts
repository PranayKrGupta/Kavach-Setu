import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getProtectedData } from '../controllers/data.controller';

const router = Router();

// Public sample API endpoint useful as a target URL for proxying
router.all('/', asyncHandler(getProtectedData));

export default router;
