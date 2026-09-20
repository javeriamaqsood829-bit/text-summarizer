import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Setup PDF.js worker
try {
  // Use official CDN worker matching version or fallback
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

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'tiff']);

export class FileExtractorService {
  /**
   * Main entry point to extract text/code/pdf/image file
   */
  public static async extractFile(
    file: File,
    onProgress?: (status: string, percent: number) => void
  ): Promise<ExtractedFileResult> {
    const fileName = file.name;
    const extension = (fileName.split('.').pop() || '').toLowerCase();
    const mimeType = file.type || '';

    // 1. PDF File
    if (extension === 'pdf' || mimeType.includes('pdf')) {
      onProgress?.('Reading PDF pages...', 20);
      return await this.extractPdf(file, onProgress);
    }

    // 2. Picture / Image File
    if (IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith('image/')) {
      onProgress?.('Extracting text from image (OCR)...', 20);
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
   * Extract text from PDF document
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
        const pct = Math.round(20 + (i / numPages) * 70);
        onProgress?.(`Parsing PDF page ${i} of ${numPages}...`, pct);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        if (pageItems.trim().length > 0) {
          pageTexts.push(`--- Page ${i} ---\n${pageItems}`);
        }
      }

      const combinedText = pageTexts.join('\n\n').trim();

      if (!combinedText || combinedText.length < 10) {
        // PDF might be a scanned image PDF, try server extraction
        const serverResult = await this.tryServerExtraction(file);
        if (serverResult && serverResult.trim().length > 20) {
          return {
            fileName: file.name,
            fileType: 'pdf',
            content: serverResult,
            wordCount: serverResult.split(/\s+/).filter(Boolean).length,
            pageCount: numPages,
            sourceDescription: `PDF Document (${numPages} pages, OCR-extracted via AI)`,
          };
        }
        throw new Error('This PDF appears to be empty or contains scanned images without selectable text.');
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
      console.warn('Local PDF extraction error, falling back to server:', err);
      // Fallback to server extraction
      const serverResult = await this.tryServerExtraction(file);
      if (serverResult) {
        return {
          fileName: file.name,
          fileType: 'pdf',
          content: serverResult,
          wordCount: serverResult.split(/\s+/).filter(Boolean).length,
          sourceDescription: `PDF Document (${file.name})`,
        };
      }
      throw new Error(`Could not parse PDF: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Extract text from Image using Server Gemini Vision or Client Tesseract OCR
   */
  private static async extractImage(
    file: File,
    onProgress?: (status: string, percent: number) => void
  ): Promise<ExtractedFileResult> {
    // 1. Try server-side AI Vision first for best accuracy
    onProgress?.('Scanning image with AI Vision...', 30);
    try {
      const serverResult = await this.tryServerExtraction(file);
      if (serverResult && serverResult.trim().length > 5) {
        const wordCount = serverResult.split(/\s+/).filter(Boolean).length;
        return {
          fileName: file.name,
          fileType: 'image',
          content: serverResult,
          wordCount,
          sourceDescription: `Image / Picture (${file.name} • AI Extracted Text)`,
        };
      }
    } catch (serverErr) {
      console.warn('Server image extraction failed, trying local OCR:', serverErr);
    }

    // 2. Fallback: Client-side Tesseract.js OCR
    onProgress?.('Initializing Optical Character Recognition (OCR)...', 50);
    try {
      const worker = await createWorker('eng');
      onProgress?.('Recognizing text in image...', 75);
      const ret = await worker.recognize(file);
      await worker.terminate();

      const text = ret.data.text.trim();
      if (!text || text.length < 5) {
        throw new Error('No readable text could be recognized from this image.');
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      return {
        fileName: file.name,
        fileType: 'image',
        content: text,
        wordCount,
        sourceDescription: `Image (${file.name} • OCR text recognized)`,
      };
    } catch (ocrErr: any) {
      throw new Error(`Image text extraction failed: ${ocrErr.message || 'Please upload a clearer image.'}`);
    }
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

  /**
   * Helper to send file to /api/extract-file on server
   */
  private static async tryServerExtraction(file: File): Promise<string | null> {
    try {
      const base64 = await this.fileToBase64(file);
      const res = await fetch('/api/extract-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64: base64,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.text || null;
    } catch {
      return null;
    }
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data URL prefix
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
