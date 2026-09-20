# LocalSummarize AI

> **Long Text. Clear Summary. Private AI.**  
> *AI-powered long-text summarization for 500+ lines of text, documents, research papers, reports, notes, and assignments — running locally on device with zero external API keys.*

---

## 1. Project Overview

**LocalSummarize AI** is a production-grade, privacy-first web application engineered specifically to summarize very large text inputs (including 500, 1,000, and 5,000+ line documents) directly inside the user's browser.

### Absolute No-API-Key Architecture
- **Zero API Keys Required**: Does NOT use OpenAI, Google Gemini, Anthropic Claude, OpenRouter, or Hugging Face paid inference tokens.
- **Zero Secret Credentials**: No `.env` secrets or backend API proxies required to function.
- **Strict Data Privacy**: User documents are analyzed on-device using local WebAssembly (WASM) and WebGPU hardware acceleration. Text never leaves the client device.
- **No Artificial 500-Line Cutoff**: Built from the ground up with a resilient **semantic paragraph-aware chunker** and a **4-Phase Map-Reduce summarization pipeline** that scales to extensive documents.

---

## 2. Key Features

- **500+ Line Support**: Processes massive texts without browser lockup or arbitrary truncation.
- **Dedicated TextChunker**: Splits large strings at paragraph boundaries, headings, and sentence ends while preserving section context.
- **4-Phase Map-Reduce Pipeline**:
  - *Phase 1 (Map)*: Summarizes individual semantic chunks.
  - *Phase 2 (Group)*: Groups intermediate chunk summaries into hierarchical batches.
  - *Phase 3 (Reduce)*: Synthesizes grouped summaries.
  - *Phase 4 (Final Synthesis)*: Emits comprehensive summary and cohesive paragraph rewrite.
- **Summary Modes**:
  - **Balanced Summary** (Default optimal coverage and brevity)
  - **Quick Summary** (High-level rapid takeaways)
  - **Detailed Summary** (In-depth extraction preserving key metrics and nuances)
  - **Key Points** (Clean structured bullet points)
  - **Academic Summary** (Formal hypotheses, methodologies, and findings)
  - **Simple English** (Plain language free from complex technical jargon)
  - **Executive Summary** (Decision-maker highlights and strategic takeaways)
- **Summary Length Preferences**:
  - Quick pills: Short (~15-20%), Medium (~30-35%), Long (~45-50%)
  - Precision slider: Target 10% – 50% length compression
- **Major Feature: Summary → Paragraph Conversion**:
  - Converts bullet-point summaries into natural, fluent paragraphs with cohesive discourse transitions (`Furthermore`, `In addition`, `Consequently`).
  - Options: **1 Paragraph**, **2 Paragraphs**, **3 Paragraphs**, or **Natural Paragraphs**.
- **Interactive Follow-Up Commands**:
  - *Make Shorter*, *Make More Detailed*, *Convert to Paragraph*, *Make Simpler*, *Extract Key Points*, *Extract Important Terms*, *Generate Executive Summary*, *Regenerate*, *Copy*, *Download*.
- **Client-Side IndexedDB Storage**:
  - Local persistent history for conversations, messages, summaries, and metrics.
  - Live search across titles, summaries, and source documents.
  - Safe rename, individual delete, and clear-all with confirmation.
- **Live Text Statistics**:
  - Real-time counters for Words, Characters, Lines, Paragraphs, and Estimated Reading Time.
  - Source Length vs. Summary Length compression ratio tracking (e.g. `87% reduction`).
- **Export & Output Suite**:
  - Copy to clipboard (`Ctrl+Shift+C`)
  - Download as plain text (`.txt`)
  - Download formatted Markdown (`.md`)
  - Instant print view
- **Complete Dual Themes**:
  - Light mode (`#F8FAFC`, `#FFFFFF`, `#0F172A`, `#2563EB`)
  - Dark mode (`#0B1120`, `#111827`, `#F8FAFC`, `#3B82F6`)
  - System preference detection

---

## 3. Architecture & Separation of Concerns

```
src/
├── types/                     # Strong TypeScript domain interfaces
│   └── index.ts               # Conversation, Message, ModelInfo, TextChunk, QualityMetrics
├── utils/                     # Pure mathematical and formatting utilities
│   ├── textStatistics.ts      # Live words, chars, lines, paragraphs, reading time, ratio
│   ├── tokenEstimator.ts      # Token estimation, sentence tokenizer, heading detection
│   ├── formatting.ts          # Dates, compact numbers, smart titles, file sanitization
│   └── validation.ts          # Input sanitization and safety checks
├── services/                  # Decoupled business logic & pipelines
│   ├── TextChunker.ts         # Semantic chunking (900-token capacity, boundary preservation)
│   ├── LocalModelService.ts   # Core model abstraction (load, unload, summarize, rewrite)
│   ├── SummarizationService.ts# 4-Phase Map-Reduce summarization pipeline
│   ├── HistoryService.ts      # IndexedDB durable local persistence
│   └── ExportService.ts       # TXT, Markdown, print, and clipboard handlers
├── hooks/                     # Reactive state hooks
│   ├── useTheme.ts            # Light, dark, system theme synchronization
│   ├── useLocalModel.ts       # WebGPU/WASM detection and model lifecycle
│   ├── useHistory.ts          # Reactive IndexedDB conversations & search
│   └── useSummarizer.ts       # Pipeline progress orchestration & follow-ups
├── components/                # Modular UI components
│   ├── Header.tsx             # Model status badge, privacy pill, controls
│   ├── Sidebar.tsx            # New chat (⌘K), grouped history, search, settings
│   ├── TextInputArea.tsx      # Live stats bar, drag-and-drop, 500+ lines sample loader
│   ├── ControlsBar.tsx        # Mode, length, slider, Paragraph Output, Primary CTA
│   ├── ProgressBar.tsx        # Chunk X of Y, 4-stage indicators, cancel button
│   ├── ResultTabs.tsx         # [Summary], [Paragraph], [Original], export tools
│   ├── FollowUpActions.tsx    # Action pills for iterative refinement
│   ├── ChatWindow.tsx         # Multi-turn conversational history stream
│   ├── EmptyState.tsx         # Landing view with core capability feature cards
│   └── SettingsModal.tsx      # Comprehensive tabbed configuration & training docs
├── data/
│   └── sampleDocument.ts      # 600+ line scientific research report for immediate testing
└── App.tsx                    # Top-level application orchestrator
```

---

## 4. Local Model Strategy & Hardware Detection

The application implements a clean **`LocalModelService`** interface:
```typescript
interface ILocalModelService {
  loadModel(): Promise<void>;
  unloadModel(): Promise<void>;
  summarizeChunk(chunk: string, mode: SummaryMode, length: SummaryLength): Promise<string>;
  combineSummaries(summaries: string[], mode: SummaryMode, length: SummaryLength): Promise<string>;
  paragraphRewrite(summary: string, count: ParagraphOption): Promise<string>;
  executeFollowUp(op: string, summary: string, source: string): Promise<string>;
  getModelStatus(): ModelInfo;
  evaluateQuality(original: string, summary: string): QualityMetrics;
}
```

### Hardware Detection
On application startup, the local engine queries the browser environment:
1. **WebGPU**: Checks `navigator.gpu.requestAdapter()`. When supported, enables hardware-accelerated tensor operations.
2. **WebAssembly (WASM)**: Validates `WebAssembly.instantiate` for multi-threaded SIMD execution.
3. **Hardware Concurrency**: Adapts chunk concurrency to `navigator.hardwareConcurrency`.
4. **Device Memory**: Estimates memory headroom via `navigator.deviceMemory`.

Status indicators:
- `● Local AI Ready`: Model loaded and initialized locally.
- `● Loading Model...`: Local weights or engine initializing.
- `● Processing...`: Active chunking or map-reduce pass in progress.
- `● Local AI Unavailable`: Fallback message shown when browser lacks required features.

---

## 5. Offline-First & Privacy Guarantee

- **No Remote Network Calls**: When you paste documents, no HTTP payload containing your text is ever transmitted.
- **Offline Capable**: Once the app bundle is loaded, the entire summarization engine functions without an active internet connection.
- **IndexedDB Isolation**: Document storage resides strictly in your browser's private database sandbox. Clearing your browser data clears your history.

---

## 6. Training & Fine-Tuning Architecture

> **CRITICAL DISTINCTION: INFERENCE vs. TRAINING**  
> **Inference** occurs inside the client browser. **Model training or fine-tuning** is strictly performed offline in a Python environment with dedicated GPU resources (e.g. PyTorch / CUDA), then exported to ONNX / WebAssembly for client deployment.

### Dataset Format
Training datasets must use standardized JSON records:
```json
{
  "text": "Original full document or section exceeding 500+ lines...",
  "summary": "Target concise, human-verified abstractive summary..."
}
```

### Offline Pipeline Steps
1. **Curate Dataset**: Collect representative documents (research papers, legal briefs, technical notes).
2. **Preprocessing**: Normalize unicode, remove artifact headers, and format into JSON pairs.
3. **Model Selection**: Choose an open-source encoder-decoder base (e.g. `facebook/bart-base`, `t5-small`, or `distilbart-cnn-12-6`).
4. **Fine-Tuning**: Execute training via Hugging Face `Seq2SeqTrainer` with AdamW optimizer and cosine learning rate schedule.
5. **Evaluation**: Benchmark against ROUGE-1, ROUGE-2, and ROUGE-L on held-out test splits.
6. **Quantization & Export**:
   ```bash
   # Export PyTorch model to ONNX FP16 / INT8
   python -m transformers.onnx --model=my_finetuned_model onnx/
   ```
7. **Client Loading**: Place converted weights in the public directory and connect via `LocalModelService`.

---

## 7. Quality & Evaluation Metrics

The local service generates objective metrics after each summarization pass:
- **ROUGE-1**: Evaluates unigram lexical recall against key concepts.
- **ROUGE-2**: Evaluates bigram fluency and syntactic cohesion.
- **ROUGE-L**: Measures Longest Common Subsequence overlap.
- **Faithfulness**: Validates that numbers, dates, named entities, and conclusions are strictly anchored in source text.
- **Compression Ratio**: Computes exact percentage reduction between source word count and summary word count.

---

## 8. Development & Build

### Installation
```bash
npm install
```

### Run Locally (Dev Server)
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### Production Build
```bash
npm run build
```
Creates an optimized production bundle in `dist/`.

### Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Trigger Summarization
- `Ctrl/Cmd + K`: Create New Summary
- `Ctrl/Cmd + Shift + C`: Copy Current Summary Result
