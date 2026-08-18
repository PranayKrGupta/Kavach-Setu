import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateToken } from '../middlewares/auth';
import { isAdmin } from '../middlewares/isAdmin';
import {
  getAllUsers,
  toggleUserBan,
  updateUserRole,
  updateUserTier,
  getTierConfigs,
  updateTierConfig
} from '../controllers/admin.controller';

const router = Router();

// Protect all admin endpoints
router.use(authenticateToken, isAdmin);

router.get('/users', asyncHandler(getAllUsers));
router.patch('/users/:id/ban', asyncHandler(toggleUserBan));
router.patch('/users/:id/role', asyncHandler(updateUserRole));
router.patch('/users/:id/tier', asyncHandler(updateUserTier));
router.get('/config/tiers', asyncHandler(getTierConfigs));
router.patch('/config/tiers/:id', asyncHandler(updateTierConfig));

export default router;
