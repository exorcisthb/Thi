import React from 'react';

interface FormattedExplanationProps {
  explanation?: string;
  className?: string;
  hideHeader?: boolean;
}

// Simple inline parser for **bold** and `code`
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Check for inline code `...`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={keyIdx++}
          className="bg-blue-100/90 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs font-mono font-semibold border border-blue-200/60 dark:border-blue-700/60"
        >
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

    // Check for italic *...*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(
        <em key={keyIdx++} className="italic text-gray-800 dark:text-gray-200">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Regular char
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}

export function FormattedExplanation({
  explanation,
  className = '',
  hideHeader = false,
}: FormattedExplanationProps): React.ReactElement | null {
  if (!explanation || !explanation.trim()) return null;

  // Normalize: ensure newlines before structured cues if stuck together
  let normalized = explanation
    .replace(/([^\n])\s*(📖\s*\*{0,2}Dịch(?:\s+câu\s+hỏi)?:?\*{0,2})/g, '$1\n\n$2')
    .replace(/([^\n])\s*(🔑\s*\*{0,2}Từ\s+khóa(?:\s+nhận\s+diện)?:?\*{0,2})/g, '$1\n\n$2')
    .replace(/([^\n])\s*(💡\s*\*{0,2}Giải\s+thích(?:\s+chi\s+tiết)?:?\*{0,2})/g, '$1\n\n$2');

  const paragraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const hasStructuredSections = paragraphs.some(
    (p) =>
      /^(?:📖\s*)?\*{0,2}Dịch(?:\s+câu\s+hỏi)?\s*:?\*{0,2}/i.test(p) ||
      /^(?:🔑\s*)?\*{0,2}Từ\s+khóa(?:\s+nhận\s+diện)?\s*:?\*{0,2}/i.test(p) ||
      /^(?:💡\s*)?\*{0,2}Giải\s+thích(?:\s+chi\s+tiết)?\s*:?\*{0,2}/i.test(p)
  );

  return (
    <div className={`text-sm text-blue-900 dark:text-blue-200 leading-relaxed ${className}`}>
      {!hideHeader && !hasStructuredSections && (
        <div className="font-bold flex items-center gap-1.5 mb-2 text-blue-700 dark:text-blue-400">
          <span className="text-base">💡</span>
          <span>Giải thích:</span>
        </div>
      )}

      <div className="space-y-2.5">
        {paragraphs.map((p, idx) => {
          // 1. Dịch câu hỏi
          const mTrans = p.match(/^(?:📖\s*)?\*{0,2}Dịch(?:\s+câu\s+hỏi)?\s*:?\*{0,2}\s*(.*)$/i);
          if (mTrans && mTrans[1]) {
            return (
              <div
                key={idx}
                className="p-3 bg-blue-100/70 dark:bg-blue-900/30 rounded-xl border border-blue-200/80 dark:border-blue-800/50 shadow-2xs"
              >
                <div className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className="text-base">📖</span>
                  <span>Dịch câu hỏi:</span>
                </div>
                <div className="text-sm text-blue-950 dark:text-blue-100 leading-relaxed">
                  {parseInline(mTrans[1])}
                </div>
              </div>
            );
          }

          // 2. Từ khóa nhận diện
          const mKey = p.match(/^(?:🔑\s*)?\*{0,2}Từ\s+khóa(?:\s+nhận\s+diện)?\s*:?\*{0,2}\s*(.*)$/i);
          if (mKey && mKey[1]) {
            return (
              <div
                key={idx}
                className="p-3 bg-amber-50/90 dark:bg-amber-950/25 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shadow-2xs"
              >
                <div className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className="text-base">🔑</span>
                  <span>Từ khóa nhận diện:</span>
                </div>
                <div className="text-sm text-amber-950 dark:text-amber-100 leading-relaxed font-medium">
                  {parseInline(mKey[1])}
                </div>
              </div>
            );
          }

          // 3. Giải thích chi tiết
          const mExp = p.match(/^(?:💡\s*)?\*{0,2}Giải\s+thích(?:\s+chi\s+tiết)?\s*:?\*{0,2}\s*(.*)$/i);
          if (mExp && mExp[1]) {
            return (
              <div
                key={idx}
                className="p-3 bg-emerald-50/80 dark:bg-emerald-950/25 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 shadow-2xs"
              >
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className="text-base">💡</span>
                  <span>Giải thích chi tiết:</span>
                </div>
                <div className="text-sm text-emerald-950 dark:text-emerald-100 leading-relaxed">
                  {parseInline(mExp[1])}
                </div>
              </div>
            );
          }

          // 4. Bullet points
          if (p.startsWith('• ') || p.startsWith('- ')) {
            const bulletText = p.replace(/^[-•]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-blue-500 font-bold shrink-0">•</span>
                <div className="flex-1 leading-relaxed">{parseInline(bulletText)}</div>
              </div>
            );
          }

          // 5. Standard paragraph
          return (
            <div key={idx} className="leading-relaxed whitespace-pre-line">
              {parseInline(p)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
