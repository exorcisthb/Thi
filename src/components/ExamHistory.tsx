import { useState } from 'react';
import type { ExamHistory } from '../types';
import { loadExamHistory, deleteExamHistory, clearExamHistory } from '../utils/storage';

interface ExamHistoryProps {
  setId: string;
  setName: string;
  onViewResult: (history: ExamHistory) => void;
  onBack: () => void;
}

export default function ExamHistory({ setId, setName, onViewResult, onBack }: ExamHistoryProps) {
  const [histories, setHistories] = useState<ExamHistory[]>(() => {
    const all = loadExamHistory();
    // Lọc chỉ lấy lịch sử của bộ đề này
    return all.filter((h: ExamHistory) => h.setId === setId).reverse(); // Mới nhất trước
  });

  const handleDelete = (id: string) => {
    if (!window.confirm('Xóa lịch sử thi này?')) return;
    deleteExamHistory(id);
    setHistories((prev) => prev.filter((h) => h.id !== id));
  };

  const handleClearAll = () => {
    if (!window.confirm(`Xóa TẤT CẢ lịch sử thi của "${setName}"?`)) return;
    histories.forEach((h) => deleteExamHistory(h.id));
    setHistories([]);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              📋 Lịch sử thi thử
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {setName} • {histories.length} lần thi
            </p>
          </div>
          <div className="flex gap-2">
            {histories.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Xóa tất cả
              </button>
            )}
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              ← Quay lại
            </button>
          </div>
        </div>

        {histories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-500 dark:text-gray-400">
              Chưa có lịch sử thi nào. Hãy làm bài thi thử để lưu kết quả!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {histories.map((history, idx) => {
              const percentage = history.result.totalWeight > 0
                ? (history.result.earnedWeight / history.result.totalWeight) * 100
                : 0;
              const scale = history.result.scale || 10;
              const finalScore = Math.round((percentage / 100) * scale * 100) / 100;

              return (
                <div
                  key={history.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          #{histories.length - idx}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(history.timestamp)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Điểm:</span>
                          <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
                            {finalScore}/{scale}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Đúng:</span>
                          <span className="ml-1 font-semibold text-green-600">
                            {history.result.correctCount}/{history.result.totalCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Tỷ lệ:</span>
                          <span className="ml-1 font-semibold">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Thời gian:</span>
                          <span className="ml-1 font-semibold">
                            {formatTime(history.result.timeTaken)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => onViewResult(history)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Xem chi tiết
                      </button>
                      <button
                        onClick={() => handleDelete(history.id)}
                        className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
