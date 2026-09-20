export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  isEmailVerified: boolean;
  createdAt: string;
}

export interface StoredUserAccount extends User {
  passwordHash: string;
}

export interface PendingRegistration {
  name: string;
  email: string;
  passwordHash: string;
  verificationCode: string;
  expiresAt: number;
}
