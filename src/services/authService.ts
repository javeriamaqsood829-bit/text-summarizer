import { User, StoredUserAccount, PendingRegistration } from '../types/auth';

const USERS_STORAGE_KEY = 'javeria_auth_users';
const CURRENT_USER_KEY = 'javeria_active_user_session_v1';
const PENDING_REG_KEY = 'javeria_pending_reg';
const AUTH_INITIALIZED_KEY = 'javeria_auth_initialized';
const EVENT_AUTH_CHANGED = 'javeria-auth-changed';
const GUEST_USAGE_KEY = 'javeria_guest_usage_count';
const EVENT_USAGE_CHANGED = 'javeria-usage-changed';
const ACTIVE_USER_SESSION_KEY = 'javeria_active_user_session_v1';

// Automatically clean legacy auto-login keys on script load
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('javeria_current_user');
    window.localStorage.removeItem('javeria_manual_login');
    window.localStorage.removeItem('javeria_auth_clean_session_v7');
  }
} catch {}

export const GUEST_USAGE_LIMIT = 10;

/**
 * Get current count of summaries/conversions done as guest (without login)
 */
export function getGuestUsageCount(): number {
  try {
    const val = localStorage.getItem(GUEST_USAGE_KEY);
    if (!val) return 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : Math.max(0, num);
  } catch {
    return 0;
  }
}

/**
 * Increment guest usage by 1 and dispatch change event
 */
export function incrementGuestUsage(): number {
  try {
    const current = getGuestUsageCount();
    const next = current + 1;
    localStorage.setItem(GUEST_USAGE_KEY, String(next));
    window.dispatchEvent(new Event(EVENT_USAGE_CHANGED));
    return next;
  } catch {
    return 0;
  }
}

/**
 * Check if the 10 free guest operations limit has been reached
 */
export function isGuestLimitReached(): boolean {
  return getGuestUsageCount() >= GUEST_USAGE_LIMIT;
}

/**
 * Reset guest usage count
 */
export function resetGuestUsage(): void {
  try {
    localStorage.removeItem(GUEST_USAGE_KEY);
    window.dispatchEvent(new Event(EVENT_USAGE_CHANGED));
  } catch {}
}

export const OWNER_EMAIL = 'javeriamaqsood829@gmail.com';

/**
 * Check if the given user is the authenticated owner (Javeria)
 */
export function isOwner(user?: User | null): boolean {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

// Default initial user for Javeria Maqsood
const DEFAULT_USER: StoredUserAccount = {
  id: 'usr-javeria-01',
  name: 'Javeria Maqsood',
  email: OWNER_EMAIL,
  avatarUrl: '/javeria-official-avatar.jpg',
  plan: 'Free',
  isEmailVerified: true,
  createdAt: '2026-09-19T00:00:00.000Z',
  passwordHash: 'javeria123',
};

const MANUAL_LOGIN_KEY = 'javeria_manual_login';
const SESSION_RESET_KEY = 'javeria_auth_clean_session_v7';

// Initialize default users if empty
function initializeUsers(): StoredUserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      const initial = [DEFAULT_USER];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [DEFAULT_USER];
  }
}

export function getAllUsers(): StoredUserAccount[] {
  return initializeUsers();
}

export function getCurrentUser(): User | null {
  try {
    // Purge old legacy keys
    if (localStorage.getItem('javeria_current_user')) {
      localStorage.removeItem('javeria_current_user');
      localStorage.removeItem('javeria_manual_login');
    }

    const raw = localStorage.getItem(ACTIVE_USER_SESSION_KEY);
    if (!raw || raw === 'LOGGED_OUT' || raw === 'null') {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.email) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
    }
    localStorage.removeItem('javeria_current_user');
    localStorage.removeItem('javeria_manual_login');
    window.dispatchEvent(new Event(EVENT_AUTH_CHANGED));
  } catch (err) {
    console.error('Failed to set current user:', err);
  }
}

/**
 * Step 1: Initiate registration & send real 6-digit email verification code
 */
export async function initiateRegistration(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; delivered?: boolean; message?: string; previewCode?: string }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Please enter your full name (at least 2 characters).' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const users = getAllUsers();
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'An account with this email already exists. Please log in.' };
  }

  try {
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to send verification code.' };
    }

    // Save pending info locally without the code (security)
    const pending: PendingRegistration = {
      name: cleanName,
      email: cleanEmail,
      passwordHash: password,
      verificationCode: '',
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    localStorage.setItem(PENDING_REG_KEY, JSON.stringify(pending));

    return {
      success: true,
      delivered: data.delivered,
      previewCode: data.previewCode,
      message: data.message,
    };
  } catch (err: any) {
    console.error('Failed to send verification via server:', err);
    return { success: false, error: 'Network error connecting to verification server.' };
  }
}

/**
 * Step 2: Verify the 6-digit code received on email and complete account registration
 */
export async function verifyAndRegisterUser(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'Please enter the complete 6-digit verification code.' };
    }

    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Invalid verification code.' };
    }

    const rawPending = localStorage.getItem(PENDING_REG_KEY);
    const pending = rawPending ? JSON.parse(rawPending) : null;

    // Create verified user - only Javeria owns the signature photo
    const isNewUserOwner = isOwner({ email: cleanEmail } as User);
    const newUser: StoredUserAccount = {
      id: data.user?.id || `usr-${Date.now()}`,
      name: data.user?.name || pending?.name || 'User',
      email: cleanEmail,
      plan: 'Free',
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      passwordHash: pending?.passwordHash || '',
      avatarUrl: isNewUserOwner ? '/javeria-official-avatar.jpg' : undefined,
    };

    const users = getAllUsers();
    const existingIdx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (existingIdx >= 0) {
      users[existingIdx] = newUser;
    } else {
      users.push(newUser);
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    localStorage.removeItem(PENDING_REG_KEY);

    const { passwordHash: _, ...publicUser } = newUser;
    setCurrentUser(publicUser);

    return { success: true, user: publicUser };
  } catch (err) {
    console.error('Failed to verify user:', err);
    return { success: false, error: 'Verification failed. Please check network connection.' };
  }
}

/**
 * Resend verification code to user email
 */
export async function resendVerificationCode(
  email: string
): Promise<{ success: boolean; error?: string; message?: string; delivered?: boolean; previewCode?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch('/api/auth/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to resend code.' };
    }

    return {
      success: true,
      delivered: data.delivered,
      previewCode: data.previewCode,
      message: data.message || `A new code has been sent to ${cleanEmail}.`,
    };
  } catch (err) {
    return { success: false, error: 'Could not connect to verification server.' };
  }
}

/**
 * Step 1 for Forgot Password: Send 6-digit OTP to user's registered email
 */
export async function sendForgotPasswordCode(
  email: string
): Promise<{ success: boolean; error?: string; message?: string; previewCode?: string; delivered?: boolean }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter your registered email address.' };
    }

    const users = getAllUsers();
    const userExists = users.some((u) => u.email.toLowerCase() === cleanEmail);
    if (!userExists) {
      return {
        success: false,
        error: 'No account found with this email. Please check your email or Sign Up.',
      };
    }

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to send password reset code.' };
    }

    return {
      success: true,
      delivered: data.delivered,
      previewCode: data.previewCode,
      message: data.message || `Password reset code has been sent to ${cleanEmail}.`,
    };
  } catch (err: any) {
    console.error('Failed to send forgot password code:', err);
    return { success: false, error: 'Could not connect to authentication server.' };
  }
}

/**
 * Step 2 for Forgot Password: Verify the 6-digit OTP code received on email
 */
export async function verifyResetCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'Please enter the complete 6-digit security code.' };
    }

    const res = await fetch('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Invalid or expired code.' };
    }

    return { success: true, message: data.message };
  } catch (err) {
    return { success: false, error: 'Could not connect to verification server.' };
  }
}

/**
 * Step 3 for Forgot Password: Set new password, update local account and log in
 */
export async function completePasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; user?: User; message?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const res = await fetch('/api/auth/complete-reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode, newPassword }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to reset password.' };
    }

    // Update stored user's password
    const users = getAllUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (idx !== -1) {
      users[idx].passwordHash = newPassword;
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

      // Automatically log the user in with new credentials
      const { passwordHash: _, ...publicUser } = users[idx];
      setCurrentUser(publicUser);
      return { success: true, user: publicUser, message: 'Password updated and logged in successfully!' };
    }

    return { success: true, message: 'Password reset successfully. Please log in.' };
  } catch (err: any) {
    console.error('Failed to complete password reset:', err);
    return { success: false, error: 'Could not complete password reset.' };
  }
}

/**
 * Log in with Email and Password
 */
export function loginUser(
  email: string,
  password: string
): { success: boolean; error?: string; user?: User } {
  const cleanEmail = email.trim().toLowerCase();
  const users = getAllUsers();
  const found = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!found) {
    return { success: false, error: 'No account found with this email. Please check your email or Sign Up.' };
  }

  if (found.passwordHash !== password) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  const { passwordHash: _, ...publicUser } = found;
  setCurrentUser(publicUser);
  return { success: true, user: publicUser };
}

/**
 * Log out
 */
export function logoutUser(): void {
  setCurrentUser(null);
}

/**
 * Update current user profile (e.g. name or plan)
 * Only Javeria (Owner) is permitted to update avatarUrl
 */
export function updateProfile(updates: Partial<Pick<User, 'name' | 'plan' | 'avatarUrl'>>): User | null {
  const current = getCurrentUser();
  if (!current) return null;

  const sanitizedUpdates = { ...updates };
  if (sanitizedUpdates.avatarUrl !== undefined && !isOwner(current)) {
    console.warn('Blocked non-owner attempt to modify portrait photo.');
    delete sanitizedUpdates.avatarUrl;
  }

  const updated: User = { ...current, ...sanitizedUpdates };
  const users = getAllUsers();
  const index = users.findIndex((u) => u.id === current.id);
  if (index !== -1) {
    users[index] = { ...users[index], ...sanitizedUpdates };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  setCurrentUser(updated);
  return updated;
}
