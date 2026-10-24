import type { QuestionSet, ExamHistory } from '../types';

const QUESTION_SETS_KEY = 'quiz-app-question-sets';
const DARK_MODE_KEY = 'quiz-app-dark-mode';

// Đọc danh sách bộ câu hỏi từ localStorage
export function loadQuestionSets(): QuestionSet[] {
  try {
    const data = localStorage.getItem(QUESTION_SETS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Lưu danh sách bộ câu hỏi vào localStorage (an toàn với quota)
export function saveQuestionSets(sets: QuestionSet[]): void {
  try {
    localStorage.setItem(QUESTION_SETS_KEY, JSON.stringify(sets));
  } catch (e) {
    console.warn('Không thể lưu questionSets vào localStorage (vượt dung lượng quota):', e);
  }
}

// Đọc trạng thái dark mode từ localStorage
export function loadDarkMode(): boolean {
  try {
    const data = localStorage.getItem(DARK_MODE_KEY);
    return data !== null ? JSON.parse(data) : false;
  } catch {
    return false;
  }
}

// Lưu trạng thái dark mode
export function saveDarkMode(isDark: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDark));
}

// Tạo ID duy nhất cho câu hỏi / bộ câu hỏi
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Lưu lịch sử thi thử
const EXAM_HISTORY_KEY = 'quiz-app-exam-history';

export function saveExamHistory(history: ExamHistory): void {
  try {
    const existing = loadExamHistory();
    existing.push(history);
    // Giới hạn chỉ lưu 100 lần thi gần nhất
    const limited = existing.slice(-100);
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(limited));
  } catch (e) {
    console.error('Error saving exam history:', e);
  }
}

export function loadExamHistory(): ExamHistory[] {
  try {
    const data = localStorage.getItem(EXAM_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteExamHistory(id: string): void {
  try {
    const existing = loadExamHistory();
    const filtered = existing.filter((h) => h.id !== id);
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting exam history:', e);
  }
}

export function clearExamHistory(): void {
  localStorage.removeItem(EXAM_HISTORY_KEY);
}
