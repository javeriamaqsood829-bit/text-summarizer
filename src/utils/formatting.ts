export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

export function generateSmartTitle(text: string): string {
  if (!text || text.trim().length === 0) return 'New Summary';

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return 'New Summary';

  // Check if first line looks like a title or heading
  const firstLine = lines[0].replace(/^#+\s*/, '').trim();
  if (firstLine.length >= 5 && firstLine.length <= 60 && !/[.!?]$/.test(firstLine)) {
    return firstLine.replace(/[:\-–—].*$/, '').trim();
  }

  // Extract from first sentence
  const firstSentence = lines.slice(0, 3).join(' ');
  const match = firstSentence.match(/^([^.!?\n]{10,60})/);
  if (match) {
    let candidate = match[1].trim();
    // Clean trailing filler words
    candidate = candidate.replace(/\s+(and|or|the|a|in|of|for|with|by|to)$/i, '');
    return candidate.length > 40 ? candidate.slice(0, 40) + '...' : candidate;
  }

  return 'Document Summary';
}

export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 50);
}
