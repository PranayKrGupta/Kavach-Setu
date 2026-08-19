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
        tier: 'FREE'
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

  if (!user.passwordHash) {
    throw new AppError(
      'This account was created with Google Sign-In. Please click "Continue with Google" to sign in.',
      400
    );
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
 * Direct Google Authentication (Login & Register)
 * POST /api/auth/google
 */
export async function googleAuth(req: Request, res: Response): Promise<void> {
  const { credential } = req.body;
  if (!credential || typeof credential !== 'string') {
    throw new AppError('Google credential token is required', 400);
  }

  let googlePayload: {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
    aud?: string;
  };

  try {
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const verifyRes = await fetch(verifyUrl);
    if (!verifyRes.ok) {
      const errBody = (await verifyRes.json().catch(() => ({}))) as { error_description?: string };
      throw new Error(errBody.error_description || 'Failed to verify Google credential');
    }
    googlePayload = await verifyRes.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    throw new AppError(`Google authentication failed: ${message}`, 401);
  }

  const { sub: googleId, email, email_verified } = googlePayload;

  if (!email || (email_verified !== true && email_verified !== 'true')) {
    throw new AppError('Google account email is not verified', 400);
  }

  if (env.GOOGLE_CLIENT_ID && googlePayload.aud && googlePayload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google client ID verification mismatch', 401);
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        ...(googleId ? [{ googleId }] : [])
      ]
    }
  });

  if (user) {
    if (user.isBanned) {
      throw new AppError('Your account is suspended. Please contact support.', 403);
    }

    // Link googleId if not linked yet
    if (!user.googleId && googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, authProvider: 'GOOGLE' }
      });
    }
  } else {
    // Register new user automatically with FREE tier
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        googleId,
        authProvider: 'GOOGLE',
        tier: 'FREE',
        role: 'USER'
      }
    });
  }

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
    200,
    'Authenticated successfully with Google'
  );
}

/**
 * Fetch Public Auth Configuration (e.g. Google Client ID)
 * GET /api/auth/config
 */
export async function getAuthConfig(_req: Request, res: Response): Promise<void> {
  ApiResponse.success(res, {
    googleClientId: env.GOOGLE_CLIENT_ID || ''
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

