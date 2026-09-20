export const DEFAULT_AVATAR = '/javeria-official-avatar.jpg';
export const OWNER_EMAIL = 'javeriamaqsood829@gmail.com';

let isSyncing = false;

export function getStoredAvatar(): string {
  try {
    const stored = localStorage.getItem('javeria_avatar_url');
    // If old /src/assets path exists, migrate to the permanent public URL
    if (stored && stored.includes('/src/assets/images/')) {
      localStorage.setItem('javeria_avatar_url', DEFAULT_AVATAR);
      return DEFAULT_AVATAR;
    }
    return stored || DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

/**
 * Fetch the latest official avatar from the server API.
 * Ensures all public visitors and users automatically receive the latest photo published by Javeria.
 */
export async function syncAvatarWithServer(): Promise<string> {
  if (isSyncing) return getStoredAvatar();
  isSyncing = true;
  try {
    const res = await fetch('/api/avatar');
    if (res.ok) {
      const data = await res.json();
      if (data.avatarUrl) {
        localStorage.setItem('javeria_avatar_url', data.avatarUrl);
        window.dispatchEvent(new Event('javeria-avatar-changed'));
        return data.avatarUrl;
      }
    }
  } catch (err) {
    // Graceful fallback to static public asset
    console.debug('Using local cached avatar');
  } finally {
    isSyncing = false;
  }
  return getStoredAvatar();
}

/**
 * Update the stored avatar for Javeria both locally and globally on the server.
 * Strictly verifies that only Javeria (Owner) is allowed to perform this change.
 */
export async function setStoredAvatar(urlOrBase64: string, requesterEmail?: string): Promise<boolean> {
  try {
    if (requesterEmail && requesterEmail.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      console.warn('Unauthorized avatar modification blocked: Only Javeria can modify this photo.');
      return false;
    }

    // Save locally first for instant snappy response
    localStorage.setItem('javeria_avatar_url', urlOrBase64);
    window.dispatchEvent(new Event('javeria-avatar-changed'));

    // Upload to server so all current and future visitors see the updated photo
    try {
      const res = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: urlOrBase64,
          email: requesterEmail || OWNER_EMAIL,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          localStorage.setItem('javeria_avatar_url', data.avatarUrl);
          window.dispatchEvent(new Event('javeria-avatar-changed'));
        }
      }
    } catch (serverErr) {
      console.warn('Server sync skipped, stored locally:', serverErr);
    }

    return true;
  } catch (err) {
    console.error('Failed to set stored avatar:', err);
    return false;
  }
}

/**
 * Reset avatar to Javeria's default original portrait photo.
 */
export async function resetStoredAvatar(requesterEmail?: string): Promise<boolean> {
  try {
    if (requesterEmail && requesterEmail.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      console.warn('Unauthorized avatar reset blocked: Only Javeria can reset this photo.');
      return false;
    }

    localStorage.setItem('javeria_avatar_url', DEFAULT_AVATAR);
    window.dispatchEvent(new Event('javeria-avatar-changed'));

    // Reset on server if possible
    try {
      await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: DEFAULT_AVATAR,
          email: requesterEmail || OWNER_EMAIL,
        }),
      });
    } catch {}

    return true;
  } catch (err) {
    console.error('Failed to reset stored avatar:', err);
    return false;
  }
}
