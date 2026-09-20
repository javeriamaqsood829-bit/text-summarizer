import { useState, useEffect, useCallback } from 'react';
import { User } from '../types/auth';
import {
  getCurrentUser,
  initiateRegistration,
  verifyAndRegisterUser,
  resendVerificationCode,
  loginUser,
  logoutUser,
  updateProfile,
} from '../services/authService';

export function useAuth() {
  const [currentUser, setCurrentUserState] = useState<User | null>(getCurrentUser);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    window.addEventListener('javeria-auth-changed', handleAuthChange);
    return () => window.removeEventListener('javeria-auth-changed', handleAuthChange);
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

  const logout = useCallback(() => {
    logoutUser();
  }, []);

  const editProfile = useCallback((updates: Partial<Pick<User, 'name' | 'plan' | 'avatarUrl'>>) => {
    return updateProfile(updates);
  }, []);

  return {
    currentUser,
    isAuthenticated: !!currentUser,
    login,
    initiateRegister,
    verifyCode,
    resendCode,
    logout,
    editProfile,
  };
}
