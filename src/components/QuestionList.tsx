import { getImageUrl } from '../utils/imageUrl';
import type { Question } from '../types';
import { getCorrectAnswers } from '../types';

interface QuestionListProps {
  questions: Question[];
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
}

export default function QuestionList({ questions, onEdit, onDelete }: QuestionListProps) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Chưa có câu hỏi nào. Hãy thêm câu hỏi ở trên.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Danh sách câu hỏi ({questions.length})
      </h2>
      {questions.map((q, idx) => {
        const correctList = getCorrectAnswers(q);
        const ansLabel = q.answerNote === 'Xem trên ảnh' ? 'Xem trên ảnh' : correctList.join(', ');

        return (
          <div
            key={q.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Câu {idx + 1}:</span>
                  {q.imageUrl && (
                    <span className="text-[11px] bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      📷 Có ảnh đề thi
                    </span>
                  )}
                  {q.answerNote === 'Xem trên ảnh' && (
                    <span className="text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                      Đáp án trên ảnh
                    </span>
                  )}
                </div>
                
                <p className="font-medium text-gray-900 dark:text-white mb-3 leading-relaxed">
                  {q.content}
                </p>

                {/* Thumbnail ảnh (nếu có) */}
                {q.imageUrl && (
                  <div className="mb-3 max-w-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-slate-900 p-1.5">
                    <img
                      src={getImageUrl(q.imageUrl)}
                      alt={`Ảnh câu ${idx + 1}`}
                      loading="lazy"
                      className="max-h-36 w-auto mx-auto object-contain rounded"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm mb-3">
                  {(Object.keys(q.options) as Array<keyof typeof q.options>).filter((k) => q.options[k] && q.options[k].trim()).map((key) => {
                    const isCorrect = correctList.includes(key);
                    return (
                      <div
                        key={key}
                        className={`px-2.5 py-1.5 rounded-lg border transition-colors ${
                          isCorrect
                            ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200 font-medium'
                            : 'border-transparent text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40'
                        }`}
                      >
                        <span className="font-bold mr-1">{key}.</span>
                        {q.options[key]}
                        {isCorrect && <span className="ml-1 text-green-600 font-bold">✓</span>}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Trọng số: {q.weight}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Đáp án: {ansLabel}</span>
                  {q.explanation && <span className="truncate">Giải thích: {q.explanation}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => onEdit(q)}
                  className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  Sửa
                </button>
                <button
                  onClick={() => onDelete(q.id)}
                  className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
