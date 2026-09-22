import { useState, useCallback } from 'react';
import {
  SummarySettings,
  SummarizationProgress,
  ParagraphOption,
  Conversation,
  Message,
} from '../types';
import { summarizationService } from '../services/SummarizationService';
import { localModelService } from '../services/LocalModelService';
import { localQAService } from '../services/LocalQAService';
import { generateSmartTitle } from '../utils/formatting';
import { calculateTextStatistics } from '../utils/textStatistics';

export function useSummarizer() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<SummarizationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSummarization = useCallback(
    async (
      rawText: string,
      settings: SummarySettings,
      activeConversation: Conversation | null,
      onComplete: (updatedConversation: Conversation) => void
    ) => {
      setError(null);
      setIsProcessing(true);
      setProgress({
        stage: 'analyzing',
        totalChunks: 0,
        completedChunks: 0,
        currentChunkIndex: 0,
        percentage: 0,
        statusMessage: 'Starting local summarization...',
      });

      try {
        const result = await summarizationService.executePipeline(
          rawText,
          settings,
          (prog) => {
            setProgress(prog);
          }
        );

        // Build messages
        const stats = calculateTextStatistics(rawText);
        const userMsg: Message = {
          id: `msg_user_${Date.now()}`,
          role: 'user',
          content: rawText,
          type: 'original',
          createdAt: Date.now(),
          metadata: {
            wordCount: stats.words,
            charCount: stats.characters,
            lineCount: stats.lines,
            estimatedTokens: stats.estimatedTokens,
          },
        };

        const assistantMsg: Message = {
          id: `msg_asst_${Date.now()}`,
          role: 'assistant',
          content: result.summary,
          type: 'summary',
          createdAt: Date.now(),
          metadata: {
            wordCount: calculateTextStatistics(result.summary).words,
            compressionRatio: result.metrics.compressionRatio,
            processingTimeMs: result.processingTimeMs,
            mode: settings.mode,
            length: settings.length,
            chunkCount: result.chunks.length,
          },
        };

        const title =
          activeConversation && activeConversation.title !== 'New Summary'
            ? activeConversation.title
            : generateSmartTitle(rawText);

        const updatedConv: Conversation = {
          id: activeConversation?.id || `conv_${Date.now()}`,
          title,
          createdAt: activeConversation?.createdAt || Date.now(),
          updatedAt: Date.now(),
          messages: [...(activeConversation?.messages || []), userMsg, assistantMsg],
          originalText: rawText,
          currentSummary: result.summary,
          currentParagraph: result.paragraph,
          settings: { ...settings },
          modelInformation: {
            name: 'Distil-BART-Edge / Local Hybrid',
            runtime: 'Local Engine (Optimized)',
          },
          metrics: result.metrics,
          userEmail: activeConversation?.userEmail,
          userId: activeConversation?.userId,
        };

        onComplete(updatedConv);
      } catch (err: any) {
        if (err?.message?.includes('cancelled')) {
          setError('Summarization was cancelled.');
        } else {
          setError(
            err?.message ||
              'An error occurred during local processing. Your browser or memory state may have interrupted inference.'
          );
        }
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const cancelSummarization = useCallback(() => {
    summarizationService.cancel();
    setIsProcessing(false);
    setProgress(null);
  }, []);

  const convertToParagraph = useCallback(
    async (
      summaryText: string,
      paragraphCount: ParagraphOption,
      activeConversation: Conversation,
      onComplete: (updatedConversation: Conversation) => void
    ) => {
      if (!summaryText) return;
      setIsProcessing(true);
      setError(null);

      try {
        const paragraphVersion = await localModelService.paragraphRewrite(
          summaryText,
          paragraphCount
        );

        const newMsg: Message = {
          id: `msg_asst_para_${Date.now()}`,
          role: 'assistant',
          content: paragraphVersion,
          type: 'paragraph',
          createdAt: Date.now(),
          metadata: {
            wordCount: calculateTextStatistics(paragraphVersion).words,
            paragraphCount: paragraphCount === 'natural' ? undefined : parseInt(paragraphCount, 10),
          },
        };

        const updatedConv: Conversation = {
          ...activeConversation,
          updatedAt: Date.now(),
          currentParagraph: paragraphVersion,
          messages: [...activeConversation.messages, newMsg],
        };

        onComplete(updatedConv);
      } catch (err: any) {
        setError(err?.message || 'Failed to rewrite paragraph version.');
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const executeFollowUp = useCallback(
    async (
      operation:
        | 'shorter'
        | 'detailed'
        | 'simpler'
        | 'key_points'
        | 'terms'
        | 'executive',
      userLabel: string,
      activeConversation: Conversation,
      onComplete: (updatedConversation: Conversation) => void
    ) => {
      if (!activeConversation.currentSummary && !activeConversation.originalText) return;
      setIsProcessing(true);
      setError(null);

      try {
        const textToUse = activeConversation.currentSummary || activeConversation.originalText;
        const result = await localModelService.executeFollowUp(
          operation,
          textToUse,
          activeConversation.originalText || textToUse
        );

        const now = Date.now();
        const userMsg: Message = {
          id: `msg_user_${now}`,
          role: 'user',
          content: userLabel,
          type: 'followup',
          createdAt: now,
        };

        const asstMsg: Message = {
          id: `msg_asst_${now + 1}`,
          role: 'assistant',
          content: result,
          type: 'followup', // Marked as followup so it displays in the Q&A Chat Thread
          createdAt: now + 1,
          metadata: {
            wordCount: calculateTextStatistics(result).words,
          },
        };

        const updatedConv: Conversation = {
          ...activeConversation,
          updatedAt: Date.now(),
          // Preserve currentSummary and currentParagraph so the upper summary card never changes
          currentSummary: activeConversation.currentSummary,
          currentParagraph: activeConversation.currentParagraph,
          messages: [...activeConversation.messages, userMsg, asstMsg],
        };

        onComplete(updatedConv);
      } catch (err: any) {
        setError(err?.message || 'Failed to process follow-up operation.');
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const askQuestion = useCallback(
    async (
      questionText: string,
      activeConversation: Conversation | null,
      settings: SummarySettings,
      onComplete: (updatedConversation: Conversation) => void
    ) => {
      const trimmed = questionText.trim();
      if (!trimmed) return;

      setIsProcessing(true);
      setError(null);

      try {
        const userMsg: Message = {
          id: `msg_user_${Date.now()}`,
          role: 'user',
          content: trimmed,
          type: 'followup',
          createdAt: Date.now(),
        };

        const currentConv = activeConversation || {
          id: `conv_${Date.now()}`,
          title: generateSmartTitle(trimmed),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          originalText: '',
          currentSummary: '',
          currentParagraph: '',
          settings,
          modelInformation: {
            name: 'Distil-BART-Edge / Local Hybrid',
            runtime: 'Local Engine (Optimized)',
          },
        };

        const qaResult = await localQAService.answerQuestion(
          trimmed,
          currentConv.originalText,
          currentConv.currentSummary,
          currentConv.messages
        );

        const asstMsg: Message = {
          id: `msg_asst_${Date.now()}`,
          role: 'assistant',
          content: qaResult.answer,
          type: 'followup',
          createdAt: Date.now(),
          metadata: {
            wordCount: calculateTextStatistics(qaResult.answer).words,
          },
        };

        const updatedConv: Conversation = {
          ...currentConv,
          title:
            !currentConv.title || currentConv.title === 'New Summary'
              ? generateSmartTitle(trimmed)
              : currentConv.title,
          updatedAt: Date.now(),
          messages: [...currentConv.messages, userMsg, asstMsg],
          originalText: currentConv.originalText || trimmed,
          currentSummary: currentConv.currentSummary,
        };

        onComplete(updatedConv);
      } catch (err: any) {
        setError(err?.message || 'Failed to answer question.');
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    isProcessing,
    progress,
    error,
    startSummarization,
    cancelSummarization,
    convertToParagraph,
    executeFollowUp,
    askQuestion,
  };
}
