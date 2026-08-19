import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { OtpVerification } from '../models/OtpVerification';
import { sendOtpEmail } from '../services/emailService';
import {
  AppError,
  ApiResponse,
  generateOtp,
  isValidEmail,
  validatePassword
} from '../utils';

/**
 * Step 1: Send registration OTP to unverified email
 */
export async function sendRegisterOtp(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  if (!isValidEmail(email)) {
    throw new AppError('Valid email address is required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    throw new AppError('An account with this email already exists', 400);
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await OtpVerification.deleteMany({ email: normalizedEmail, purpose: 'REGISTER' });

  await OtpVerification.create({
    email: normalizedEmail,
    otp: hashedOtp,
    purpose: 'REGISTER',
    createdAt: new Date()
  });

  await sendOtpEmail(normalizedEmail, otp);

  ApiResponse.success(
    res,
    null,
    200,
    'Verification code sent to your email. It will expire in 10 minutes.'
  );
}

/**
 * Step 2: Complete registration with verified OTP and password
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, otp, tier } = req.body;
  if (!email || !password || !otp) {
    throw new AppError('Email, password, and OTP code are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const validation = validatePassword(password);
  if (!validation.isValid) {
    throw new AppError(validation.error || 'Password does not meet complexity requirements', 400);
  }

  const otpRecord = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose: 'REGISTER'
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError('Verification code expired or not requested. Please request a new code.', 400);
  }

  const isOtpValid = await bcrypt.compare(String(otp).trim(), otpRecord.otp);
  if (!isOtpValid) {
    throw new AppError('Invalid verification code', 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        tier: tier === 'PRO' ? 'PRO' : 'FREE'
      }
    });

    await OtpVerification.deleteMany({ email: normalizedEmail, purpose: 'REGISTER' });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    ApiResponse.success(
      res,
      {
        token,
        user: { id: user.id, email: user.email, tier: user.tier, role: user.role }
      },
      201,
      'Account created successfully'
    );
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError('User already exists', 400);
    }
    throw err;
  }
}

/**
 * User Login
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Email and password required', 400);
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new AppError('Invalid credentials', 400);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid credentials', 400);
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  ApiResponse.success(res, {
    token,
    user: { id: user.id, email: user.email, tier: user.tier, role: user.role }
  });
}

/**
 * Fetch Public Tiers
 */
export async function getPublicTiers(_req: Request, res: Response): Promise<void> {
  const configs = await prisma.tierConfig.findMany({
    orderBy: { maxTierLimit: 'asc' }
  });

  ApiResponse.success(res, { configs });
}
