import React, { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to format inline markdown (bold, italic, code)
  const formatInline = (text: string): React.ReactNode => {
    // Split by inline code first
    const codeParts = text.split(/(`[^`]+`)/g);

    return codeParts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-blue-600 dark:text-blue-300 font-mono text-[12.5px] border border-slate-200 dark:border-white/10"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Handle bold text (**text**)
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, j) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return (
            <strong key={`${i}-${j}`} className="font-semibold text-slate-900 dark:text-white">
              {bPart.slice(2, -2)}
            </strong>
          );
        }

        // Handle italic text (*text*)
        const italicParts = bPart.split(/(\*[^*]+\*)/g);
        return italicParts.map((iPart, k) => {
          if (iPart.startsWith('*') && iPart.endsWith('*') && !iPart.startsWith('**')) {
            return (
              <em key={`${i}-${j}-${k}`} className="italic opacity-95">
                {iPart.slice(1, -1)}
              </em>
            );
          }
          return iPart;
        });
      });
    });
  };

  // Parse lines into blocks
  const renderBlocks = () => {
    const lines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];
    let codeBlockCount = 0;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      // Code block start / end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim() || 'code';
          codeLines = [];
        } else {
          inCodeBlock = false;
          const codeString = codeLines.join('\n');
          const currentIdx = codeBlockCount++;
          blocks.push(
            <div
              key={`code-${currentIdx}`}
              className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#161a23] text-slate-100 font-mono text-xs shadow-md"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1f2430] border-b border-white/10 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider text-blue-300">
                  <Code className="w-3.5 h-3.5" />
                  {codeLanguage}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, currentIdx)}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[11px]"
                >
                  {copiedIndex === currentIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto leading-relaxed scrollbar-thin">
                <code>{codeString}</code>
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        blocks.push(<div key={`empty-${idx}`} className="h-2" />);
        continue;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        blocks.push(
          <h3
            key={`h3-${idx}`}
            className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white mt-4 mb-2 flex items-center gap-2"
          >
            {formatInline(trimmed.slice(4))}
          </h3>
        );
        continue;
      }

      if (trimmed.startsWith('## ')) {
        blocks.push(
          <h2
            key={`h2-${idx}`}
            className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-5 mb-2.5"
          >
            {formatInline(trimmed.slice(3))}
          </h2>
        );
        continue;
      }

      if (trimmed.startsWith('# ')) {
        blocks.push(
          <h1
            key={`h1-${idx}`}
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3"
          >
            {formatInline(trimmed.slice(2))}
          </h1>
        );
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        blocks.push(
          <blockquote
            key={`quote-${idx}`}
            className="my-2.5 border-l-4 border-blue-500 pl-3.5 py-1.5 bg-blue-50/60 dark:bg-blue-950/30 text-slate-800 dark:text-blue-100 rounded-r-xl text-sm leading-relaxed"
          >
            {formatInline(trimmed.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Bullet points (•, *, -)
      if (/^[•*\-]\s+/.test(trimmed)) {
        const itemContent = trimmed.replace(/^[•*\-]\s+/, '');
        blocks.push(
          <div key={`bullet-${idx}`} className="flex items-start gap-2.5 my-1 text-sm leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
            <div className="flex-1">{formatInline(itemContent)}</div>
          </div>
        );
        continue;
      }

      // Numbered lists (1. , 2. )
      if (/^\d+\.\s+/.test(trimmed)) {
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          blocks.push(
            <div key={`num-${idx}`} className="flex items-start gap-2.5 my-1 text-sm leading-relaxed">
              <span className="font-semibold text-blue-600 dark:text-blue-400 min-w-[20px] shrink-0 text-right">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{formatInline(numMatch[2])}</div>
            </div>
          );
          continue;
        }
      }

      // Regular paragraph
      blocks.push(
        <p key={`p-${idx}`} className="text-sm leading-relaxed my-1.5 text-slate-800 dark:text-slate-200">
          {formatInline(trimmed)}
        </p>
      );
    }

    return blocks;
  };

  return <div className="space-y-0.5">{renderBlocks()}</div>;
};
