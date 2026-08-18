import { env } from '../config/env';
import { AppError } from '../utils/appError';

const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

export interface SendOtpEmailParams {
  to_email: string;
  otp_code: string;
}

/**
 * Sends a 6-digit OTP verification email securely via EmailJS REST API.
 * @param to_email Recipient email address
 * @param otp_code The 6-digit plain OTP code
 */
export async function sendOtpEmail(to_email: string, otp_code: string): Promise<void> {
  const {
    EMAILJS_SERVICE_ID: serviceId,
    EMAILJS_TEMPLATE_ID: templateId,
    EMAILJS_PUBLIC_KEY: userId,
    EMAILJS_PRIVATE_KEY: accessToken
  } = env;

  if (!serviceId || !templateId || !userId || !accessToken) {
    const missingKeys: string[] = [];
    if (!serviceId) missingKeys.push('EMAILJS_SERVICE_ID');
    if (!templateId) missingKeys.push('EMAILJS_TEMPLATE_ID');
    if (!userId) missingKeys.push('EMAILJS_PUBLIC_KEY');
    if (!accessToken) missingKeys.push('EMAILJS_PRIVATE_KEY');

    throw new AppError(`Email service misconfigured: missing ${missingKeys.join(', ')}`, 500);
  }

  const expiryDate = new Date(Date.now() + 10 * 60 * 1000);
  const formattedTime = expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    accessToken: accessToken,
    template_params: {
      to_email: to_email,
      otp_code: otp_code,
      passcode: otp_code,
      time: formattedTime,
      message: `Your verification code is ${otp_code}. This code is valid for 10 minutes till ${formattedTime}.`
    }
  };

  try {
    const response = await fetch(EMAILJS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kavach-Setu-Backend'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(`Email delivery failed (HTTP ${response.status}): ${errorText || response.statusText}`, 502);
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown email dispatch error';
    throw new AppError(`Failed to send verification email: ${message}`, 502);
  }
}
