export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

export function validateInputText(text: string): ValidationResult {
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      error: 'Please enter text or upload a file (PDF, TXT, Code, or Image) to summarize.',
    };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean).length;

  if (words === 0) {
    return {
      isValid: false,
      error: 'Please enter valid text to summarize.',
    };
  }

  if (clean.length > 3_000_000) {
    return {
      isValid: false,
      error: 'Input text exceeds 3,000,000 characters. Please process in smaller document sections.',
    };
  }

  if (words > 100_000) {
    return {
      isValid: true,
      warning: 'Document is exceptionally large (100k+ words). Processing may take several minutes in local mode.',
    };
  }

  return { isValid: true };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
