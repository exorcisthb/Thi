import { getImageUrl } from '../utils/imageUrl';
import { useState, useEffect } from 'react';
import type { Question, AnswerKey } from '../types';
import { getCorrectAnswers } from '../types';

interface StudyModeProps {
  questions: Question[];
  setId?: string; // ID của bộ đề để lưu vào localStorage
}

export default function StudyMode({ questions, setId }: StudyModeProps) {
  const QUESTIONS_PER_NAV_PAGE = 16; // Số câu hiển thị mỗi trang điều hướng

  const [currentIdx, setCurrentIdx] = useState(() => {
    // Khôi phục vị trí câu hỏi từ localStorage
    if (setId) {
      const saved = localStorage.getItem(`quiz-app-study-idx-${setId}`);
      const idx = saved ? parseInt(saved, 10) : 0;
      return Math.min(Math.max(0, idx), Math.max(0, questions.length - 1));
    }
    return 0;
  });

  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(() => new Set([currentIdx]));
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [navPage, setNavPage] = useState(() => Math.floor(currentIdx / QUESTIONS_PER_NAV_PAGE));
  const [showJumpBackMenu, setShowJumpBackMenu] = useState(false);
  const [showJumpForwardMenu, setShowJumpForwardMenu] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showQuickAnswers, setShowQuickAnswers] = useState(false);

  // Touch gesture state cho vuốt màn hình mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Chưa có câu hỏi. Hãy quay lại quản lý để thêm câu hỏi.
      </div>
    );
  }

  const current = questions[currentIdx];
  const isImageChoices = Boolean(
    current.imageUrl &&
    (Object.keys(current.options) as AnswerKey[])
      .filter((k) => current.options[k]?.trim())
      .every((k) => current.options[k].trim() === k || current.options[k].trim().length <= 2)
  );
  const isBookmarked = bookmarked.has(current.id);
  const correctAnswers = getCorrectAnswers(current);
  const isMulti = correctAnswers.length > 1;

  // Copy câu hỏi ra clipboard
  const handleCopyQuestion = async () => {
    const optionsText = (Object.keys(current.options) as AnswerKey[])
      .filter((k) => current.options[k].trim())
      .map((k) => `${k}. ${current.options[k]}`)
      .join('\n');
    
    const correctText = current.answerNote === 'Xem trên ảnh' ? 'Xem trên ảnh' : correctAnswers.join(', ');
    
    const text = `Câu ${currentIdx + 1}: ${current.content}\n\n${optionsText}\n\nĐáp án đúng: ${correctText}${
      current.explanation ? `\n\nGiải thích: ${current.explanation}` : ''
    }`;
    
    try {
      await navigator.clipboard.writeText(text);
      alert('✓ Đã copy nội dung câu hỏi!');
    } catch {
      alert('Không thể copy. Vui lòng thử lại.');
    }
  };

  // Tính toán trang điều hướng
  const totalNavPages = Math.ceil(questions.length / QUESTIONS_PER_NAV_PAGE);
  const navStartIdx = navPage * QUESTIONS_PER_NAV_PAGE;
  const navEndIdx = Math.min(navStartIdx + QUESTIONS_PER_NAV_PAGE, questions.length);
  const questionsToShowInNav = questions.slice(navStartIdx, navEndIdx);

  // Chuyển sang câu hỏi cụ thể - Luôn reset card về mặt trước
  const jumpToQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setIsFlipped(false);
    setViewedIndices((prev) => new Set(prev).add(idx));
    const targetNavPage = Math.floor(idx / QUESTIONS_PER_NAV_PAGE);
    setNavPage(targetNavPage);
    setShowJumpBackMenu(false);
    setShowJumpForwardMenu(false);
    if (setId) {
      localStorage.setItem(`quiz-app-study-idx-${setId}`, idx.toString());
    }
  };

  const jumpToPage = (targetPage: number) => {
    const targetIdx = targetPage * QUESTIONS_PER_NAV_PAGE;
    jumpToQuestion(Math.min(targetIdx, questions.length - 1));
  };

  const toggleFlip = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    setIsFlipped((prev) => !prev);
    setViewedIndices((prev) => new Set(prev).add(currentIdx));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      jumpToQuestion(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      jumpToQuestion(currentIdx - 1);
    }
  };

  const toggleBookmark = () => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) {
        next.delete(current.id);
      } else {
        next.add(current.id);
      }
      return next;
    });
  };

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setZoomImage(null);
        setShowQuickAnswers(false);
        return;
      }

      if (zoomImage || showQuickAnswers) return;

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIdx < questions.length - 1) {
          jumpToQuestion(currentIdx + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIdx > 0) {
          jumpToQuestion(currentIdx - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, questions.length, zoomImage, showQuickAnswers]);

  // Touch Swipe trên mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIdx < questions.length - 1) {
      jumpToQuestion(currentIdx + 1);
    } else if (isRightSwipe && currentIdx > 0) {
      jumpToQuestion(currentIdx - 1);
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Đóng dropdown menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = () => {
      setShowJumpBackMenu(false);
      setShowJumpForwardMenu(false);
    };

    if (showJumpBackMenu || showJumpForwardMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showJumpBackMenu, showJumpForwardMenu]);

  return (
    <div className={`mx-auto transition-all duration-300 ${isFullScreen ? "w-full max-w-none px-2" : "max-w-[1550px] w-full px-2 sm:px-4"}`}>
      {/* Nút Fullscreen nhanh */}
      {/* Progress bar & Stats Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>
              Câu {currentIdx + 1} / {questions.length}
            </span>
            <button
              onClick={() => setShowQuickAnswers(true)}
              className="px-2.5 py-1 text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1 font-semibold"
              title="Xem bảng tra cứu nhanh toàn bộ đáp án của đề này"
            >
              <span>📊 Bảng đáp án</span>
            </button>
            <button
              onClick={() => setIsFullScreen((prev) => !prev)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-all flex items-center gap-1 font-semibold ${
                isFullScreen
                  ? 'bg-blue-600 text-white border-blue-600 shadow'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
              }`}
              title={isFullScreen ? 'Thu nhỏ cửa sổ' : 'Mở rộng Full màn hình'}
            >
              <span>{isFullScreen ? '🗗 Thu nhỏ' : '⛶ Full màn hình'}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span>Đã xem: {viewedIndices.size}</span>
            {isBookmarked && (
              <span className="text-yellow-500 font-semibold flex items-center gap-1">
                ★ Đã đánh dấu
              </span>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 3D FLASHCARD CARD CONTAINER */}
      <div
        className="perspective-1000 my-4 min-h-[420px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`grid w-full transition-transform duration-500 transform-style-3d cursor-pointer ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          onClick={toggleFlip}
          title="Bấm vào card hoặc phím Space để lật mặt card"
        >
          {/* ================= FRONT SIDE (Mặt trước) ================= */}
          <div className="[grid-area:1/1] backface-hidden bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-7 flex flex-col justify-between shadow-md hover:shadow-lg transition-shadow relative overflow-hidden">
            <div>
              {/* Header card mặt trước */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-full">
                    Câu {currentIdx + 1}
                  </span>
                  {current.imageUrl && (
                    <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold text-xs rounded-full flex items-center gap-1">
                      📷 Có hình ảnh đề thi
                    </span>
                  )}
                  {isMulti && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      (Chọn {correctAnswers.length} đáp án)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark();
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isBookmarked
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-yellow-500'
                    }`}
                    title={isBookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu câu khó'}
                  >
                    ★
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyQuestion();
                    }}
                    className="p-2 rounded-lg transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600"
                    title="Copy nội dung câu hỏi"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Nội dung câu hỏi (OCR Text) */}
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-relaxed mb-4">
                {current.content}
              </h3>

              {/* Hình ảnh đề thi (nếu có) */}
              {current.imageUrl && (
                <div className="mb-5 text-center bg-slate-900 rounded-xl p-3 border border-slate-700 shadow-inner overflow-hidden relative group">
                  <img
                    src={getImageUrl(current.imageUrl)}
                    alt={`Ảnh đề thi câu ${currentIdx + 1}`}
                    loading="lazy"
                    className="w-auto max-w-full max-h-[72vh] sm:max-h-[80vh] mx-auto object-contain rounded-lg shadow-md cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.008]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImage(current.imageUrl || null);
                    }}
                  />
                  <div className="mt-2 text-xs text-slate-300 flex items-center justify-center gap-1.5 font-medium">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <span>Click vào ảnh để phóng to toàn màn hình</span>
                  </div>
                </div>
              )}

              {/* Các lựa chọn đáp án trung tính */}
              {isImageChoices ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                  {(Object.keys(current.options) as AnswerKey[])
                    .filter((k) => current.options[k] && current.options[k].trim())
                    .map((key) => (
                      <div
                        key={key}
                        className="py-3 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 transition-all flex items-center justify-center gap-2.5 font-bold text-base sm:text-lg text-gray-800 dark:text-gray-200 shadow-sm"
                      >
                        <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-extrabold flex items-center justify-center border border-blue-300 dark:border-blue-700 text-sm">
                          {key}
                        </span>
                        <span>Phương án {key}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(Object.keys(current.options) as AnswerKey[])
                    .filter((k) => current.options[k] && current.options[k].trim())
                    .map((key) => (
                      <div
                        key={key}
                        className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors flex items-start gap-3"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-xs border border-gray-300 dark:border-gray-500 shrink-0 mt-0.5">
                          {key}
                        </span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium text-sm sm:text-base leading-normal">
                          {current.options[key]}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Hint & Button lật mặt card */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                💡 Chạm vào card hoặc bấm [Space] để xem đáp án
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFlip();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 text-xs shadow-sm"
              >
                <span>Xem đáp án</span>
                <span className="text-sm">➔</span>
              </button>
            </div>
          </div>

          {/* ================= BACK SIDE (Mặt sau - Lộ đáp án) ================= */}
          <div className="[grid-area:1/1] backface-hidden rotate-y-180 bg-white dark:bg-gray-800 rounded-2xl border-2 border-emerald-500/60 dark:border-emerald-500/70 p-5 sm:p-7 flex flex-col justify-between shadow-md hover:shadow-lg transition-shadow relative overflow-hidden">
            <div>
              {/* Header card mặt sau */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full flex items-center gap-1">
                    <span>✓ Đáp Án Đúng</span>
                  </span>
                  {current.imageUrl && (
                    <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold text-xs rounded-full">
                      📷 Có hình ảnh
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark();
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isBookmarked
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-yellow-500'
                    }`}
                    title={isBookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu câu khó'}
                  >
                    ★
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyQuestion();
                    }}
                    className="p-2 rounded-lg transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600"
                    title="Copy nội dung câu hỏi"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Nội dung câu hỏi mặt sau */}
              <h4 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
                {current.content}
              </h4>

              {/* Hình ảnh đề thi mặt sau */}
              {current.imageUrl && (
                <div className="mb-4 text-center bg-slate-900 rounded-xl p-3 border border-emerald-500/40 shadow-inner overflow-hidden relative group">
                  <img
                    src={getImageUrl(current.imageUrl)}
                    alt={`Ảnh đề thi câu ${currentIdx + 1}`}
                    loading="lazy"
                    className="w-auto max-w-full max-h-[72vh] sm:max-h-[80vh] mx-auto object-contain rounded-lg shadow-md cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.008]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImage(current.imageUrl || null);
                    }}
                  />
                  <div className="mt-1 text-xs text-emerald-400 font-medium">
                    🔍 Click vào ảnh để phóng to toàn màn hình
                  </div>
                </div>
              )}

              {/* Hiển thị đáp án đúng */}
              {current.answerNote === 'Xem trên ảnh' ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-xl mb-4 text-center">
                  <div className="text-emerald-800 dark:text-emerald-200 font-bold text-base flex items-center justify-center gap-2">
                    <span className="text-xl">✓</span>
                    <span>Đáp án được đánh dấu trực tiếp trên hình ảnh câu hỏi</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    (Quan sát lựa chọn được tô màu / tích chọn / khoanh tròn trên ảnh đề thi ở trên)
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 mb-4">
                  {(Object.keys(current.options) as AnswerKey[])
                    .filter((k) => current.options[k] && current.options[k].trim() && correctAnswers.includes(k))
                    .map((key) => (
                      <div
                        key={key}
                        className="w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-start justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500/80 text-emerald-950 dark:text-emerald-100 font-medium shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full font-semibold text-xs border shrink-0 mt-0.5 bg-emerald-600 text-white border-emerald-600">
                            {key}
                          </span>
                          <span className="text-sm sm:text-base leading-normal">
                            {current.options[key]}
                          </span>
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg leading-none">
                          ✓
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Phần giải thích (nếu có) */}
              {current.explanation && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
                  <span className="font-bold flex items-center gap-1 mb-1 text-blue-700 dark:text-blue-400">
                    💡 Giải thích:
                  </span>
                  {current.explanation}
                </div>
              )}
            </div>

            {/* Hint & Button lật về mặt trước */}
            <div className="mt-6 pt-4 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                Chạm vào card để lật về câu hỏi
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFlip();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 text-xs shadow-sm"
              >
                <span>Xem câu hỏi</span>
                <span className="text-sm">➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="mt-4">
        <div className="flex items-center justify-center gap-3">
          {/* Nút Nhảy về */}
          {navPage > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowJumpBackMenu(!showJumpBackMenu);
                }}
                className="px-3 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors whitespace-nowrap font-medium"
              >
                ◀ Nhảy về
              </button>
              {showJumpBackMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 min-w-[120px] max-h-[200px] overflow-y-auto">
                  {Array.from({ length: navPage }, (_, i) => i)
                    .reverse()
                    .map((pageIdx) => (
                      <button
                        key={pageIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          jumpToPage(pageIdx);
                        }}
                        className="w-full px-3 py-2 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 first:rounded-t-lg last:rounded-b-lg"
                      >
                        Trang {pageIdx + 1}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Khung chứa Trước + Số + Sau */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              onClick={handlePrev}
              disabled={currentIdx === 0}
              className="px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              ◀ Trước
            </button>

            <div className="flex gap-1">
              {questionsToShowInNav.map((q, relativeIdx) => {
                const absoluteIdx = navStartIdx + relativeIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => jumpToQuestion(absoluteIdx)}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors font-medium ${
                      absoluteIdx === currentIdx
                        ? 'bg-blue-600 text-white shadow-sm'
                        : bookmarked.has(q.id)
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {absoluteIdx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNext}
              disabled={currentIdx === questions.length - 1}
              className="px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Sau ▶
            </button>
          </div>

          {/* Nút Nhảy đi */}
          {navPage < totalNavPages - 1 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowJumpForwardMenu(!showJumpForwardMenu);
                }}
                className="px-3 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors whitespace-nowrap font-medium"
              >
                Nhảy đi ▶
              </button>
              {showJumpForwardMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 min-w-[120px] max-h-[200px] overflow-y-auto">
                  {Array.from({ length: totalNavPages - navPage - 1 }, (_, i) => navPage + i + 1).map((pageIdx) => (
                    <button
                      key={pageIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToPage(pageIdx);
                      }}
                      className="w-full px-3 py-2 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 first:rounded-t-lg last:rounded-b-lg"
                    >
                      Trang {pageIdx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hiển thị phạm vi */}
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {navStartIdx + 1}-{navEndIdx} / {questions.length}
          </span>
        </div>
      </div>

      {/* ================= MODAL: Phóng to ảnh (Lightbox) ================= */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-[96vw] max-h-[95vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-10 right-0 text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-lg transition-colors"
            >
              ✕ Đóng (ESC)
            </button>
            <img
              src={getImageUrl(zoomImage)}
              alt="Phóng to hình ảnh đề thi"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}

      {/* ================= MODAL: Bảng tra cứu đáp án nhanh ================= */}
      {showQuickAnswers && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowQuickAnswers(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>📊 Bảng Tra Cứu Nhanh Toàn Bộ Đáp Án</span>
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                  {questions.length} câu
                </span>
              </h3>
              <button
                onClick={() => setShowQuickAnswers(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Nội dung bảng */}
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Click vào bất kỳ câu nào để chuyển nhanh đến câu hỏi đó trong chế độ ôn tập:
              </p>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {questions.map((q, idx) => {
                  const ansText = q.answerNote === 'Xem trên ảnh' ? 'Ảnh' : (q.correctAnswer || '-');
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        jumpToQuestion(idx);
                        setShowQuickAnswers(false);
                      }}
                      className={`p-2 rounded-lg text-center border transition-all ${
                        idx === currentIdx
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-md'
                          : 'bg-gray-50 dark:bg-gray-700/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">c.{idx + 1}</div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {ansText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer modal */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowQuickAnswers(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
