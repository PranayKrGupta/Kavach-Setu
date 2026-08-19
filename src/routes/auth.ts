import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authLoginLimiter, authOtpLimiter } from '../middlewares/authRateLimiter';
import {
  sendRegisterOtp,
  register,
  login,
  googleAuth,
  getAuthConfig,
  getPublicTiers
} from '../controllers/auth.controller';

const router = Router();

router.post('/send-register-otp', authOtpLimiter, asyncHandler(sendRegisterOtp));
router.post('/register', asyncHandler(register));
router.post('/login', authLoginLimiter, asyncHandler(login));
router.post('/google', authLoginLimiter, asyncHandler(googleAuth));
router.get('/config', asyncHandler(getAuthConfig));
router.get('/tiers', asyncHandler(getPublicTiers));

export default router;

