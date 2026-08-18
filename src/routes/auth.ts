import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  sendRegisterOtp,
  register,
  login,
  getPublicTiers
} from '../controllers/auth.controller';

const router = Router();

router.post('/send-register-otp', asyncHandler(sendRegisterOtp));
router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/tiers', asyncHandler(getPublicTiers));

export default router;
