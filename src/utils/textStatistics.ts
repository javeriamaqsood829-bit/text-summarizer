import { TextStatistics } from '../types';

export function calculateTextStatistics(text: string): TextStatistics {
  if (!text || text.trim().length === 0) {
    return {
      words: 0,
      characters: 0,
      lines: 0,
      paragraphs: 0,
      estimatedReadingTimeMin: 0,
      estimatedTokens: 0,
    };
  }

  const cleanText = text.trim();
  const characters = text.length;

  // Words count: match non-whitespace sequences
  const wordsArray = cleanText.match(/\b[\w'-]+\b/g);
  const words = wordsArray ? wordsArray.length : 0;

  // Lines count
  const lines = text.split(/\r\n|\r|\n/).length;

  // Paragraphs count: separated by one or more blank lines
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length;

  // Estimated reading time: average adult reads ~225 words per minute
  const estimatedReadingTimeMin = Math.max(1, Math.ceil(words / 225));

  // Estimated tokens (OpenAI/Llama heuristic: ~1 token per 4 characters or ~1.3 tokens per word)
  const estimatedTokens = Math.max(1, Math.round(words * 1.3));

  return {
    words,
    characters,
    lines,
    paragraphs: Math.max(1, paragraphs),
    estimatedReadingTimeMin,
    estimatedTokens,
  };
}

export function calculateCompressionRatio(
  originalWords: number,
  summaryWords: number
): { ratio: number; percentReduction: number } {
  if (originalWords <= 0 || summaryWords <= 0) {
    return { ratio: 1, percentReduction: 0 };
  }
  const ratio = Math.round((summaryWords / originalWords) * 100) / 100;
  const percentReduction = Math.max(
    0,
    Math.min(99, Math.round((1 - summaryWords / originalWords) * 100))
  );
  return { ratio, percentReduction };
}
