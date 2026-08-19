import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  PORT: number;
  DATABASE_URL: string;
  DIRECT_URL?: string;
  MONGO_URI: string;
  JWT_SECRET: string;
  EMAILJS_SERVICE_ID?: string;
  EMAILJS_TEMPLATE_ID?: string;
  EMAILJS_PUBLIC_KEY?: string;
  EMAILJS_PRIVATE_KEY?: string;
}

export const env: EnvConfig = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/kavach-setu',
  JWT_SECRET: process.env.JWT_SECRET || 'secret',
  EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID,
  EMAILJS_PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN
};

export function validateEnv(): void {
  const missingKeys: string[] = [];

  if (!env.DATABASE_URL) missingKeys.push('DATABASE_URL');
  if (!env.MONGO_URI) missingKeys.push('MONGO_URI');
  if (!env.JWT_SECRET || env.JWT_SECRET === 'secret') {
    if (process.env.NODE_ENV === 'production') {
      missingKeys.push('JWT_SECRET');
    }
  }

  if (missingKeys.length > 0) {
    console.warn(`[Config Warning] Missing recommended environment variables: ${missingKeys.join(', ')}`);
  }
}
