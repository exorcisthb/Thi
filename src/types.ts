// Kiểu cho đáp án A/B/C/D/E (hỗ trợ linh hoạt 4 hoặc 5 đáp án)
export type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E';

// Cấu trúc một câu hỏi
export interface Question {
  id: string;
  content: string;          // Nội dung câu hỏi
  options: Record<AnswerKey, string>;  // 4 hoặc 5 đáp án
  correctAnswer: AnswerKey; // Đáp án đúng (chính)
  correctAnswers?: AnswerKey[]; // Danh sách nhiều đáp án đúng (câu "Select all that apply")
  weight: number;           // Trọng số điểm
  explanation: string;      // Giải thích đáp án
  keywords?: string[];      // Từ khóa (Key words) của câu hỏi
  imageUrl?: string;        // Đường dẫn hình ảnh đề thi (nếu có)
  answerNote?: string;      // Ghi chú đáp án (ví dụ: 'Xem trên ảnh')
}

// Lấy danh sách các đáp án đúng (1 hoặc nhiều)
export function getCorrectAnswers(q: Question): AnswerKey[] {
  if (q.correctAnswers && q.correctAnswers.length > 0) return q.correctAnswers;
  return [q.correctAnswer];
}

// Một bộ câu hỏi (có tên riêng)
export interface QuestionSet {
  id: string;
  name: string;
  subject?: string;        // Tên môn học (để nhóm trong dashboard)
  questions: Question[];
  createdAt: number;
}

// Lấy môn học của một bộ câu hỏi (mặc định "Khac")
export function getSubject(s: QuestionSet): string {
  return s.subject && s.subject.trim() ? s.subject.trim() : 'Khác';
}

// Các chế độ của app
export type AppMode = 'manage' | 'study' | 'exam' | 'result';

// Kiểu hiển thị khi thi: cuộn hoặc từng câu
export type ExamViewMode = 'scroll' | 'single';

// Chi tiết kết quả từng câu
export interface AnswerDetail {
  questionId: string;
  selectedAnswers: AnswerKey[];   // Các lựa chọn của thí sinh
  correctAnswers: AnswerKey[];    // Các đáp án đúng
  isCorrect: boolean;
  weight: number;
  earned: number;
}

// So sánh 2 tập đáp án
export function answersEqual(a: AnswerKey[], b: AnswerKey[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

// Kết quả bài thi
export interface ExamResult {
  details: AnswerDetail[];
  score: number;           // Điểm tổng
  totalWeight: number;     // Tổng trọng số
  earnedWeight: number;    // Trọng số đạt được
  correctCount: number;    // Số câu đúng
  totalCount: number;      // Tổng số câu
  scale: number;           // Thang điểm (10 hoặc 100)
  timeTaken: number;       // Thời gian làm bài (giây)
  usedQuestions?: Question[]; // Câu hỏi đã sử dụng
}

// Lịch sử thi thử
export interface ExamHistory {
  id: string;              // ID unique của lần thi
  setId: string;           // ID của bộ câu hỏi
  setName: string;         // Tên bộ câu hỏi
  timestamp: number;       // Thời điểm thi
  result: ExamResult;      // Kết quả thi
}
