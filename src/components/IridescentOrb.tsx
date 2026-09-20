import React, { useState, useEffect, useRef } from 'react';
import { Camera, Lock, RotateCcw, Check, ShieldCheck } from 'lucide-react';
import {
  getStoredAvatar,
  setStoredAvatar,
  resetStoredAvatar,
  syncAvatarWithServer,
  DEFAULT_AVATAR,
} from '../utils/avatarStore';
import { useAuth } from '../hooks/useAuth';
import { isOwner } from '../services/authService';

interface IridescentOrbProps {
  size?: number;
  className?: string;
  allowUpload?: boolean;
}

export const IridescentOrb: React.FC<IridescentOrbProps> = ({
  size = 136,
  className = '',
  allowUpload = true,
}) => {
  const { currentUser, editProfile } = useAuth();
  const [avatarSrc, setAvatarSrc] = useState<string>(getStoredAvatar());
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'locked' | 'success'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Strictly check if currently authenticated user is Javeria
  const isOwnerUser = Boolean(currentUser && isOwner(currentUser));

  useEffect(() => {
    // Initial fetch from server to get globally synced owner portrait
    syncAvatarWithServer();

    const handleAvatarChange = () => {
      setAvatarSrc(getStoredAvatar());
      setImgError(false);
    };
    window.addEventListener('javeria-avatar-changed', handleAvatarChange);
    return () => window.removeEventListener('javeria-avatar-changed', handleAvatarChange);
  }, []);

  const handleFileSelect = (file: File) => {
    if (!isOwnerUser) {
      showLockedNotice();
      return;
    }

    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setStoredAvatar(dataUrl, currentUser?.email);
        editProfile({ avatarUrl: dataUrl });
        setFeedbackNotice({
          type: 'success',
          message: '✓ Portrait updated successfully by Javeria',
        });
        setTimeout(() => setFeedbackNotice(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwnerUser) {
      showLockedNotice();
      return;
    }
    resetStoredAvatar(currentUser?.email);
    editProfile({ avatarUrl: DEFAULT_AVATAR });
    setFeedbackNotice({
      type: 'success',
      message: '✓ Reset to original portrait photo',
    });
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const showLockedNotice = () => {
    setFeedbackNotice({
      type: 'locked',
      message: '🔒 Protected: Sirf Javeria (Owner) is picture ko change kar sakti hain.',
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isOwnerUser) {
      showLockedNotice();
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAvatarClick = () => {
    if (isOwnerUser) {
      fileInputRef.current?.click();
    } else {
      showLockedNotice();
    }
  };

  const isCustomized = avatarSrc !== DEFAULT_AVATAR;

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Locked / Success Feedback Toast */}
      {feedbackNotice && (
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl text-[11px] font-medium shadow-lg z-50 whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none flex items-center gap-1.5 ${
            feedbackNotice.type === 'locked'
              ? 'bg-rose-950/90 text-rose-200 border border-rose-800/80 backdrop-blur-md'
              : 'bg-emerald-950/90 text-emerald-200 border border-emerald-800/80 backdrop-blur-md'
          }`}
        >
          {feedbackNotice.type === 'locked' ? (
            <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          ) : (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span>{feedbackNotice.message}</span>
        </div>
      )}

      {/* Hidden file input for uploading exact personal image (Only accessible to Javeria) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        disabled={!isOwnerUser}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* Ambient backdrop glow matching soft lavender/purple indoor bokeh */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-50 dark:opacity-70 pointer-events-none transition-opacity"
        style={{
          background:
            'radial-gradient(circle, rgba(168,85,247,0.5) 0%, rgba(99,102,241,0.4) 45%, rgba(236,72,153,0.2) 80%, transparent 100%)',
          transform: 'scale(1.45)',
        }}
      />

      {/* Exact Portrait Container */}
      <div className="relative z-10 w-full h-full rounded-full p-1 bg-gradient-to-tr from-purple-500/50 via-indigo-500/40 to-blue-500/50 shadow-2xl">
        <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-purple-400/40 dark:ring-purple-400/30 bg-[#0c0e14] relative group">
          {!imgError ? (
            <img
              src={avatarSrc}
              alt="Javeria"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            /* High-fidelity fallback */
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white">
              <span className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                J
              </span>
            </div>
          )}

          {/* Hover Overlay: Strict Permission Logic */}
          {allowUpload && (
            <div
              onClick={handleAvatarClick}
              className={`absolute inset-0 backdrop-blur-xs flex flex-col items-center justify-center transition-opacity duration-200 cursor-pointer ${
                isOwnerUser ? 'bg-black/60 text-white' : 'bg-slate-950/70 text-slate-200'
              } ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              {isOwnerUser ? (
                <>
                  <Camera className="w-5 h-5 mb-1 text-white" />
                  <span className="text-[10px] font-semibold tracking-tight px-2 text-center text-slate-100">
                    Change Photo
                  </span>
                  <span className="text-[9px] text-purple-300">
                    Javeria (Owner)
                  </span>
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20 hover:bg-white/30 text-[9px] text-slate-200"
                      title="Reset to default original portrait"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="p-2 text-center flex flex-col items-center justify-center">
                  <Lock className="w-4 h-4 mb-1 text-purple-400" />
                  <span className="text-[10px] font-bold text-white tracking-wide">
                    Protected Portrait
                  </span>
                  <span className="text-[8px] text-slate-300 leading-tight mt-0.5 max-w-[95px]">
                    Only Javeria can modify
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Online AI Pulse Indicator Badge */}
        <div
          className="absolute bottom-1 right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0c0e14] shadow-md"
          title="Javeria Online & Ready"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export const AssistantAvatar = IridescentOrb;

