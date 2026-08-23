import React from 'react';
import type { Question } from '../types';
import { getCorrectAnswers } from '../types';

const STOP_WORDS = new Set([
  // English common words & prompt words
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without',
  'before', 'under', 'around', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'might', 'must',
  'shall', 'will', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'select', 'apply', 'all', 'that', 'this', 'these', 'those', 'their', 'they', 'them', 'it', 'its',
  'order', 'following', 'true', 'false', 'correct', 'statement', 'best', 'main', 'typical', 'would',
  
  // Vietnamese common words
  'là', 'và', 'hoặc', 'nhưng', 'của', 'trong', 'trên', 'tại', 'cho', 'với', 'bởi', 'từ', 'như',
  'được', 'bị', 'có', 'không', 'những', 'các', 'một', 'này', 'kia', 'đó', 'câu', 'hỏi', 'đáp', 'án',
  'chọn', 'đúng', 'sai', 'nào', 'dưới', 'đây', 'thì', 'sẽ', 'đã', 'đang'
]);

/**
 * Trích xuất tự động danh sách từ khóa (keywords) của một câu hỏi.
 * Ưu tiên:
 * 1. Thuộc tính keywords thủ công nếu có.
 * 2. Cụm từ viết hoa / thuật ngữ chuyên ngành (vd: Business Intelligence Analyst).
 * 3. Các từ trùng lặp giữa câu hỏi và đáp án đúng.
 */
export function extractKeywords(question: Question): string[] {
  if (question.keywords && question.keywords.length > 0) {
    const custom = question.keywords.map((k) => k.trim()).filter(Boolean);
    if (custom.length > 0) return custom;
  }

  const keywordsSet = new Set<string>();

  // 1. Tìm các cụm từ viết hoa (viết hoa chữ cái đầu hoặc viết tắt)
  const capitalizedPhrases = question.content.match(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)+\b/g);
  if (capitalizedPhrases) {
    for (const phrase of capitalizedPhrases) {
      if (phrase.length >= 4) {
        keywordsSet.add(phrase);
      }
    }
  }

  // 2. Tìm các từ xuất hiện ở CẢ câu hỏi VÀ đáp án đúng
  const correctKeys = getCorrectAnswers(question);
  const correctTexts = correctKeys.map((k) => question.options[k] || '').join(' ').toLowerCase();

  const questionWords = question.content
    .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  for (const word of questionWords) {
    if (correctTexts.includes(word.toLowerCase())) {
      keywordsSet.add(word);
    }
  }

  // 3. Nếu còn ít từ khóa, lấy thêm các từ đặc trưng dài (>= 4 ký tự) trong câu hỏi
  if (keywordsSet.size < 2) {
    for (const word of questionWords) {
      if (word.length >= 4) {
        keywordsSet.add(word);
        if (keywordsSet.size >= 4) break;
      }
    }
  }

  return Array.from(keywordsSet);
}

/**
 * Escape các ký tự đặc biệt cho Regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Component render text có in đậm + tô màu highlight cho các từ khóa.
 */
export function HighlightedText({
  text,
  keywords,
  className = '',
  enabled = true,
}: {
  text: string;
  keywords: string[];
  className?: string;
  enabled?: boolean;
}): React.ReactElement {
  if (!enabled || !text || !keywords || keywords.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Loại bỏ từ khóa rỗng và sắp xếp từ dài nhất lên trước để tránh match đè từ ngắn
  const validKeywords = Array.from(
    new Set(keywords.map((k) => k.trim()).filter((k) => k.length >= 2))
  ).sort((a, b) => b.length - a.length);

  if (validKeywords.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(`(${validKeywords.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatched = validKeywords.some(
          (k) => k.toLowerCase() === part.toLowerCase()
        );
        if (isMatched) {
          return (
            <mark
              key={index}
              className="font-extrabold text-amber-950 dark:text-amber-100 bg-amber-300 dark:bg-amber-700/90 px-1.5 py-0.5 rounded shadow-sm border-b-2 border-amber-500 dark:border-amber-400 mx-0.5 inline-block"
              title="Từ key của câu hỏi"
            >
              {part}
            </mark>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}
