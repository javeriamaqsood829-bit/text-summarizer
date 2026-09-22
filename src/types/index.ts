export type Role = 'user' | 'assistant' | 'system';

export type MessageType = 'original' | 'summary' | 'paragraph' | 'followup' | 'status';

export interface Message {
  id: string;
  role: Role;
  content: string;
  type: MessageType;
  createdAt: number;
  metadata?: {
    wordCount?: number;
    charCount?: number;
    lineCount?: number;
    estimatedTokens?: number;
    compressionRatio?: number;
    processingTimeMs?: number;
    mode?: SummaryMode;
    length?: SummaryLength;
    paragraphCount?: number;
    chunkCount?: number;
  };
}

export type SummaryMode =
  | 'balanced'
  | 'quick'
  | 'detailed'
  | 'key_points'
  | 'academic'
  | 'simple_english'
  | 'executive'
  | 'lengthy_paragraph';

export type SummaryLength = 'short' | 'medium' | 'long';

export type ParagraphOption = '1' | '2' | '3' | 'natural';

export interface SummarySettings {
  mode: SummaryMode;
  length: SummaryLength;
  lengthPercentage: number; // 10% - 50%
  paragraphCount: ParagraphOption;
  chunkSize: number; // in estimated tokens (e.g., 800 - 1500)
}

export interface TextChunk {
  id: string;
  index: number;
  sourceStart: number;
  sourceEnd: number;
  text: string;
  estimatedTokens: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  summary?: string;
  error?: string;
}

export type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'chunking'
  | 'summarizing_chunks'
  | 'combining_summaries'
  | 'generating_final'
  | 'rewriting_paragraph'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface SummarizationProgress {
  stage: PipelineStage;
  totalChunks: number;
  completedChunks: number;
  currentChunkIndex: number;
  percentage: number;
  statusMessage: string;
  startTime?: number;
  elapsedMs?: number;
}

export type ModelStatusType =
  | 'ready'
  | 'loading'
  | 'unavailable'
  | 'processing'
  | 'error';

export type ModelRuntime = 'WebGPU' | 'WebAssembly (WASM)' | 'Local Engine (Optimized)';

export interface ModelInfo {
  name: string;
  status: ModelStatusType;
  runtime: ModelRuntime;
  sizeMB: number;
  isLoaded: boolean;
  webGpuSupported: boolean;
  wasmSupported: boolean;
  deviceMemoryGB?: number;
  hardwareConcurrency?: number;
  version: string;
  description: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  originalText: string;
  currentSummary: string;
  currentParagraph: string;
  settings: SummarySettings;
  modelInformation: {
    name: string;
    runtime: string;
  };
  metrics?: QualityMetrics;
  fileName?: string;
  fileType?: string;
}

export interface QualityMetrics {
  rouge1: number;
  rouge2: number;
  rougeL: number;
  faithfulness: number;
  coverage: number;
  compressionRatio: number;
  sourceTokens: number;
  summaryTokens: number;
}

export interface TextStatistics {
  words: number;
  characters: number;
  lines: number;
  paragraphs: number;
  estimatedReadingTimeMin: number;
  estimatedTokens: number;
}
