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

export function cleanDocumentArtifacts(text: string): string {
  if (!text) return '';
  return text
    .replace(/^\[(?:Image|Visual|PDF|Code|Text|Document)\s+Document:[^\]\n]+\]/gim, '')
    .replace(/^---+\s*(?:Page\s*\d+|Document:[^-\n]+)\s*---+/gim, '')
    .replace(/^•\s*(?:File Format|Resolution|Orientation|Visual Content Analysis|Summary Directive):[^\n]*/gim, '')
    .trim();
}

export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Strip technical headers and metadata
  const sanitized = cleanDocumentArtifacts(text);

  // Normalize paragraphs and soft line breaks from OCR / PDFs
  const paragraphs = sanitized.split(/\n\s*\n+/);
  const unwrappedParagraphs: string[] = [];

  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      if (lines.length === 1) unwrappedParagraphs.push(lines[0]);
      continue;
    }

    // If paragraph contains lists or headers or code, keep separate lines
    const isListOrStructured = lines.some((l) => /^([*•\-–—+]|\d+[.)]|#{1,6}\s|[A-Z][\w\s]{1,30}:)/.test(l));
    if (isListOrStructured) {
      unwrappedParagraphs.push(lines.join('\n'));
      continue;
    }

    // Check if line 1 is a standalone title/heading
    let startIdx = 0;
    let headingPart = '';
    const firstLine = lines[0];
    if (lines.length >= 2 && firstLine.length <= 60 && !/[.!?]$/.test(firstLine)) {
      headingPart = firstLine;
      startIdx = 1;
    }

    let body = '';
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!body) {
        body = line;
      } else if (body.endsWith('-')) {
        body = body.slice(0, -1) + line;
      } else {
        body += ' ' + line;
      }
    }

    if (headingPart) {
      unwrappedParagraphs.push(headingPart);
    }
    if (body) {
      unwrappedParagraphs.push(body);
    }
  }

  const normalizedText = unwrappedParagraphs.join('\n\n');

  // Protect common abbreviations from premature splitting
  const protectedText = normalizedText
    .replace(/\b(e\.g\.|i\.e\.|etc\.|vs\.|al\.|approx\.|fig\.|dr\.|prof\.|mr\.|mrs\.|ms\.)/gi, (m) =>
      m.replace(/\./g, '___DOT___')
    )
    .replace(/(\d+)\.(\d+)/g, '$1___DEC___$2'); // decimal numbers like 3.14

  // Match sentences ending in punctuation (. ! ?) followed by whitespace or bullet/paragraph break
  const rawParts = protectedText
    .split(/(?<=[.!?]["'”’)]?)\s+(?=[A-Z0-9"“'‘(])|\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const part of rawParts) {
    const subLines = part.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (const sub of subLines) {
      const restored = sub
        .replace(/___DOT___/g, '.')
        .replace(/___DEC___/g, '.')
        .replace(/^["'“”‘]\s*(and|or|to|for|with|of|in|that|this)\b/gim, '$1') // clean stray leading quote
        .trim();

      // Skip isolated noise or empty strings
      if (restored.length > 5 && !/^[[\]{}()~`^|—_=+]{1,4}$/.test(restored)) {
        sentences.push(restored);
      }
    }
  }

  return sentences.length > 0 ? sentences : [sanitized || text.trim()];
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
