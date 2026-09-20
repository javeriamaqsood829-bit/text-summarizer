import {
  TextChunk,
  SummarySettings,
  SummarizationProgress,
  QualityMetrics,
} from '../types';
import { defaultTextChunker } from './TextChunker';
import { localModelService } from './LocalModelService';

export interface SummarizeResult {
  summary: string;
  paragraph: string;
  chunks: TextChunk[];
  metrics: QualityMetrics;
  processingTimeMs: number;
}

export type ProgressCallback = (progress: SummarizationProgress) => void;

export class SummarizationService {
  private static instance: SummarizationService;
  private isCancelled: boolean = false;

  public static getInstance(): SummarizationService {
    if (!SummarizationService.instance) {
      SummarizationService.instance = new SummarizationService();
    }
    return SummarizationService.instance;
  }

  public cancel(): void {
    this.isCancelled = true;
    localModelService.abort();
  }

  /**
   * Executes the 4-Phase Map-Reduce Summarization Pipeline:
   * Phase 1: Chunk summarization (Map)
   * Phase 2: Group intermediate summaries
   * Phase 3: Reduce grouped summaries
   * Phase 4: Generate final cohesive summary & paragraph synthesis
   */
  public async executePipeline(
    rawText: string,
    settings: SummarySettings,
    onProgress?: ProgressCallback
  ): Promise<SummarizeResult> {
    this.isCancelled = false;
    localModelService.resetAbort();
    const startTime = performance.now();

    const reportProgress = (
      stage: SummarizationProgress['stage'],
      totalChunks: number,
      completedChunks: number,
      currentChunkIndex: number,
      percentage: number,
      statusMessage: string
    ) => {
      if (onProgress) {
        onProgress({
          stage,
          totalChunks,
          completedChunks,
          currentChunkIndex,
          percentage,
          statusMessage,
          startTime,
          elapsedMs: Math.round(performance.now() - startTime),
        });
      }
    };

    // STAGE 1: Analyzing & Normalizing
    reportProgress('analyzing', 0, 0, 0, 5, 'Analyzing text structure and boundaries...');
    await new Promise((r) => setTimeout(r, 40));

    if (this.isCancelled) throw new Error('Summarization was cancelled by user.');

    // STAGE 2: Chunking
    reportProgress('chunking', 0, 0, 0, 10, 'Segmenting text into semantic chunks...');
    const chunks = defaultTextChunker.chunkText(rawText, settings.chunkSize || 900);
    const totalChunks = chunks.length;

    if (totalChunks === 0) {
      throw new Error('No valid text content found to summarize.');
    }

    // STAGE 3 (PHASE 1): Summarize each chunk
    const intermediateSummaries: string[] = [];
    const targetRatio = (settings.lengthPercentage || 30) / 100;

    for (let i = 0; i < totalChunks; i++) {
      if (this.isCancelled) {
        reportProgress('cancelled', totalChunks, i, i, Math.round((i / totalChunks) * 60) + 10, 'Processing cancelled.');
        throw new Error('Summarization cancelled by user.');
      }

      chunks[i].status = 'processing';
      const pct = Math.round(15 + ((i + 1) / totalChunks) * 55); // 15% -> 70%
      reportProgress(
        'summarizing_chunks',
        totalChunks,
        i,
        i + 1,
        pct,
        `Summarizing chunk ${i + 1} of ${totalChunks}...`
      );

      try {
        const chunkSummary = await localModelService.summarizeChunk(
          chunks[i].text,
          settings.mode,
          settings.length,
          targetRatio
        );
        chunks[i].summary = chunkSummary;
        chunks[i].status = 'completed';
        intermediateSummaries.push(chunkSummary);
      } catch (err: any) {
        chunks[i].status = 'error';
        chunks[i].error = err?.message || 'Error summarizing chunk';
        if (this.isCancelled) throw err;
      }
    }

    if (this.isCancelled) throw new Error('Summarization cancelled by user.');

    // STAGE 4 (PHASE 2 & 3): Combine intermediate summaries (Map-Reduce step)
    reportProgress(
      'combining_summaries',
      totalChunks,
      totalChunks,
      totalChunks,
      75,
      'Combining intermediate chunk summaries...'
    );

    let reducedSummary: string;
    if (intermediateSummaries.length <= 1) {
      reducedSummary = intermediateSummaries[0] || '';
    } else {
      // If we have many chunks (> 6), group them hierarchically
      if (intermediateSummaries.length > 6) {
        const groupSize = 4;
        const groupSummaries: string[] = [];
        for (let g = 0; g < intermediateSummaries.length; g += groupSize) {
          const slice = intermediateSummaries.slice(g, g + groupSize);
          const grouped = await localModelService.combineSummaries(slice, settings.mode, settings.length);
          groupSummaries.push(grouped);
        }
        reducedSummary = await localModelService.combineSummaries(groupSummaries, settings.mode, settings.length);
      } else {
        reducedSummary = await localModelService.combineSummaries(
          intermediateSummaries,
          settings.mode,
          settings.length
        );
      }
    }

    if (this.isCancelled) throw new Error('Summarization cancelled by user.');

    // STAGE 5 (PHASE 4): Final synthesis & paragraph creation
    reportProgress(
      'generating_final',
      totalChunks,
      totalChunks,
      totalChunks,
      88,
      'Synthesizing final comprehensive summary...'
    );

    const finalSummary = reducedSummary;

    // Generate initial paragraph representation
    reportProgress(
      'rewriting_paragraph',
      totalChunks,
      totalChunks,
      totalChunks,
      95,
      'Generating cohesive paragraph version...'
    );

    const paragraphVersion = await localModelService.paragraphRewrite(
      finalSummary,
      settings.paragraphCount
    );

    // Compute empirical accuracy metrics
    const metrics = localModelService.evaluateQuality(rawText, finalSummary);
    const processingTimeMs = Math.round(performance.now() - startTime);

    reportProgress(
      'completed',
      totalChunks,
      totalChunks,
      totalChunks,
      100,
      'Summarization complete!'
    );

    return {
      summary: finalSummary,
      paragraph: paragraphVersion,
      chunks,
      metrics,
      processingTimeMs,
    };
  }
}

export const summarizationService = SummarizationService.getInstance();
