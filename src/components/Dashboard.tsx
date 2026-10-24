import { useState, useMemo } from 'react';
import type { QuestionSet } from '../types';
import { getSubject } from '../types';

interface DashboardProps {
  questionSets: QuestionSet[];
  onSelectSubject: (subject: string) => void;
  onSelectSet?: (setId: string) => void;
  onCreateSet: () => void;
  onDeleteSet?: (setId: string) => void;
}

// Cấu hình giao diện và mô tả riêng cho từng môn học
const SUBJECT_CONFIG: Record<string, { title: string; desc: string; gradient: string; icon: string }> = {
  HCM202: {
    title: 'HCM202 - Tư Tưởng Hồ Chí Minh',
    desc: 'Hệ thống câu hỏi trắc nghiệm, hình ảnh đề thi FE/PE & đáp án chi tiết môn HCM202.',
    gradient: 'from-rose-500 to-amber-500',
    icon: '★',
  },
  VNR202: {
    title: 'VNR202 - Lịch Sử Đảng ĐCSVN',
    desc: 'Kho đề thi các kỳ, hình ảnh đề thi thực tế và bảng tra cứu đáp án môn VNR202.',
    gradient: 'from-blue-600 to-indigo-600',
    icon: '☭',
  },
  ITB: {
    title: 'ITB - Giới Thiệu Ngành CNTT',
    desc: 'Ngân hàng câu hỏi trắc nghiệm kiến thức cơ bản ngành công nghệ thông tin.',
    gradient: 'from-emerald-500 to-teal-600',
    icon: '💻',
  },
  KMS: {
    title: 'KMS - Knowledge Management',
    desc: 'Bộ câu hỏi ôn tập và kiểm tra môn Quản trị tri thức (KMS).',
    gradient: 'from-purple-500 to-pink-500',
    icon: '📚',
  },
};

export default function Dashboard({
  questionSets,
  onSelectSubject,
  onCreateSet,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Nhóm các bộ đề theo môn học
  const subjectGroups = useMemo(() => {
    const map = new Map<string, QuestionSet[]>();
    for (const set of questionSets) {
      const subject = getSubject(set);
      if (!map.has(subject)) map.set(subject, []);
      map.get(subject)!.push(set);
    }
    return [...map.entries()];
  }, [questionSets]);

  // Lọc theo tìm kiếm
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjectGroups;
    const query = searchQuery.toLowerCase();
    return subjectGroups.filter(([subject, sets]) => {
      const config = SUBJECT_CONFIG[subject];
      const matchSubject = subject.toLowerCase().includes(query);
      const matchTitle = config ? config.title.toLowerCase().includes(query) : false;
      const matchSets = sets.some((s) => s.name.toLowerCase().includes(query));
      return matchSubject || matchTitle || matchSets;
    });
  }, [subjectGroups, searchQuery]);

  // Tổng số bộ đề và câu hỏi
  const totalSets = questionSets.length;
  const totalQuestions = questionSets.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className="space-y-6">
      {/* Header chào mừng */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Chào mừng đến với</h1>
        <h2 className="text-4xl font-bold mb-4">QZ Quiz App</h2>
        <p className="text-white/90 max-w-2xl leading-relaxed">
          Ôn thi trắc nghiệm theo từng môn học với đầy đủ đề thi, câu hỏi trắc nghiệm, hình ảnh đề thi và đáp án chi tiết.
        </p>
      </div>

      {/* Thanh tìm kiếm và thống kê */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
          <div className="relative flex-1 w-full">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Tìm kiếm môn học (HCM202, VNR202, ITB...)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={onCreateSet}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo bộ đề mới
          </button>
        </div>

        {/* Thống kê */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalSets}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Bộ đề</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalQuestions}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Câu hỏi ôn tập</div>
          </div>
        </div>
      </div>

      {/* Danh sách môn học */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Danh mục các môn học
        </h3>

        {filteredSubjects.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-md">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Không tìm thấy môn học nào phù hợp' : 'Chưa có môn học nào. Hãy tạo bộ đề đầu tiên!'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSubjects.map(([subject, sets]) => {
              const config = SUBJECT_CONFIG[subject] || {
                title: subject,
                desc: `Tổng hợp ${sets.length} bộ đề ôn tập và kiểm tra môn ${subject}.`,
                gradient: 'from-amber-400 to-orange-500',
                icon: '📚',
              };
              const totalSubjQuestions = sets.reduce((sum, s) => sum + s.questions.length, 0);
              const hasImages = sets.some((s) => s.questions.some((q) => q.imageUrl));

              return (
                <button
                  key={subject}
                  onClick={() => onSelectSubject(subject)}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all text-left group flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-500"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      {/* Icon môn học */}
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white font-bold text-2xl group-hover:scale-105 transition-transform shadow-md`}>
                        {config.icon}
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                        {sets.length} bộ đề
                      </span>
                    </div>

                    {/* Tên môn học */}
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {config.title}
                    </h4>

                    {/* Mô tả */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
                      {config.desc}
                    </p>
                  </div>

                  {/* Metadata footer */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {totalSubjQuestions} câu hỏi
                    </span>
                    {hasImages && (
                      <span className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium text-[11px]">
                        📷 Đầy đủ ảnh đề
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
