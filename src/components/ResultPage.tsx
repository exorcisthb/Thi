import { useState } from 'react';
import type { ExamResult, Question } from '../types';

interface ResultPageProps {
  result: ExamResult;
  questions: Question[];
  onRetry: () => void;
  onBack: () => void;
}

export default function ResultPage({ result, questions, onRetry, onBack }: ResultPageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [scale, setScale] = useState(result.scale || 10);

  // Sử dụng usedQuestions từ result nếu có (câu hỏi đã shuffle), fallback về questions prop
  const displayQuestions = result.usedQuestions || questions;

  // Tinh diem theo thang da chon
  const percentage = result.totalWeight > 0 ? result.earnedWeight / result.totalWeight : 0;
  const finalScore = Math.round(percentage * scale * 100) / 100;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} phút ${s} giây`;
  };

  // Du lieu cho bieu do tron SVG
  const chartSize = 160;
  const strokeWidth = 20;
  const radius = (chartSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const correctOffset = circumference * (1 - percentage);
  const center = chartSize / 2;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Diem so tong */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Kết quả bài thi
        </h2>

        {/* Bieu do tron va diem */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative" style={{ width: chartSize, height: chartSize }}>
            <svg width={chartSize} height={chartSize} className="transform -rotate-90">
              {/* Nen xam */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-gray-200 dark:text-gray-700"
              />
              {/* Phan dung */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={correctOffset}
                strokeLinecap="round"
                className="text-green-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {Math.round(percentage * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Thông tin chi tiết */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-6">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{result.correctCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Đúng</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{result.totalCount - result.correctCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sai</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{result.totalCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Tổng số</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{formatTime(result.timeTaken)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Thời gian</div>
          </div>
        </div>

        {/* Thang điểm */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Thang diem:
          </label>
          <select
            value={scale}
            onChange={(e) => setScale(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value={10}>Thang 10</option>
            <option value={100}>Thang 100</option>
          </select>
          <span className="text-2xl font-bold text-blue-600">{finalScore}/{scale}</span>
        </div>

        {/* Bieu do thanh */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span className="w-12">Đúng</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full transition-all"
                style={{ width: `${(result.correctCount / result.totalCount) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right">{result.correctCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="w-12">Sai</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-red-500 h-4 rounded-full transition-all"
                style={{ width: `${((result.totalCount - result.correctCount) / result.totalCount) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right">{result.totalCount - result.correctCount}</span>
          </div>
        </div>

        {/* Nut actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={onRetry}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Làm lại
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
          >
            {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết'}
          </button>
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
          >
            Về quản lý
          </button>
        </div>
      </div>

      {/* Bang chi tiet CHỈ các câu SAI */}
      {showDetails && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Chi tiết các câu sai ({result.totalCount - result.correctCount} câu)
          </h3>
          {displayQuestions.map((q, idx) => {
            const detail = result.details.find((d) => d.questionId === q.id);
            // CHỈ hiển thị câu SAI
            if (!detail || detail.isCorrect) return null;
            
            const selectedAnswersText = detail.selectedAnswers.length > 0 
              ? detail.selectedAnswers.join(', ') 
              : '(Chưa chọn)';
            const correctAnswersText = detail.correctAnswers.join(', ');
            
            return (
              <div
                key={q.id}
                className="p-4 rounded-xl border-2 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
              >
                <p className="font-semibold text-gray-900 dark:text-white mb-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Câu {idx + 1}:</span>{' '}
                  {q.content}
                </p>
                
                <div className="space-y-2 mb-3">
                  <div className="text-sm">
                    <span className="font-medium text-red-600 dark:text-red-400">Bạn chọn:</span>
                    <span className="ml-2 text-gray-700 dark:text-gray-300">{selectedAnswersText}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-green-600 dark:text-green-400">Đáp án đúng:</span>
                    <span className="ml-2 text-gray-700 dark:text-gray-300">{correctAnswersText}</span>
                  </div>
                </div>

                {/* Hiển thị nội dung các đáp án bạn chọn */}
                {detail.selectedAnswers.length > 0 && (
                  <div className="mb-3 p-3 bg-red-100/60 dark:bg-red-950/30 rounded-lg border border-red-200/60 dark:border-red-800/40">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">
                      ✗ Nội dung đáp án bạn chọn:
                    </p>
                    <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {(Object.keys(q.options) as Array<keyof typeof q.options>)
                        .filter((k) => detail.selectedAnswers.includes(k) && q.options[k])
                        .map((k) => (
                          <div key={k}>
                            <span className="font-medium text-red-600 dark:text-red-400">{k}.</span>{' '}
                            {q.options[k]}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Hiển thị nội dung các đáp án đúng */}
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">✓ Nội dung đáp án đúng:</p>
                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {(Object.keys(q.options) as Array<keyof typeof q.options>)
                      .filter((k) => detail.correctAnswers.includes(k))
                      .map((k) => (
                        <div key={k}>
                          <span className="font-medium text-green-600 dark:text-green-400">{k}.</span>{' '}
                          {q.options[k]}
                        </div>
                      ))}
                  </div>
                </div>

                {q.explanation && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">💡 Giải thích:</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
          {result.totalCount - result.correctCount === 0 && (
            <div className="text-center p-8 bg-green-50 dark:bg-green-900/10 rounded-xl">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-lg font-medium text-green-600 dark:text-green-400">
                Hoàn hảo! Không có câu nào sai!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
