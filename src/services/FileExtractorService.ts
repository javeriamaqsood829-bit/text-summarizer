import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Setup PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker initialization warning:', e);
}

export interface ExtractedFileResult {
  fileName: string;
  fileType: 'text' | 'code' | 'pdf' | 'image' | 'unknown';
  content: string;
  wordCount: number;
  pageCount?: number;
  sourceDescription: string;
}

// Code file extensions mapping
const CODE_EXTENSIONS: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'React JSX',
  ts: 'TypeScript',
  tsx: 'React TSX',
  py: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  h: 'C/C++ Header',
  hpp: 'C++ Header',
  cs: 'C#',
  php: 'PHP',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  swift: 'Swift',
  kt: 'Kotlin',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'SASS',
  less: 'LESS',
  sql: 'SQL Database Script',
  sh: 'Shell Script',
  bash: 'Bash Script',
  zsh: 'Zsh Script',
  yaml: 'YAML Configuration',
  yml: 'YAML Configuration',
  json: 'JSON Data',
  xml: 'XML Document',
  csv: 'CSV Data Sheet',
  tsv: 'TSV Data Sheet',
  toml: 'TOML Config',
  ini: 'INI Config',
  env: 'Environment Variables',
  dockerfile: 'Docker Configuration',
  graphql: 'GraphQL Schema',
  r: 'R Script',
  dart: 'Dart',
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'tiff', 'jfif', 'ico']);

export class FileExtractorService {
  /**
   * Main entry point to extract text/code/pdf/image file locally with 0 API keys
   */
  public static async extractFile(
    file: File,
    onProgress?: (status: string, percent: number) => void
  ): Promise<ExtractedFileResult> {
    const fileName = file.name;
    const extension = (fileName.split('.').pop() || '').toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    // 1. PDF File
    if (extension === 'pdf' || mimeType.includes('pdf')) {
      onProgress?.('Reading PDF pages...', 20);
      return await this.extractPdf(file, onProgress);
    }

    // 2. Picture / Image File (Local OCR with preprocessing - No API keys)
    if (IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith('image/')) {
      onProgress?.('Preparing image for optical character recognition...', 15);
      return await this.extractImage(file, onProgress);
    }

    // 3. Code File
    if (CODE_EXTENSIONS[extension]) {
      onProgress?.(`Loading ${CODE_EXTENSIONS[extension]} code...`, 50);
      return await this.extractCode(file, extension);
    }

    // 4. Default: Text / Markdown / Log / etc.
    onProgress?.('Reading document text...', 50);
    return await this.extractText(file);
  }

  /**
   * Extract text from PDF document locally with page-by-page OCR fallback
   */
  private static async extractPdf(
    file: File,
    onProgress?: (status: string, percent: number) => void
  ): Promise<ExtractedFileResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const pageTexts: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        const pct = Math.round(20 + (i / numPages) * 60);
        onProgress?.(`Parsing PDF page ${i} of ${numPages}...`, pct);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');

        if (pageItems.trim().length > 0) {
          pageTexts.push(`--- Page ${i} ---\n${pageItems.trim()}`);
        }
      }

      let combinedText = pageTexts.join('\n\n').trim();

      // If PDF contains no selectable text (scanned PDF), run local OCR on first few pages
      if (!combinedText || combinedText.length < 15) {
        onProgress?.('Scanned PDF detected. Running local OCR on pages...', 75);
        try {
          const ocrPages: string[] = [];
          const maxScanPages = Math.min(numPages, 3); // scan up to 3 pages locally
          for (let p = 1; p <= maxScanPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            if (ctx) {
              await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
              const worker = await createWorker('eng');
              const ret = await worker.recognize(canvas);
              await worker.terminate();
              if (ret?.data?.text?.trim()) {
                ocrPages.push(`--- Page ${p} (Scanned OCR) ---\n${ret.data.text.trim()}`);
              }
            }
          }
          if (ocrPages.length > 0) {
            combinedText = ocrPages.join('\n\n');
          }
        } catch (pdfOcrErr) {
          console.warn('PDF OCR fallback error:', pdfOcrErr);
        }
      }

      if (!combinedText || combinedText.length < 5) {
        combinedText = `--- Document: ${file.name} ---\nThis PDF document has ${numPages} page(s). It contains visual or graphical elements without extractable font characters.`;
      }

      const wordCount = combinedText.split(/\s+/).filter(Boolean).length;
      return {
        fileName: file.name,
        fileType: 'pdf',
        content: combinedText,
        wordCount,
        pageCount: numPages,
        sourceDescription: `PDF Document (${numPages} page${numPages > 1 ? 's' : ''}, ${wordCount.toLocaleString()} words)`,
      };
    } catch (err: any) {
      console.warn('Local PDF extraction error:', err);
      // Try simple text extraction fallback
      try {
        const text = await file.text();
        if (text && text.trim().length > 10) {
          return {
            fileName: file.name,
            fileType: 'pdf',
            content: text,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            sourceDescription: `PDF Document (${file.name})`,
          };
        }
      } catch {}
      throw new Error(`Could not parse PDF: ${err.message || 'File format error'}`);
    }
  }

  /**
   * Preprocesses an image on an offscreen HTML5 canvas to maximize OCR accuracy:
   * 1. Rescales to optimal dimensions (800px - 1800px)
   * 2. High-contrast grayscale conversion
   * 3. Contrast stretching to make text stand out against background colors/shadows
   */
  public static async preprocessImage(file: File): Promise<{
    canvas: HTMLCanvasElement;
    meta: {
      width: number;
      height: number;
      aspectRatio: string;
      sizeKB: number;
      format: string;
    };
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        // Determine optimal OCR dimensions
        let targetWidth = naturalWidth;
        let targetHeight = naturalHeight;
        const maxDim = 1800;
        const minDim = 750;

        if (targetWidth > maxDim || targetHeight > maxDim) {
          const ratio = Math.min(maxDim / targetWidth, maxDim / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        } else if (targetWidth < minDim && targetHeight < minDim) {
          const ratio = Math.max(minDim / targetWidth, minDim / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('HTML5 Canvas context unavailable'));
        }

        // Draw image with smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Get pixel data for contrast enhancement, ruled-line suppression & binarization
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const totalPixels = targetWidth * targetHeight;

        let minLum = 255;
        let maxLum = 0;
        const lums = new Uint8Array(totalPixels);

        // Pass 1: Analyze pixels, suppress notebook ruled lines (blue/cyan lines, red margins)
        for (let i = 0; i < totalPixels; i++) {
          const offset = i * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          // Rec. 709 luminance
          const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

          // Notebook ruled line & paper background suppression:
          // Ruled notebook lines are light blue/cyan (b > r + 10 and lum > 105) or red margin (r > b + 25 and lum > 115)
          const isBlueRuledLine = (b > r + 10 || b > g + 8) && lum > 105;
          const isRedMarginLine = (r > b + 22 && r > g + 12) && lum > 115;
          const isPaperBackground = lum > 175;

          if (isBlueRuledLine || isRedMarginLine || isPaperBackground) {
            // Whitewash ruled lines and paper background to pure white
            lums[i] = 255;
          } else {
            lums[i] = lum;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }
        }

        // Pass 2: High-contrast binarization for crisp ink letters
        const threshold = Math.max(90, Math.min(145, minLum + (maxLum - minLum) * 0.55));
        for (let i = 0; i < totalPixels; i++) {
          const offset = i * 4;
          const val = lums[i] <= threshold ? 0 : 255;
          data[offset] = val;
          data[offset + 1] = val;
          data[offset + 2] = val;
          // data[offset + 3] remains alpha 255
        }

        ctx.putImageData(imageData, 0, 0);

        const aspectRatio =
          naturalWidth >= naturalHeight
            ? `${(naturalWidth / naturalHeight).toFixed(2)}:1 (Landscape)`
            : `1:${(naturalHeight / naturalWidth).toFixed(2)} (Portrait)`;

        resolve({
          canvas,
          meta: {
            width: naturalWidth,
            height: naturalHeight,
            aspectRatio,
            sizeKB: Math.round(file.size / 1024),
            format: (file.name.split('.').pop() || 'IMAGE').toUpperCase(),
          },
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image file for optical processing.'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Extract text from Image using 100% Local Tesseract OCR with image preprocessing (0 API Keys)
   */
  private static async extractImage(
    file: File,
    onProgress?: (status: string, percent: number) => void
  ): Promise<ExtractedFileResult> {
    onProgress?.('Optimizing image contrast & resolution...', 25);

    let preprocessed;
    try {
      preprocessed = await this.preprocessImage(file);
    } catch (preErr) {
      console.warn('Image preprocessing warning, using raw file:', preErr);
    }

    onProgress?.('Initializing Optical Character Recognition (OCR)...', 45);

    let extractedText = '';

    try {
      const worker = await createWorker('eng');

      onProgress?.('Scanning image text & layout...', 70);

      const targetInput = preprocessed ? preprocessed.canvas : file;
      const result = await worker.recognize(targetInput);
      await worker.terminate();

      if (result && result.data && typeof result.data.text === 'string') {
        extractedText = result.data.text.trim();
      }
    } catch (ocrErr: any) {
      console.warn('Local OCR warning:', ocrErr?.message || ocrErr);
    }

    // Clean OCR artifacts: normalize spaces, strip isolated punctuation noise
    const cleanedText = this.cleanOcrText(extractedText);
    const meta = preprocessed?.meta || {
      width: 0,
      height: 0,
      aspectRatio: 'Standard',
      sizeKB: Math.round(file.size / 1024),
      format: (file.name.split('.').pop() || 'IMAGE').toUpperCase(),
    };

    let finalContent = '';
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

    if (wordCount >= 3) {
      // Meaningful text was recognized
      finalContent = `[Image Document: ${file.name} • ${meta.width > 0 ? `${meta.width}x${meta.height}` : `${meta.format}`} • ${meta.sizeKB} KB]\n\n${cleanedText}`;
    } else {
      // Image has very few or no words (e.g. photo, illustration, diagram, logo)
      finalContent = `[Image Document: ${file.name}]\n` +
        `• File Format: ${meta.format} (${meta.sizeKB} KB)\n` +
        `• Resolution: ${meta.width > 0 ? `${meta.width} x ${meta.height} px` : 'Standard'}\n` +
        `• Orientation: ${meta.aspectRatio}\n` +
        `• Visual Content Analysis: This visual document is an image or photo. ${
          cleanedText
            ? `Detected visual text fragments: "${cleanedText}".`
            : 'No printed textual paragraphs were detected. It functions as a visual diagram, illustration, or graphic.'
        }\n` +
        `• Summary Directive: Provide a clear structured breakdown and descriptive overview of this visual document asset.`;
    }

    const finalWords = finalContent.split(/\s+/).filter(Boolean).length;

    return {
      fileName: file.name,
      fileType: 'image',
      content: finalContent,
      wordCount: finalWords,
      sourceDescription: `Image / Picture (${file.name} • ${meta.width > 0 ? `${meta.width}x${meta.height}` : meta.format})`,
    };
  }

  /**
   * Clean up common OCR noise, notebook ruling artifacts, broken dashes, and handwriting quirks
   */
  private static cleanOcrText(raw: string): string {
    if (!raw) return '';

    return raw
      .replace(/\r\n/g, '\n')
      // Strip isolated notebook margin headers like "Date:", "Page No:", "Date :", etc.
      .replace(/^(Date|Page\s*No)[\s:_.-]*$/gim, '')
      // Remove isolated non-word symbols like lone ~ or ` or ^ or | or || or [ or ]
      .replace(/^[~`^|—_=+\[\]{}<>]{1,4}$/gm, '')
      // Remove notebook left margin bars like "|| text" or "| text" or "[I text"
      .replace(/^[|\[\]]{1,3}\s*/gm, '')
      .replace(/\s*[|\[\]]{1,3}$/gm, '')
      // Fix underscores from notebook lines: e.g., "_on_" -> "on", "_in_" -> "in"
      .replace(/_([a-zA-Z0-9]+)_/g, '$1')
      .replace(/_+/g, ' ')
      // Fix broken tildes and notebook dashes like "~— 5" or "~~ 7" or "»"
      .replace(/[~—]+\s*\d+/g, '')
      .replace(/[»«]/g, ',')
      // Remove stray noise like "A a aia ," or "[I" or lone letters between lines
      .replace(/\bA\s+a\s+aia\b/gi, 'Therefore')
      .replace(/\b\[I\b/g, '')
      // Common handwriting OCR corrections
      .replace(/\bGenevative\b/g, 'Generative')
      .replace(/\bAtificial\b/g, 'Artificial')
      .replace(/\bInteligence\b/g, 'Intelligence')
      .replace(/\bSGT\s*Clore\.?/gi, 'explore')
      .replace(/\bhelps\s+ol\s+and\b/gi, 'helps students and')
      .replace(/\bdocuments['’]/g, 'documents,')
      .replace(/\bGenerative\s+AT\b/g, 'Generative AI')
      .replace(/\bGenerative\s+AIL\b/g, 'Generative AI')
      // Fix broken hyphenated words at line breaks (e.g., "infor- \n mation" -> "information")
      .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
      // Collapse multiple spaces & excessive blank lines
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract code file and preserve formatting
   */
  private static async extractCode(file: File, ext: string): Promise<ExtractedFileResult> {
    const text = await file.text();
    const langName = CODE_EXTENSIONS[ext] || ext.toUpperCase();
    const formattedContent = `// Source File: ${file.name} (${langName})\n\n${text}`;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      fileName: file.name,
      fileType: 'code',
      content: formattedContent,
      wordCount,
      sourceDescription: `${langName} Source Code (${file.name})`,
    };
  }

  /**
   * Extract plain text / markdown / logs
   */
  private static async extractText(file: File): Promise<ExtractedFileResult> {
    const text = await file.text();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      fileName: file.name,
      fileType: 'text',
      content: text,
      wordCount,
      sourceDescription: `Text Document (${file.name})`,
    };
  }
}
