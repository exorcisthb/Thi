import { getImageUrl } from '../utils/imageUrl';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Question, AnswerKey, ExamViewMode, ExamResult, AnswerDetail } from '../types';
import { answersEqual, getCorrectAnswers } from '../types';

interface ExamModeProps {
  questions: Question[];
  onSubmit: (result: ExamResult) => void;
}

export default function ExamMode({ questions, onSubmit }: ExamModeProps) {
  // Validate unique IDs (dev only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      const ids = questions.map(q => q.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
        console.error('⚠️ CẢNH BÁO: Phát hiện ID câu hỏi bị trùng!', {
          totalQuestions: ids.length,
          uniqueIds: uniqueIds.size,
          duplicateIds: [...new Set(duplicates)],
        });
      }
    }
  }, [questions]);

  const [currentIdx, setCurrentIdx] = useState(0);
  // Lưu nhiều đáp án đã chọn cho mỗi câu (Record<cauId, AnswerKey[]>) để hỗ trợ "Select all that apply"
  const [answers, setAnswers] = useState<Record<string, AnswerKey[]>>({});
  const [viewMode, setViewMode] = useState<ExamViewMode>('single');
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [timeLimit, setTimeLimit] = useState(15); // phút
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // giây
  const [isStarted, setIsStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false); // Đảo đáp án
  const [numQuestions, setNumQuestions] = useState(questions.length); // Số câu hỏi muốn làm
  const [displayQuestions, setDisplayQuestions] = useState<Question[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Hàm shuffle mảng
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Hàm đảo đáp án của một câu hỏi (random mỗi lần gọi)
  // QUAN TRỌNG: Giữ nguyên q.id để match với result.details khi chấm điểm
  const shuffleQuestionAnswers = (q: Question): Question => {
    // Lấy các key có nội dung
    const keys = (Object.keys(q.options) as AnswerKey[]).filter((k) => q.options[k].trim());
    const shuffledKeys = shuffleArray(keys);
    
    // Tạo mapping cũ -> mới
    const keyMap = new Map<AnswerKey, AnswerKey>();
    keys.forEach((oldKey, i) => {
      keyMap.set(oldKey, shuffledKeys[i]);
    });
    
    // Tạo options mới
    const newOptions: Record<AnswerKey, string> = { A: '', B: '', C: '', D: '', E: '' };
    keys.forEach((oldKey) => {
      const newKey = keyMap.get(oldKey)!;
      newOptions[newKey] = q.options[oldKey];
    });
    
    // Map correctAnswer và correctAnswers
    const newCorrectAnswer = keyMap.get(q.correctAnswer) || q.correctAnswer;
    const newCorrectAnswers = (q.correctAnswers || [q.correctAnswer]).map((k) => keyMap.get(k) || k);
    
    // Giữ nguyên id gốc (tất cả thay đổi chỉ là options và correctAnswer)
    return {
      ...q,
      options: newOptions,
      correctAnswer: newCorrectAnswer,
      correctAnswers: newCorrectAnswers,
    };
  };



  // Reset khi quay lai
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Xử lý phím tắt (chỉ trong chế độ single)
  useEffect(() => {
    if (!isStarted || viewMode !== 'single') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang focus vào input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const questionsToDisplay = displayQuestions.length > 0 ? displayQuestions : questions;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIdx < questionsToDisplay.length - 1) {
          jumpTo(currentIdx + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIdx > 0) {
          jumpTo(currentIdx - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStarted, viewMode, currentIdx, questions.length, displayQuestions]);

  const startExam = () => {
    setAnswers({});
    setCurrentIdx(0);
    setTimeRemaining(timeLimit * 60);
    setStartTime(Date.now());
    setIsStarted(true);
    setSubmitting(false);
    
    // Lấy N câu đầu tiên (từ 1 đến numQuestions)
    let selectedQuestions = questions.slice(0, numQuestions);
    
    // Áp dụng shuffle câu hỏi TRƯỚC (nếu bật)
    if (shuffleQuestions) {
      selectedQuestions = shuffleArray(selectedQuestions);
    }
    
    // Áp dụng đảo đáp án SAU (nếu bật) - random mỗi lần
    if (shuffleAnswers) {
      selectedQuestions = selectedQuestions.map((q) => shuffleQuestionAnswers(q));
    }
    
    setDisplayQuestions(selectedQuestions);
  };

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Dong ho dem gio
  useEffect(() => {
    if (!isStarted || !isTimerEnabled) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return stopTimer;
  }, [isStarted, isTimerEnabled, stopTimer]);

  // Het gio tu dong nop
  useEffect(() => {
    if (isStarted && isTimerEnabled && timeRemaining <= 0) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  // Toggle đáp án: nếu câu hỏi có nhiều đáp án đúng, người dùng chọn nhiều; còn lại chọn 1
  const handleSelect = (key: AnswerKey) => {
    const questionsToDisplay = displayQuestions.length > 0 ? displayQuestions : questions;
    const q = questionsToDisplay[currentIdx];
    const allCorrect = getCorrectAnswers(q);
    const multi = allCorrect.length > 1;
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (multi) {
        const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
        return { ...prev, [q.id]: next };
      }
      // Với câu 1 đáp án, KHÔNG tự động chuyển câu nữa
      return { ...prev, [q.id]: [key] };
    });
  };

  const jumpTo = (idx: number) => {
    setCurrentIdx(idx);
  };

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    stopTimer();

    const questionsToUse = displayQuestions.length > 0 ? displayQuestions : questions;
    const unansweredCount = questionsToUse.filter((q) => !answers[q.id] || answers[q.id].length === 0).length;

    if (unansweredCount > 0 && !submitting) {
      const confirmSubmit = window.confirm(
        `Còn ${unansweredCount} câu chưa trả lời. Bạn có chắc muốn nộp bài?`
      );
      if (!confirmSubmit) {
        setSubmitting(false);
        return;
      }
    }

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const details: AnswerDetail[] = questionsToUse.map((q) => {
      const selected = answers[q.id] ?? [];
      const correct = getCorrectAnswers(q);
      const isCorrect = answersEqual(selected, correct);
      return {
        questionId: q.id,
        selectedAnswers: selected,
        correctAnswers: correct,
        isCorrect,
        weight: q.weight,
        earned: isCorrect ? q.weight : 0,
      };
    });

    const totalWeight = questionsToUse.reduce((s, q) => s + q.weight, 0);
    const earnedWeight = details.reduce((s, d) => s + d.earned, 0);
    const correctCount = details.filter((d) => d.isCorrect).length;

    const result: ExamResult = {
      details,
      score: 0,
      totalWeight,
      earnedWeight,
      correctCount,
      totalCount: questionsToUse.length,
      scale: 10,
      timeTaken,
      // Lưu câu hỏi đã shuffle để truyền cho ResultPage
      usedQuestions: questionsToUse,
    };

    onSubmit(result);
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Màn hình cài đặt trước khi thi
  if (!isStarted) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Cấu hình thi thử
          </h2>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tổng số câu hỏi
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {questions.length} câu
              </span>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Số câu hỏi muốn làm
              </label>
              <input
                type="text"
                value={numQuestions === questions.length ? '' : numQuestions}
                onChange={(e) => {
                  const val = e.target.value;
                  // Cho phép trống hoặc chỉ số
                  if (val === '') {
                    setNumQuestions(questions.length);
                  } else if (/^\d+$/.test(val)) {
                    const num = parseInt(val);
                    setNumQuestions(Math.min(questions.length, Math.max(1, num)));
                  }
                }}
                className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center"
                placeholder={questions.length.toString()}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tổng điểm
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {questions.slice(0, numQuestions).reduce((s, q) => s + q.weight, 0)} điểm
              </span>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Hiển thị
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ExamViewMode)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="single">Từng câu</option>
                <option value="scroll">Danh sách cuộn</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Đảo lộn câu hỏi
              </label>
              <button
                onClick={() => setShuffleQuestions(!shuffleQuestions)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  shuffleQuestions ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    shuffleQuestions ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Đảo lộn đáp án
              </label>
              <button
                onClick={() => setShuffleAnswers(!shuffleAnswers)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  shuffleAnswers ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    shuffleAnswers ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Đồng hồ đếm giờ
              </label>
              <button
                onClick={() => setIsTimerEnabled(!isTimerEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isTimerEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    isTimerEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {isTimerEnabled && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Thời gian (phút)
                </label>
                <input
                  type="text"
                  value={timeLimit === 15 ? '' : timeLimit}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setTimeLimit(15);
                    } else if (/^\d+$/.test(val)) {
                      const num = parseInt(val);
                      setTimeLimit(Math.min(180, Math.max(1, num)));
                    }
                  }}
                  className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center"
                  placeholder="15"
                />
              </div>
            )}
          </div>

          <button
            onClick={startExam}
            className="w-full px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
          >
            Bắt đầu thi
          </button>
        </div>
      </div>
    );
  }

  // Khi đang thi, hiển thị câu hỏi (sử dụng displayQuestions nếu có shuffle)
  const questionsToDisplay = displayQuestions.length > 0 ? displayQuestions : questions;
  const current = questionsToDisplay[currentIdx];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header: timer + submit */}
      <div className="sticky top-14 z-40 bg-gray-50 dark:bg-gray-900 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isTimerEnabled && (
            <span className={`text-lg font-mono font-bold px-3 py-1 rounded-lg ${
              timeRemaining <= 60
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 animate-pulse'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}>
              {formatTime(timeRemaining)}
            </span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {questionsToDisplay.length} câu
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Nộp bài
        </button>
      </div>

      {/* Bang dieu huong nhanh */}
      <div className="flex flex-wrap gap-1.5 mb-4 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {questionsToDisplay.map((q, idx) => {
          const qAnswers = answers[q.id] ?? [];
          return (
            <button
              key={q.id}
              onClick={() => jumpTo(idx)}
              className={`w-9 h-9 text-xs font-medium rounded-lg transition-colors ${
                idx === currentIdx
                  ? 'ring-2 ring-blue-500'
                  : ''
              } ${
                qAnswers.length > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Hien thi theo che do */}
      {viewMode === 'single' ? (
        /* Che do tung cau */
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Câu {currentIdx + 1}: {current.content}
              {getCorrectAnswers(current).length > 1 && (
                <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                  (Chọn {getCorrectAnswers(current).length} đáp án)
                </span>
              )}
            </h3>
            {current.imageUrl && (
              <div className="mb-4 text-center bg-slate-900 rounded-xl p-3 border border-slate-700 shadow-inner overflow-hidden">
                <img
                  src={getImageUrl(current.imageUrl)}
                  alt={`Ảnh đề thi câu ${currentIdx + 1}`}
                  loading="lazy"
                  className="max-h-[360px] w-auto mx-auto object-contain rounded cursor-zoom-in"
                  onClick={() => setZoomImage(current.imageUrl || null)}
                />
                <div className="mt-1 text-xs text-slate-400 font-medium">
                  🔍 Click vào ảnh để phóng to toàn màn hình
                </div>
              </div>
            )}
            <div className="space-y-2">
              {(Object.keys(current.options) as AnswerKey[]).filter((k) => current.options[k].trim()).map((key) => {
                const isSelected = (answers[current.id] ?? []).includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {key}. {current.options[key]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => jumpTo(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Trước
            </button>
            <span className="text-sm text-gray-500">{currentIdx + 1}/{questionsToDisplay.length}</span>
            <button
              onClick={() => jumpTo(Math.min(questionsToDisplay.length - 1, currentIdx + 1))}
              disabled={currentIdx === questionsToDisplay.length - 1}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sau →
            </button>
          </div>
        </div>
      ) : (
        /* Che do danh sach cuon */
        <div className="space-y-4">
          {questionsToDisplay.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Câu {idx + 1}: {q.content}
                {getCorrectAnswers(q).length > 1 && (
                  <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                    (Chọn {getCorrectAnswers(q).length} đáp án)
                  </span>
                )}
              </h3>
              {q.imageUrl && (
                <div className="mb-4 text-center bg-slate-900 rounded-xl p-3 border border-slate-700 shadow-inner overflow-hidden">
                  <img
                    src={getImageUrl(q.imageUrl)}
                    alt={`Ảnh đề thi câu ${idx + 1}`}
                    loading="lazy"
                    className="max-h-[300px] w-auto mx-auto object-contain rounded cursor-zoom-in"
                    onClick={() => setZoomImage(q.imageUrl || null)}
                  />
                  <div className="mt-1 text-xs text-slate-400 font-medium">
                    🔍 Click vào ảnh để phóng to toàn màn hình
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {(Object.keys(q.options) as AnswerKey[]).filter((k) => q.options[k].trim()).map((key) => {
                    const isSelected = (answers[q.id] ?? []).includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          const allCorrect = getCorrectAnswers(q);
                          if (allCorrect.length > 1) {
                            setAnswers((prev) => {
                              const cur = prev[q.id] ?? [];
                              const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
                              return { ...prev, [q.id]: next };
                            });
                          } else {
                            setAnswers((prev) => ({ ...prev, [q.id]: [key] }));
                          }
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        {key}. {q.options[key]}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    
      {/* Phóng to ảnh đề thi (Lightbox) */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-10 right-0 text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-lg transition-colors"
            >
              ✕ Đóng (ESC)
            </button>
            <img
              src={getImageUrl(zoomImage)}
              alt="Phóng to ảnh đề thi"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}
</div>
  );
}
