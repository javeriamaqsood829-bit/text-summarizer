import { User, StoredUserAccount, PendingRegistration } from '../types/auth';

const USERS_STORAGE_KEY = 'javeria_auth_users';
const CURRENT_USER_KEY = 'javeria_current_user';
const PENDING_REG_KEY = 'javeria_pending_reg';
const AUTH_INITIALIZED_KEY = 'javeria_auth_initialized';
const EVENT_AUTH_CHANGED = 'javeria-auth-changed';

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
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    
    // Explicitly signed out by the user
    if (raw === 'LOGGED_OUT' || raw === 'null') {
      return null;
    }

    // Has active user in storage
    if (raw) {
      return JSON.parse(raw);
    }

    // If never initialized before, initialize with default user once
    const alreadyInitialized = localStorage.getItem(AUTH_INITIALIZED_KEY);
    if (alreadyInitialized) {
      return null;
    }

    // First session bootstrap
    localStorage.setItem(AUTH_INITIALIZED_KEY, 'true');
    const initialUsers = initializeUsers();
    const defaultUser = initialUsers[0] || DEFAULT_USER;
    const { passwordHash: _, ...publicUser } = defaultUser;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(publicUser));
    return publicUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      // Explicitly mark as logged out so it is not re-seeded
      localStorage.setItem(CURRENT_USER_KEY, 'LOGGED_OUT');
    }
    window.dispatchEvent(new Event(EVENT_AUTH_CHANGED));
  } catch (err) {
    console.error('Failed to set current user:', err);
  }
}

/**
 * Step 1: Initiate registration & generate 6-digit email verification code
 */
export function initiateRegistration(
  name: string,
  email: string,
  password: string
): { success: boolean; error?: string; code?: string } {
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

  // Generate real 6-digit verification code
  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  const pending: PendingRegistration = {
    name: cleanName,
    email: cleanEmail,
    passwordHash: password,
    verificationCode,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  try {
    localStorage.setItem(PENDING_REG_KEY, JSON.stringify(pending));
  } catch (err) {
    console.error('Failed to save pending registration:', err);
  }

  return { success: true, code: verificationCode };
}

/**
 * Step 2: Verify the 6-digit code and complete account registration
 */
export function verifyAndRegisterUser(
  email: string,
  code: string
): { success: boolean; error?: string; user?: User } {
  try {
    const raw = localStorage.getItem(PENDING_REG_KEY);
    if (!raw) {
      return { success: false, error: 'No pending registration found. Please register again.' };
    }

    const pending: PendingRegistration = JSON.parse(raw);
    if (pending.email.toLowerCase() !== email.trim().toLowerCase()) {
      return { success: false, error: 'Email mismatch. Please register again.' };
    }

    if (Date.now() > pending.expiresAt) {
      return { success: false, error: 'Verification code has expired. Please click "Resend Code".' };
    }

    if (pending.verificationCode.trim() !== code.trim()) {
      return { success: false, error: 'Invalid verification code. Please check your email code and try again.' };
    }

    // Create verified user - only Javeria owns the signature photo
    const isNewUserOwner = isOwner({ email: pending.email } as User);
    const newUser: StoredUserAccount = {
      id: `usr-${Date.now()}`,
      name: pending.name,
      email: pending.email,
      plan: 'Free',
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      passwordHash: pending.passwordHash,
      avatarUrl: isNewUserOwner ? '/javeria-official-avatar.jpg' : undefined,
    };

    const users = getAllUsers();
    users.push(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    localStorage.removeItem(PENDING_REG_KEY);

    const { passwordHash: _, ...publicUser } = newUser;
    setCurrentUser(publicUser);

    return { success: true, user: publicUser };
  } catch (err) {
    console.error('Failed to verify user:', err);
    return { success: false, error: 'An unexpected error occurred during verification.' };
  }
}

/**
 * Resend verification code
 */
export function resendVerificationCode(email: string): { success: boolean; error?: string; code?: string } {
  try {
    const raw = localStorage.getItem(PENDING_REG_KEY);
    if (!raw) {
      return { success: false, error: 'No pending registration found.' };
    }
    const pending: PendingRegistration = JSON.parse(raw);
    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    pending.verificationCode = newCode;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;
    localStorage.setItem(PENDING_REG_KEY, JSON.stringify(pending));

    return { success: true, code: newCode };
  } catch (err) {
    return { success: false, error: 'Failed to resend code.' };
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
