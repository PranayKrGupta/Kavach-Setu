import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateToken } from '../middlewares/auth';
import {
  getProfile,
  sendEmailUpdateOtp,
  updateEmail,
  updatePassword,
  deleteAccount
} from '../controllers/user.controller';

const router = Router();

// Protect all user endpoints
router.use(authenticateToken);

router.get('/me', asyncHandler(getProfile));
router.post('/email/send-otp', asyncHandler(sendEmailUpdateOtp));
router.patch('/email', asyncHandler(updateEmail));
router.patch('/password', asyncHandler(updatePassword));
router.delete('/account', asyncHandler(deleteAccount));

export default router;
