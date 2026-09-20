import { useState, useEffect, useCallback } from 'react';
import { User } from '../types/auth';
import {
  getCurrentUser,
  initiateRegistration,
  verifyAndRegisterUser,
  resendVerificationCode,
  sendForgotPasswordCode,
  verifyResetCode,
  completePasswordReset,
  loginUser,
  logoutUser,
  updateProfile,
  getGuestUsageCount,
  incrementGuestUsage,
  isGuestLimitReached,
  resetGuestUsage,
  GUEST_USAGE_LIMIT,
} from '../services/authService';

export function useAuth() {
  const [currentUser, setCurrentUserState] = useState<User | null>(getCurrentUser);
  const [guestUsageCount, setGuestUsageCount] = useState<number>(getGuestUsageCount);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    const handleUsageChange = () => {
      setGuestUsageCount(getGuestUsageCount());
    };

    window.addEventListener('javeria-auth-changed', handleAuthChange);
    window.addEventListener('javeria-usage-changed', handleUsageChange);

    return () => {
      window.removeEventListener('javeria-auth-changed', handleAuthChange);
      window.removeEventListener('javeria-usage-changed', handleUsageChange);
    };
  }, []);

  const login = useCallback((email: string, pass: string) => {
    return loginUser(email, pass);
  }, []);

  const initiateRegister = useCallback((name: string, email: string, pass: string) => {
    return initiateRegistration(name, email, pass);
  }, []);

  const verifyCode = useCallback((email: string, code: string) => {
    return verifyAndRegisterUser(email, code);
  }, []);

  const resendCode = useCallback((email: string) => {
    return resendVerificationCode(email);
  }, []);

  const forgotPassword = useCallback((email: string) => {
    return sendForgotPasswordCode(email);
  }, []);

  const verifyResetOtp = useCallback((email: string, code: string) => {
    return verifyResetCode(email, code);
  }, []);

  const resetPassword = useCallback((email: string, code: string, newPass: string) => {
    return completePasswordReset(email, code, newPass);
  }, []);

  const logout = useCallback(() => {
    logoutUser();
  }, []);

  const editProfile = useCallback((updates: Partial<Pick<User, 'name' | 'plan' | 'avatarUrl'>>) => {
    return updateProfile(updates);
  }, []);

  const recordGuestUse = useCallback(() => {
    return incrementGuestUsage();
  }, []);

  const isLimitReached = !currentUser && guestUsageCount >= GUEST_USAGE_LIMIT;

  return {
    currentUser,
    isAuthenticated: !!currentUser,
    guestUsageCount,
    guestLimit: GUEST_USAGE_LIMIT,
    isGuestLimitReached: isLimitReached,
    recordGuestUse,
    login,
    initiateRegister,
    verifyCode,
    resendCode,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    logout,
    editProfile,
  };
}
