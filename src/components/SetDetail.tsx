import { useState, useEffect } from 'react';
import type { Question, QuestionSet, ExamResult, ExamHistory, AnswerKey } from '../types';
import { getSubject } from '../types';
import { saveExamHistory, generateId } from '../utils/storage';
import QuestionForm from './QuestionForm';
import QuestionList from './QuestionList';
import StudyMode from './StudyMode';
import ExamMode from './ExamMode';
import ResultPage from './ResultPage';
import ExamHistoryComponent from './ExamHistory';

interface SetDetailProps {
  set: QuestionSet;
  onBack: () => void;
  onAddQuestion: (q: Question) => void;
  onUpdateQuestion: (q: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onDeleteAllQuestions: () => void;
  onApplyAnswers: (answers: Record<number, AnswerKey>) => void;
  onNotify?: (msg: string) => void;
  imagesRefreshKey?: number;
  onImagesSaved: () => void;
}

type TabMode = 'manage' | 'study' | 'exam' | 'result' | 'history';

export default function SetDetail({
  set,
  onBack,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onDeleteAllQuestions,
  onApplyAnswers: _onApplyAnswers,
  onNotify: _onNotify,
  imagesRefreshKey: _imagesRefreshKey,
  onImagesSaved,
}: SetDetailProps) {
  // Khôi phục tabMode từ localStorage
  const [tabMode, setTabMode] = useState<TabMode>(() => {
    const saved = localStorage.getItem(`quiz-app-tabMode-${set.id}`);
    return (saved as TabMode) || 'manage';
  });
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [viewingHistory, setViewingHistory] = useState<ExamHistory | null>(null);

  // Lưu tabMode vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem(`quiz-app-tabMode-${set.id}`, tabMode);
  }, [tabMode, set.id]);

  const questions = set.questions;
  const hasQuestions = questions.length > 0;

  const handleExamSubmit = (result: ExamResult) => {
    // Lưu vào lịch sử
    const history: ExamHistory = {
      id: generateId(),
      setId: set.id,
      setName: set.name,
      timestamp: Date.now(),
      result,
    };
    saveExamHistory(history);
    
    setExamResult(result);
    setTabMode('result');
  };

  const handleRetry = () => {
    setExamResult(null);
    setViewingHistory(null);
    setTabMode('exam');
  };

  const handleBackToManage = () => {
    setExamResult(null);
    setViewingHistory(null);
    setTabMode('manage');
  };

  const handleViewHistory = (history: ExamHistory) => {
    setViewingHistory(history);
    setExamResult(history.result);
    setTabMode('result');
  };

  const handleBackToHistory = () => {
    setExamResult(null);
    setViewingHistory(null);
    setTabMode('history');
  };

  const handleAddQuestionClick = () => {
    setEditQuestion(null);
    setShowQuestionForm(true);
  };

  const handleEditQuestionClick = (q: Question) => {
    setEditQuestion(q);
    setShowQuestionForm(true);
  };

  const handleQuestionFormClose = () => {
    setShowQuestionForm(false);
    setEditQuestion(null);
  };

  const handleQuestionSaved = (q: Question) => {
    if (editQuestion) {
      onUpdateQuestion(q);
    } else {
      onAddQuestion(q);
    }
    setShowQuestionForm(false);
    setEditQuestion(null);
  };

  return (
    <div className="space-y-6">
      {/* Header với nút quay lại */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Quay lại Dashboard"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {set.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Môn: {getSubject(set)} • {questions.length} câu hỏi
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setTabMode('manage')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                tabMode === 'manage'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              📝 Quản lý
            </button>
            <button
              onClick={() => setTabMode('study')}
              disabled={!hasQuestions}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                tabMode === 'study'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : hasQuestions
                  ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
            >
              📚 Ôn tập
            </button>
            <button
              onClick={() => setTabMode('history')}
              disabled={!hasQuestions}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                tabMode === 'history'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : hasQuestions
                  ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
            >
              📋 Lịch sử
            </button>
          </div>
        </div>

        {/* Nội dung tab */}
        <div className="p-6">
          {/* Tab Quản lý */}
          {tabMode === 'manage' && (
            <div className="space-y-6">
              {/* Các nút hành động */}
              <div className="flex gap-3 flex-wrap justify-end">
                <button
                  onClick={handleAddQuestionClick}
                  className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-sm font-medium shadow-lg"
                >
                  ➕ Thêm câu hỏi
                </button>
                {hasQuestions && (
                  <>
                    <button
                      onClick={() => setTabMode('exam')}
                      className="px-6 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors text-sm font-medium shadow-lg"
                    >
                      ⏱️ Thi thử
                    </button>
                    <button
                      onClick={onDeleteAllQuestions}
                      className="px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors text-sm font-medium shadow-lg"
                    >
                      🗑️ Xóa toàn bộ câu hỏi
                    </button>
                  </>
                )}
              </div>

              {/* Danh sách câu hỏi */}
              <QuestionList
                questions={questions}
                onEdit={handleEditQuestionClick}
                onDelete={onDeleteQuestion}
              />
            </div>
          )}

          {/* Tab Ôn tập */}
          {tabMode === 'study' && <StudyMode questions={questions} setId={set.id} />}

          {/* Tab Lịch sử */}
          {tabMode === 'history' && (
            <ExamHistoryComponent
              setId={set.id}
              setName={set.name}
              onViewResult={handleViewHistory}
              onBack={() => setTabMode('manage')}
            />
          )}

          {/* Tab Thi thử */}
          {tabMode === 'exam' && <ExamMode questions={questions} onSubmit={handleExamSubmit} />}

          {/* Tab Kết quả */}
          {tabMode === 'result' && examResult && (
            <ResultPage
              result={examResult}
              questions={questions}
              onRetry={handleRetry}
              onBack={viewingHistory ? handleBackToHistory : handleBackToManage}
            />
          )}
        </div>
      </div>

      {/* Modal Form thêm/sửa câu hỏi */}
      {showQuestionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editQuestion ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
              </h3>
              <button
                onClick={handleQuestionFormClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <QuestionForm
                onAddQuestion={handleQuestionSaved}
                onUpdateQuestion={handleQuestionSaved}
                editQuestion={editQuestion}
                setEditQuestion={setEditQuestion}
                setId={set.id}
                onImagesSaved={onImagesSaved}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
