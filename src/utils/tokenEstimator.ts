export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Standard rule-of-thumb: ~4 characters per token in English text, or ~0.75 words per token
  const charBased = Math.ceil(text.length / 4);
  const words = text.trim().split(/\s+/).length;
  const wordBased = Math.ceil(words * 1.3);
  return Math.round((charBased + wordBased) / 2);
}

export interface TextSection {
  title?: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Protect common abbreviations from premature splitting
  const protectedText = text
    .replace(/\b(e\.g\.|i\.e\.|etc\.|vs\.|al\.|approx\.|fig\.|dr\.|prof\.|mr\.|mrs\.|ms\.)/gi, (m) =>
      m.replace(/\./g, '___DOT___')
    )
    .replace(/(\d+)\.(\d+)/g, '$1___DEC___$2'); // decimal numbers like 3.14

  // Match sentences ending in punctuation (. ! ?) followed by whitespace or end of string
  const sentenceRegex = /([^.!?\n]+[.!?]+(?:["'”’)]?)|[^.!?\n]+$)/g;
  const rawMatches = protectedText.match(sentenceRegex) || [protectedText];

  const sentences: string[] = [];
  for (const raw of rawMatches) {
    const restored = raw
      .replace(/___DOT___/g, '.')
      .replace(/___DEC___/g, '.')
      .trim();
    if (restored.length > 0) {
      sentences.push(restored);
    }
  }

  return sentences.length > 0 ? sentences : [text.trim()];
}

export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;

  // Markdown headers
  if (/^#{1,6}\s+.+/.test(trimmed)) return true;

  // Numbered sections: "1. Introduction" or "1.1 Background"
  if (/^\d+(\.\d+)*\s+[A-Z][\w\s-]{2,}/.test(trimmed)) return true;

  // Uppercase section headings: "SECTION 1: OVERVIEW"
  if (/^[A-Z0-9\s:_-]{4,}$/.test(trimmed) && trimmed.split(' ').length <= 8) return true;

  // Key-value or bullet headers like "Abstract:", "Conclusion:"
  if (/^[A-Z][A-Za-z0-9\s]{2,25}:$/.test(trimmed)) return true;

  return false;
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t\f\v ]+$/gm, '') // trim end of lines
    .replace(/[ \t]{2,}/g, ' ') // collapse multi-spaces on same line
    .replace(/\n{3,}/g, '\n\n'); // preserve paragraph breaks but avoid 4+ newlines
}
