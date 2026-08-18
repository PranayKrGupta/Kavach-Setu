import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateToken } from '../middlewares/auth';
import { getMetrics } from '../controllers/metrics.controller';

const router = Router();

// Protect metrics route
router.use(authenticateToken);

router.get('/', asyncHandler(getMetrics));

export default router;
