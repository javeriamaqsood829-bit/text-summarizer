import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Copy,
  RefreshCw,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const {
    login,
    initiateRegister,
    verifyCode,
    resendCode,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    currentUser,
    isGuestLimitReached,
    guestLimit,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset-code' | 'new-password'>(
    initialMode
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Verification state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verifiedResetCode, setVerifiedResetCode] = useState('');
  const [showBackupCode, setShowBackupCode] = useState(false);

  // Errors & Loading
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const getStoredCode = (): string | null => {
    if (mode === 'verify') {
      try {
        const raw = localStorage.getItem('javeria_pending_registration');
        return raw ? JSON.parse(raw).verificationCode : null;
      } catch {
        return null;
      }
    }
    if (mode === 'reset-code') {
      try {
        const raw = localStorage.getItem('javeria_pending_reset');
        return raw ? JSON.parse(raw).code : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const fillStoredCode = () => {
    const c = getStoredCode();
    if (c && c.length === 6) {
      setOtpDigits(c.split(''));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccessMessage(null);
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setOtpDigits(['', '', '', '', '', '']);
      setVerifiedResetCode('');
      setShowBackupCode(false);
    }
  }, [isOpen, initialMode]);

  // Resend countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if ((mode === 'verify' || mode === 'reset-code') && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode, resendTimer]);

  if (!isOpen) return null;

  // Handle Login Submit
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = login(email, password);
      setIsLoading(false);
      if (res.success && res.user) {
        setSuccessMessage(`Welcome back, ${res.user.name}!`);
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setError(res.error || 'Failed to sign in.');
      }
    }, 300);
  };

  // Handle Register Submit -> Send Real Code to Email
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await initiateRegister(name, email, password);
      setIsLoading(false);
      if (res.success) {
        setMode('verify');
        setResendTimer(60);
        setCanResend(false);
        setOtpDigits(['', '', '', '', '', '']);
        setSuccessMessage(`Verification code sent to ${email}. Please check your email inbox and enter the 6 digits.`);
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      } else {
        setError(res.error || 'Registration failed. Please check your email.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError('Failed to connect to email verification server.');
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, val: string) => {
    // Only accept numbers
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanVal;
    setOtpDigits(nextDigits);

    // Auto-advance to next input
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace in OTP
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle pasting full 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      nextDigits[i] = pasted[i];
    }
    setOtpDigits(nextDigits);

    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  // Verify Code Submit
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otpDigits.join('');
    if (enteredCode.length < 6) {
      setError('Please enter the complete 6-digit verification code sent to your email.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await verifyCode(email, enteredCode);
      setIsLoading(false);
      if (res.success && res.user) {
        setSuccessMessage(`Account verified! Welcome to Javeria, ${res.user.name}.`);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setError(res.error || 'Invalid verification code. Please check your email inbox.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError('Verification service unavailable. Please retry.');
    }
  };

  // Step 1: Send Password Reset Code to Email
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await forgotPassword(email);
      setIsLoading(false);
      if (res.success) {
        setMode('reset-code');
        setResendTimer(60);
        setCanResend(false);
        setSuccessMessage(`A 6-digit security code has been sent to ${email}. Please check your inbox and enter it below.`);
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      } else {
        setError(res.error || 'Failed to send password reset code.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Unable to reach server. Please check your connection.');
    }
  };

  // Step 2: Verify Reset Code
  const handleVerifyResetCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otpDigits.join('');
    if (enteredCode.length < 6) {
      setError('Please enter the complete 6-digit code received on your email.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await verifyResetOtp(email, enteredCode);
      setIsLoading(false);
      if (res.success) {
        setVerifiedResetCode(enteredCode);
        setSuccessMessage('Code verified! Please choose your new password.');
        setMode('new-password');
      } else {
        setError(res.error || 'Invalid or expired code. Please check your email inbox.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Could not verify code. Please try again.');
    }
  };

  // Step 3: Complete Password Reset with New Password
  const handleCompleteResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(email, verifiedResetCode, newPassword);
      setIsLoading(false);
      if (res.success) {
        setSuccessMessage('Password reset successfully! You are now logged in with your new password.');
        setPassword(newPassword);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to set new password.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Failed to update password. Please retry.');
    }
  };

  // Resend code to user email
  const handleResend = async () => {
    if (!canResend) return;
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'reset-code') {
        const res = await forgotPassword(email);
        setIsLoading(false);
        if (res.success) {
          setResendTimer(60);
          setCanResend(false);
          setOtpDigits(['', '', '', '', '', '']);
          setSuccessMessage(`New reset code sent to ${email}. Please check your inbox.`);
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          setError(res.error || 'Failed to resend reset code.');
        }
      } else {
        const res = await resendCode(email);
        setIsLoading(false);
        if (res.success) {
          setResendTimer(60);
          setCanResend(false);
          setOtpDigits(['', '', '', '', '', '']);
          setSuccessMessage(`New verification code sent to ${email}. Please check your inbox.`);
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          setError(res.error || 'Failed to resend code.');
        }
      }
    } catch (err) {
      setIsLoading(false);
      setError('Failed to resend code.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#11141d] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <span>J</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {mode === 'login' && 'Sign In to Javeria'}
                {mode === 'register' && 'Create Your Account'}
                {mode === 'verify' && 'Verify Your Email'}
                {mode === 'forgot' && 'Reset Password'}
                {mode === 'reset-code' && 'Enter Reset Code'}
                {mode === 'new-password' && 'Create New Password'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login' && 'Enter your registered email & password'}
                {mode === 'register' && 'Register with email & code verification'}
                {mode === 'verify' && `Verification code sent to ${email}`}
                {mode === 'forgot' && 'We will send a 6-digit recovery code to your email'}
                {mode === 'reset-code' && `6-digit reset code sent to ${email}`}
                {mode === 'new-password' && 'Enter your new password to sign in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guest Limit Notice if triggered by 10 free uses */}
        {isGuestLimitReached && !currentUser && (mode === 'login' || mode === 'register') && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>10 Free Uses Completed:</strong> Please Sign In or Register to continue summarizing and converting documents.
            </span>
          </div>
        )}

        {/* Tab switch if in main Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 p-1.5 mx-6 mt-4 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account (Sign Up)
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Register with Email
                </button>
              </div>
            </form>
          )}

          {/* MODE: REGISTER (SIGN UP) */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (will appear on profile)
                </label>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Your Full Name"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (code will be sent here)
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@example.com"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Create Password (min 6 characters)
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isLoading ? 'Sending verification code...' : 'Continue & Send Code'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE: VERIFY EMAIL OTP (6 Digits) */}
          {mode === 'verify' && (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              {/* Real Email Delivery Notification Banner */}
              <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                      Verification Code Sent to Email
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sent to <strong className="text-blue-600 dark:text-blue-400 font-medium">{email}</strong>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-blue-100 dark:border-blue-900/40 pt-2">
                  Please open your email inbox to find your <strong>6-digit security code</strong> from <strong>Javeria</strong>, then enter it below to activate your account.
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg leading-tight">
                  💡 <strong>Tip:</strong> If not visible in Inbox, please check your <strong>Spam or Junk</strong> folder and mark as <strong>&apos;Report Not Spam&apos;</strong> to ensure all future emails reach your Inbox directly.
                </p>
              </div>

              {/* 6 OTP Input Boxes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <div
                  className="flex items-center justify-center gap-2 sm:gap-2.5"
                  onPaste={handleOtpPaste}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-10 h-12 text-center font-mono text-base font-bold rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  ))}
                </div>
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length < 6}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Complete Registration'}
                <ShieldCheck className="w-4 h-4" />
              </button>

              {/* Resend & Back controls */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white underline"
                >
                  Change Email / Details
                </button>

                <button
                  type="button"
                  disabled={!canResend}
                  onClick={handleResend}
                  className={`flex items-center gap-1 font-medium ${
                    canResend
                      ? 'text-blue-600 dark:text-blue-400 hover:underline'
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
                </button>
              </div>

              {/* Discreet Backup Code Section for Quick Verification */}
              <div className="pt-2 text-center border-t border-slate-100 dark:border-white/5">
                {!showBackupCode ? (
                  <button
                    type="button"
                    onClick={() => setShowBackupCode(true)}
                    className="text-[11px] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    Didn&apos;t get email or email delayed? Click to view backup code
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-xs flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">
                      Backup Code: <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold text-sm tracking-widest">{getStoredCode()}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={fillStoredCode}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Fill Code
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* MODE 4: FORGOT PASSWORD - STEP 1: ENTER EMAIL */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                  <KeyRound className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Forgot Password Recovery</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-indigo-100 dark:border-indigo-900/40 pt-2">
                  Enter your registered account email. We will send a <strong>6-digit security code</strong> to your inbox so you can choose a new password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Registered Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Sending recovery code...' : 'Send Security Code to Email'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE 5: FORGOT PASSWORD - STEP 2: VERIFY RESET CODE */}
          {mode === 'reset-code' && (
            <form onSubmit={handleVerifyResetCodeSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-900 dark:text-purple-200">
                  <Mail className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Reset Code Dispatched</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-purple-100 dark:border-purple-900/40 pt-2">
                  We sent a 6-digit security code to <strong>{email}</strong>. Check your inbox and enter it below:
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg leading-tight">
                  💡 <strong>Tip:</strong> If not visible in Inbox, please check your <strong>Spam or Junk</strong> folder and click <strong>&apos;Report Not Spam&apos;</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 text-center mb-2.5">
                  Enter 6-Digit Password Reset Code
                </label>
                <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-10 h-12 text-center font-mono text-base font-bold rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length < 6}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Verifying Code...' : 'Verify Code & Set New Password'}
                <ShieldCheck className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  disabled={!canResend}
                  onClick={handleResend}
                  className={`flex items-center gap-1 font-medium ${
                    canResend
                      ? 'text-purple-600 dark:text-purple-400 hover:underline cursor-pointer'
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
                </button>
              </div>

              {/* Discreet Backup Code Section for Quick Reset */}
              <div className="pt-2 text-center border-t border-slate-100 dark:border-white/5">
                {!showBackupCode ? (
                  <button
                    type="button"
                    onClick={() => setShowBackupCode(true)}
                    className="text-[11px] text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    Didn&apos;t get email or email delayed? Click to view backup code
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 text-xs flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">
                      Backup Code: <strong className="font-mono text-purple-600 dark:text-purple-400 font-bold text-sm tracking-widest">{getStoredCode()}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={fillStoredCode}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Fill Code
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* MODE 6: FORGOT PASSWORD - STEP 3: CREATE NEW PASSWORD */}
          {mode === 'new-password' && (
            <form onSubmit={handleCompleteResetSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Identity Confirmed!</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-emerald-100 dark:border-emerald-900/40 pt-2">
                  Enter your new password below. Next time you sign in, you will use this password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  New Password (min. 6 characters)
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !newPassword || !confirmNewPassword}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Updating Password...' : 'Save New Password & Sign In'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
