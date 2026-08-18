/**
 * Password validation rules:
 * - Minimum 6 characters long
 * - Must contain at least one alphabet (a-z, A-Z)
 * - Must contain at least one number (0-9)
 * - Must contain at least one special character
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one alphabet letter (a-z, A-Z)' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number (0-9)' };
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character (e.g. !@#$%^&*)' };
  }

  return { isValid: true };
}
