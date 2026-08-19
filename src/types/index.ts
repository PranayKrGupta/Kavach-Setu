import { Request } from 'express';
import { Tier, Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthUser {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export type OtpPurpose = 'REGISTER' | 'UPDATE_EMAIL';

export interface FormattedUser {
  id: string;
  email: string;
  tier: Tier;
  role: Role;
  isBanned: boolean;
  createdAt: Date;
  endpointsCount: number;
}

export interface TierConfigCache {
  maxEndpoints: number;
  maxTierLimit: number;
  expiresAt: number;
}

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}
