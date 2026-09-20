import React, { useState } from 'react';
import { User, Sparkles, Copy, Check, FileText, AlignLeft, Layers } from 'lucide-react';
import { Conversation, Message } from '../types';
import { ExportService } from '../services/ExportService';
import { formatDate, formatNumber } from '../utils/formatting';

interface ChatWindowProps {
  conversation: Conversation;
  isProcessing: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversation, isProcessing }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = async (msg: Message) => {
    const ok = await ExportService.copyToClipboard(msg.content);
    if (ok) {
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div id="chat-stream-container" className="space-y-4">
      {conversation.messages.map((msg) => {
        const isUser = msg.role === 'user';
        const isSummary = msg.type === 'summary';
        const isParagraph = msg.type === 'paragraph';

        return (
          <div
            key={msg.id}
            id={`message-bubble-${msg.id}`}
            className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="w-8 h-8 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-4 sm:p-5 transition-colors ${
                isUser
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/10 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      isUser ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isUser ? 'You' : isParagraph ? 'Cohesive Paragraph' : 'Local AI Summary'}
                  </span>
                  {msg.metadata?.wordCount && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isUser
                          ? 'bg-blue-700/60 text-blue-200'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatNumber(msg.metadata.wordCount)} words
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] ${
                      isUser ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {formatDate(msg.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg)}
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${
                      isUser ? 'text-blue-100' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Copy message content"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Message Content */}
              <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {msg.type === 'original' && msg.content.length > 500 ? (
                  <div>
                    <div className="font-mono text-xs opacity-80 mb-2">
                      [Document input: {formatNumber(msg.content.length)} characters]
                    </div>
                    <div className="line-clamp-6 opacity-90">{msg.content}</div>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>

            {isUser && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
