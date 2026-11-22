import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, QuestionContext } from '../utils/gemini';
import { sendGeminiChatMessage } from '../utils/gemini';

// Simple Markdown parser for bold, italic, code, lists and linebreaks
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        // Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const itemText = line.trim().replace(/^[-*]\s+/, '');
          return (
            <div key={i} className="flex items-start space-x-2 pl-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span>{parseInline(itemText)}</span>
            </div>
          );
        }
        // Numbered list
        if (/^\d+\.\s+/.test(line.trim())) {
          const num = line.trim().match(/^(\d+\.)\s+/)?.[1];
          const itemText = line.trim().replace(/^\d+\.\s+/, '');
          return (
            <div key={i} className="flex items-start space-x-2 pl-2">
              <span className="text-indigo-500 font-bold">{num}</span>
              <span>{parseInline(itemText)}</span>
            </div>
          );
        }
        // Headers (###, ##, #)
        if (line.trim().startsWith('#')) {
          const headerLevel = line.match(/^#+/)?.[0].length || 1;
          const headerText = line.replace(/^#+\s*/, '');
          const sizeClass = headerLevel === 1 ? 'text-base font-bold' : 'text-sm font-bold text-indigo-600 dark:text-indigo-400';
          return (
            <div key={i} className={`${sizeClass} mt-2 mb-1`}>
              {parseInline(headerText)}
            </div>
          );
        }
        // Empty line
        if (!line.trim()) {
          return <div key={i} className="h-1" />;
        }
        // Regular line
        return <div key={i}>{parseInline(line)}</div>;
      })}
    </div>
  );
}

function parseInline(text: string): React.ReactNode {
  // Bold **text** and inline `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Check for inline code `...`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={keyIdx++} className="bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 px-1 py-0.5 rounded text-xs font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Check for bold **...**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-gray-900 dark:text-gray-100">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Regular char
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Dọn dẹp key cũ trong localStorage nếu có
    try {
      localStorage.removeItem('quiz-app-chat-history');
    } catch {
      // ignore
    }

    // Đọc lịch sử chat từ sessionStorage (chỉ lưu trong session tab hiện tại, mất khi đóng tab/trình duyệt)
    try {
      const saved = sessionStorage.getItem('quiz-app-session-chat-history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'welcome',
        role: 'model',
        text: 'Xin chào bạn! Mình là **Trợ lý Học tập AI** được tích hợp mô hình **Gemini 2.5 Flash**.\n\nTrong lúc ôn luyện hoặc làm bài thi, nếu gặp câu nào **chưa hiểu rõ bản chất, thắc mắc vì sao đáp án đúng/sai, hoặc muốn mẹo nhớ nhanh**, bạn cứ bấm nút **"Hỏi AI"** hoặc nhắn trực tiếp cho mình ở đây nhé!',
        timestamp: Date.now(),
      },
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<QuestionContext | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customKey, setCustomKey] = useState(() => localStorage.getItem('quiz-app-custom-gemini-key') || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Lưu lịch sử chat vào sessionStorage (chỉ tồn tại trong session của tab hiện tại, mất khi tắt tab/trình duyệt)
  useEffect(() => {
    try {
      sessionStorage.setItem('quiz-app-session-chat-history', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Listen to custom event when user clicks "Hỏi AI về câu này" from any component
  useEffect(() => {
    const handleAskAi = (event: CustomEvent<any>) => {
      const detail = event.detail;
      if (!detail) return;

      const q = detail.question;
      const ctx: QuestionContext = {
        subject: detail.subject || q?.subject,
        setName: detail.setName,
        questionNumber: detail.questionIndex || detail.questionNumber,
        content: q?.content,
        options: q?.options,
        correctAnswer: q?.correctAnswer,
        correctAnswers: q?.correctAnswers,
        explanation: q?.explanation,
        imageUrl: q?.imageUrl,
      };

      // Cập nhật ngữ cảnh câu hỏi trong nền, KHÔNG tự động mở chatbot khi chuyển câu
      setCurrentContext(ctx);

      // Chỉ mở chatbot khi người dùng bấm trực tiếp vào nút "Hỏi AI" (autoAsk = true)
      if (detail.autoAsk) {
        setIsOpen(true);
        const promptToAsk = detail.prompt || `Giải thích trọng tâm câu số ${ctx.questionNumber || ''}: vì sao đáp án chính thức là đúng và vì sao các phương án khác sai?`;
        doSendMessage(promptToAsk, ctx);
      }
    };

    window.addEventListener('quiz-ask-ai' as any, handleAskAi);
    return () => {
      window.removeEventListener('quiz-ask-ai' as any, handleAskAi);
    };
  }, []);

  const doSendMessage = async (textToSend: string, ctxOverride?: QuestionContext | null) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setRetryStatus(null);

    try {
      const activeCtx = ctxOverride !== undefined ? ctxOverride : currentContext;
      const reply = await sendGeminiChatMessage(
        newMessages.map((m) => ({ role: m.role, text: m.text })),
        activeCtx,
        customKey || undefined,
        (attempt, max, msg) => {
          setRetryStatus(msg || `Đang tự động thử lại kết nối (lần ${attempt}/${max})...`);
        }
      );

      const aiMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: reply,
        timestamp: Date.now(),
      };
      setMessages([...newMessages, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Không thể kết nối Gemini:** ${err?.message || 'Không thể kết nối đến Gemini sau 3 lần thử.'}\n\n*Gợi ý:* Hãy kiểm tra kết nối mạng hoặc nhập API key cá nhân từ [Google AI Studio](https://aistudio.google.com/apikey) trong phần Cài đặt (biểu tượng bánh răng ở góc trên).`,
        timestamp: Date.now(),
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
      setRetryStatus(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSendMessage(input);
    }
  };

  const clearChat = () => {
    if (window.confirm('Bạn có muốn xóa toàn bộ lịch sử trò chuyện không?')) {
      const welcome: ChatMessage = {
        id: 'welcome',
        role: 'model',
        text: 'Cuộc trò chuyện đã được làm mới. Hãy chọn câu hỏi hoặc gửi tin nhắn cho mình nhé!',
        timestamp: Date.now(),
      };
      setMessages([welcome]);
      try {
        sessionStorage.removeItem('quiz-app-session-chat-history');
        localStorage.removeItem('quiz-app-chat-history');
      } catch {
        // ignore
      }
    }
  };

  const saveCustomKey = (key: string) => {
    setCustomKey(key);
    localStorage.setItem('quiz-app-custom-gemini-key', key.trim());
    setShowSettings(false);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser && !loading) {
      const filtered = messages.filter((m) => !m.text.startsWith('⚠️'));
      setMessages(filtered);
      doSendMessage(lastUser.text);
    }
  };

  return (
    <>
      {/* FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 text-white font-medium shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 group border border-white/20 backdrop-blur-sm"
          title="Hỏi AI Gemini 2.5 Flash"
        >
          <div className="relative">
            <span className="text-xl">🤖</span>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold leading-none">Hỏi AI Gia Sư</span>
            <span className="text-[10px] text-emerald-100 font-mono leading-tight mt-0.5">Gemini 2.5 Flash</span>
          </div>
        </button>
      )}

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] sm:w-[440px] h-[600px] max-h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-4 py-3 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-lg shadow-inner">
                🤖
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-sm tracking-wide">Trợ Lý AI Gia Sư</span>
                  <span className="bg-emerald-400/30 text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-emerald-300/40">
                    gemini-2.5-flash
                  </span>
                </div>
                <div className="text-[10px] text-emerald-100 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  <span>Đã kết nối Google Gemini API</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/90 hover:text-white"
                title="Cài đặt API Key"
              >
                ⚙️
              </button>
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/90 hover:text-white"
                title="Làm mới cuộc trò chuyện"
              >
                🗑️
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/90 hover:text-white text-base font-bold"
                title="Thu nhỏ"
              >
                ✕
              </button>
            </div>
          </div>

          {/* SETTINGS OVERLAY */}
          {showSettings && (
            <div className="bg-amber-50 dark:bg-gray-800 p-3 border-b border-amber-200 dark:border-gray-700 text-xs space-y-2">
              <div className="font-semibold text-gray-800 dark:text-gray-200 flex justify-between items-center">
                <span>Cấu hình Gemini API Key</span>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Key mặc định được tự động đọc từ file <code>.env</code> (VITE_GEMINI_API_KEY). Bạn có thể ghi đè bằng key cá nhân nếu muốn:
              </p>
              <div className="flex space-x-1.5">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs"
                />
                <button
                  onClick={() => saveCustomKey(customKey)}
                  className="px-3 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700"
                >
                  Lưu
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE QUESTION CONTEXT BANNER */}
          {currentContext && (currentContext.content || currentContext.imageUrl) && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
              <div className="flex-1 mr-2 truncate flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  [{currentContext.subject || 'Câu hỏi'}] {currentContext.questionNumber ? `Câu ${currentContext.questionNumber}` : ''}
                </span>
                {currentContext.imageUrl && (
                  <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold px-1.5 py-0.2 rounded-full border border-purple-200 dark:border-purple-800">
                    📷 Kèm ảnh đề
                  </span>
                )}
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate inline-block max-w-[170px] align-bottom">
                  {currentContext.content ? currentContext.content.replace(/^BPS301\s*-\s*Câu\s*\d+:\s*/i, '') : 'Ảnh câu hỏi'}
                </span>
              </div>
              <button
                onClick={() => setCurrentContext(null)}
                className="text-gray-400 hover:text-gray-600 text-xs px-1"
                title="Bỏ ngữ cảnh câu hỏi"
              >
                ✕
              </button>
            </div>
          )}

          {/* MESSAGES BODY */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-gray-50/50 dark:bg-gray-900/50">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start space-x-2 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                        : 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {isUser ? '👤' : '🤖'}
                  </div>

                  <div className={`group relative max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block p-3 rounded-2xl text-left shadow-sm ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                      ) : (
                        renderMarkdown(m.text)
                      )}
                    </div>

                    {m.text.startsWith('⚠️') && !loading && (
                      <div className="mt-2 flex items-center space-x-2">
                        <button
                          onClick={handleRetryLast}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95"
                        >
                          <span>🔄</span>
                          <span>Thử lại ngay</span>
                        </button>
                      </div>
                    )}

                    {!isUser && m.id !== 'welcome' && (
                      <div className="mt-1 flex items-center space-x-2 text-[10px] text-gray-400 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyMessage(m.id, m.text)}
                          className="hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          {copiedId === m.id ? '✓ Đã sao chép' : 'Sao chép'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start space-x-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs flex-shrink-0">
                  🤖
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-medium">
                    {retryStatus || 'Gemini đang phân tích và chuẩn bị câu trả lời...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK PROMPTS (When Question Context Exists) */}
          {currentContext && currentContext.content && (
            <div className="px-3 py-1.5 bg-gray-100/70 dark:bg-gray-800/70 border-t border-gray-200/50 dark:border-gray-700/50 flex space-x-1.5 overflow-x-auto no-scrollbar">
              <button
                disabled={loading}
                onClick={() => doSendMessage('Giải thích chi tiết vì sao chọn đáp án này và bản chất của câu hỏi?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition shadow-2xs"
              >
                💡 Vì sao đúng?
              </button>
              <button
                disabled={loading}
                onClick={() => doSendMessage('Phân tích vì sao các đáp án còn lại sai hoặc bẫy thường gặp ở câu này?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-[11px] font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-2xs"
              >
                🔍 Vì sao các đáp án khác sai?
              </button>
              <button
                disabled={loading}
                onClick={() => doSendMessage('Tóm tắt lý thuyết trọng tâm và mẹo ghi nhớ nhanh câu này khi đi thi?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-gray-700 border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition shadow-2xs"
              >
                📌 Mẹo nhớ khi thi
              </button>
              <button
                disabled={loading}
                onClick={() => doSendMessage('Mở rộng: Trong trường hợp đề thi đổi câu hỏi hoặc tình huống như thế nào thì sẽ chọn các phương án còn lại (khi nào chọn A, B, C, D)?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 text-[11px] font-medium hover:bg-amber-50 dark:hover:bg-amber-900/30 transition shadow-2xs"
              >
                🔄 Khi nào chọn đáp án khác?
              </button>
            </div>
          )}

          {/* INPUT FORM */}
          <form onSubmit={handleSubmit} className="p-2.5 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-end space-x-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi Gemini 2.5 Flash về câu hỏi này..."
              disabled={loading}
              className="flex-1 max-h-24 p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-snug"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center shadow-md"
              title="Gửi câu hỏi"
            >
              <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
