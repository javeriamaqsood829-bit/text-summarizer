import { TextChunk } from '../types';
import { estimateTokens, splitIntoSentences, normalizeText, isHeading } from '../utils/tokenEstimator';

export interface ChunkerOptions {
  maxTokensPerChunk?: number;
  minTokensPerChunk?: number;
  overlapTokens?: number;
}

export class TextChunker {
  private defaultMaxTokens = 900;
  private defaultMinTokens = 200;

  constructor(options?: ChunkerOptions) {
    if (options?.maxTokensPerChunk) this.defaultMaxTokens = options.maxTokensPerChunk;
    if (options?.minTokensPerChunk) this.defaultMinTokens = options.minTokensPerChunk;
  }

  /**
   * Chunks arbitrary long text into logically coherent segments,
   * respecting headings, paragraphs, and sentence boundaries.
   */
  public chunkText(rawText: string, customMaxTokens?: number): TextChunk[] {
    const text = normalizeText(rawText);
    const maxTokens = customMaxTokens || this.defaultMaxTokens;

    if (!text || text.trim().length === 0) {
      return [];
    }

    // Split text into paragraphs
    const rawParagraphs = text.split(/\n\s*\n/);
    const paragraphs: { text: string; startIndex: number; endIndex: number; isHeader: boolean }[] = [];

    let runningIndex = 0;
    for (const p of rawParagraphs) {
      const trimmed = p.trim();
      const startInOriginal = text.indexOf(p, runningIndex);
      const actualStart = startInOriginal !== -1 ? startInOriginal : runningIndex;
      const actualEnd = actualStart + p.length;
      runningIndex = actualEnd;

      if (trimmed.length > 0) {
        paragraphs.push({
          text: trimmed,
          startIndex: actualStart,
          endIndex: actualEnd,
          isHeader: isHeading(trimmed),
        });
      }
    }

    if (paragraphs.length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];
    let currentChunkParagraphs: string[] = [];
    let currentChunkTokens = 0;
    let currentChunkStart = paragraphs[0].startIndex;
    let currentChunkEnd = paragraphs[0].endIndex;

    const flushChunk = () => {
      if (currentChunkParagraphs.length === 0) return;

      const chunkTextContent = currentChunkParagraphs.join('\n\n');
      const chunkId = `chunk-${String(chunks.length + 1).padStart(3, '0')}`;
      const tokens = estimateTokens(chunkTextContent);

      chunks.push({
        id: chunkId,
        index: chunks.length,
        sourceStart: currentChunkStart,
        sourceEnd: currentChunkEnd,
        text: chunkTextContent,
        estimatedTokens: tokens,
        status: 'pending',
        summary: '',
      });

      currentChunkParagraphs = [];
      currentChunkTokens = 0;
    };

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const paraTokens = estimateTokens(para.text);

      // If a single paragraph is larger than maxTokens, split it into sentence batches
      if (paraTokens > maxTokens) {
        // Flush any pending paragraphs first
        if (currentChunkParagraphs.length > 0) {
          flushChunk();
        }

        const sentences = splitIntoSentences(para.text);
        let sentenceBatch: string[] = [];
        let sentenceTokens = 0;
        let batchStart = para.startIndex;

        for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
          const sentence = sentences[sIdx];
          const sTokens = estimateTokens(sentence);

          if (sentenceTokens + sTokens > maxTokens && sentenceBatch.length > 0) {
            const batchText = sentenceBatch.join(' ');
            const batchEnd = batchStart + batchText.length;
            const chunkId = `chunk-${String(chunks.length + 1).padStart(3, '0')}`;
            chunks.push({
              id: chunkId,
              index: chunks.length,
              sourceStart: batchStart,
              sourceEnd: batchEnd,
              text: batchText,
              estimatedTokens: estimateTokens(batchText),
              status: 'pending',
              summary: '',
            });

            sentenceBatch = [sentence];
            sentenceTokens = sTokens;
            batchStart = batchEnd;
          } else {
            sentenceBatch.push(sentence);
            sentenceTokens += sTokens;
          }
        }

        if (sentenceBatch.length > 0) {
          const batchText = sentenceBatch.join(' ');
          const chunkId = `chunk-${String(chunks.length + 1).padStart(3, '0')}`;
          chunks.push({
            id: chunkId,
            index: chunks.length,
            sourceStart: batchStart,
            sourceEnd: para.endIndex,
            text: batchText,
            estimatedTokens: estimateTokens(batchText),
            status: 'pending',
            summary: '',
          });
        }

        continue;
      }

      // If adding this paragraph would exceed maxTokens, flush current chunk
      if (currentChunkTokens + paraTokens > maxTokens && currentChunkParagraphs.length > 0) {
        flushChunk();
        currentChunkStart = para.startIndex;
      }

      if (currentChunkParagraphs.length === 0) {
        currentChunkStart = para.startIndex;
      }

      currentChunkParagraphs.push(para.text);
      currentChunkTokens += paraTokens;
      currentChunkEnd = para.endIndex;
    }

    // Flush remaining
    if (currentChunkParagraphs.length > 0) {
      flushChunk();
    }

    return chunks;
  }
}

export const defaultTextChunker = new TextChunker();
