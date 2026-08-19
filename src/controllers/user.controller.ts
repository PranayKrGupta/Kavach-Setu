import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { OtpVerification } from '../models/OtpVerification';
import { sendOtpEmail } from '../services/emailService';
import {
  AppError,
  ApiResponse,
  checkLastAdmin,
  generateOtp,
  isValidEmail,
  validatePassword
} from '../utils';

/**
 * GET /api/user/me
 */
export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      tier: true,
      role: true,
      hasUnreadNotification: true,
      lastNotificationMessage: true,
      upgradeRequest: {
        select: { id: true, status: true, createdAt: true }
      }
    }
  });

  if (!user) throw new AppError('User not found', 404);

  ApiResponse.success(res, { user });
}

/**
 * POST /api/user/upgrade-request
 */
export async function requestUpgrade(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { upgradeRequest: true }
  });

  if (!user) throw new AppError('User not found', 404);

  if (user.tier === 'PRO') {
    throw new AppError('You are already subscribed to the PRO plan', 400);
  }

  if (user.upgradeRequest && user.upgradeRequest.status === 'PENDING') {
    throw new AppError('You already have a pending upgrade request under review', 400);
  }

  const upgradeRequest = await prisma.upgradeRequest.upsert({
    where: { userId },
    update: { status: 'PENDING' },
    create: { userId, status: 'PENDING' }
  });

  ApiResponse.success(
    res,
    { upgradeRequest },
    201,
    'Your request to upgrade to the PRO plan has been submitted for admin approval.'
  );
}

/**
 * GET /api/user/notifications
 */
export async function checkNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hasUnreadNotification: true,
      lastNotificationMessage: true,
      tier: true
    }
  });

  if (!user) throw new AppError('User not found', 404);

  if (user.hasUnreadNotification && user.lastNotificationMessage) {
    const message = user.lastNotificationMessage;

    // Clear notification flag and message immediately upon retrieval
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasUnreadNotification: false,
        lastNotificationMessage: null
      }
    });

    ApiResponse.success(res, {
      hasNotification: true,
      message,
      tier: user.tier
    });
  } else {
    ApiResponse.success(res, {
      hasNotification: false,
      message: null,
      tier: user.tier
    });
  }
}

/**
 * POST /api/user/email/send-otp
 */
export async function sendEmailUpdateOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { newEmail } = req.body;
  if (!isValidEmail(newEmail)) {
    throw new AppError('Valid new email address is required', 400);
  }

  const normalizedEmail = newEmail.trim().toLowerCase();

  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!currentUser) throw new AppError('User not found', 404);

  if (currentUser.email === normalizedEmail) {
    throw new AppError('New email must be different from current email', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw new AppError('Email is already in use by another account', 400);
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await OtpVerification.deleteMany({ email: normalizedEmail, purpose: 'UPDATE_EMAIL' });

  await OtpVerification.create({
    email: normalizedEmail,
    otp: hashedOtp,
    purpose: 'UPDATE_EMAIL',
    createdAt: new Date()
  });

  await sendOtpEmail(normalizedEmail, otp);

  ApiResponse.success(res, null, 200, 'Verification code sent to your new email address');
}

/**
 * PATCH /api/user/email
 */
export async function updateEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { currentPassword, newEmail, otp } = req.body;
  if (!currentPassword || !newEmail || !otp) {
    throw new AppError('currentPassword, newEmail, and otp are required', 400);
  }

  const normalizedEmail = String(newEmail).trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  if (user.passwordHash) {
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) throw new AppError('Incorrect current password', 401);
  }

  const otpRecord = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose: 'UPDATE_EMAIL'
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError('Verification code expired or not requested. Please request a new code.', 400);
  }

  const isOtpValid = await bcrypt.compare(String(otp).trim(), otpRecord.otp);
  if (!isOtpValid) throw new AppError('Invalid verification code', 400);

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser && existingUser.id !== userId) {
    throw new AppError('Email is already in use', 400);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { email: normalizedEmail },
    select: { id: true, email: true, tier: true, role: true }
  });

  await OtpVerification.deleteMany({ email: normalizedEmail, purpose: 'UPDATE_EMAIL' });

  ApiResponse.success(res, { user: updatedUser }, 200, 'Email updated successfully');
}

/**
 * PATCH /api/user/password
 */
export async function updatePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { currentPassword, newPassword } = req.body;
  if (!newPassword) {
    throw new AppError('New password is required', 400);
  }

  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    throw new AppError(validation.error || 'Password does not meet complexity requirements', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  if (user.passwordHash) {
    if (!currentPassword) {
      throw new AppError('Current password is required to change password', 400);
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError('Incorrect current password', 401);
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash }
  });

  ApiResponse.success(res, null, 200, 'Password updated successfully');
}

/**
 * DELETE /api/user/account
 */
export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Unauthorized', 401);

  const { currentPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  if (user.passwordHash) {
    if (!currentPassword) {
      throw new AppError('Current password is required to delete account', 400);
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError('Incorrect current password', 401);
  }

  await checkLastAdmin(userId);

  await prisma.$transaction([
    prisma.proxyEndpoint.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } })
  ]);

  ApiResponse.success(res, null, 200, 'Account deleted successfully');
}

