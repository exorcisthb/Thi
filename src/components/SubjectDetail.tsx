import { useState, useMemo } from 'react';
import type { QuestionSet } from '../types';

interface SubjectDetailProps {
  subject: string;
  questionSets: QuestionSet[];
  onBack: () => void;
  onSelectSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
}

const ITEMS_PER_PAGE = 6;

export default function SubjectDetail({
  subject,
  questionSets,
  onBack,
  onSelectSet,
  onDeleteSet,
}: SubjectDetailProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Lọc và sắp xếp
  const filteredSets = useMemo(() => {
    let result = [...questionSets];

    // Lọc theo search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((set) => set.name.toLowerCase().includes(query));
    }

    // Sắp xếp
    if (sortBy === 'newest') {
      result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === 'most') {
      result.sort((a, b) => b.questions.length - a.questions.length);
    }

    return result;
  }, [questionSets, searchQuery, sortBy]);

  // Phân trang
  const totalPages = Math.ceil(filteredSets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSets = filteredSets.slice(startIndex, endIndex);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header môn học */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
            title="Quay lại danh sách môn"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {subject}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tổng hợp đề thi và tài liệu học tập cho môn {subject} (tổng hợp).
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Mã môn: {subject}
            </p>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Trang chủ</span>
              <span>›</span>
              <span>Kỳ tổng hợp</span>
              <span>›</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{subject}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Thanh công cụ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Tất cả loại</option>
          <option value="pe">Đề thi PE</option>
          <option value="fe">Đề thi FE</option>
        </select>
        
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm kiếm theo mã đề, mô tả..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="newest">📅 Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="most">Nhiều câu nhất</option>
        </select>

        <button
          onClick={resetFilters}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 whitespace-nowrap"
        >
          ✕ Xóa lọc
        </button>
      </div>

      {currentSets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-md">
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Không tìm thấy bộ đề nào phù hợp' : 'Chưa có bộ đề nào trong môn này.'}
          </p>
        </div>
      ) : (
        <>
          {/* Danh sách bộ đề dạng list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {currentSets.map((set, index) => (
              <div
                key={set.id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  index !== currentSets.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                }`}
              >
                {/* Icon QZ */}
                <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold flex-shrink-0 text-sm">
                  QZ
                </div>

                {/* Thông tin bộ đề */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onSelectSet(set.id)}
                    className="text-left w-full group"
                  >
                    <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {set.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {set.questions.length} câu • {new Date(set.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </button>
                </div>

                {/* Nút xóa */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSet(set.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Xóa bộ đề"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Thông tin phân trang */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị <span className="font-medium">{startIndex + 1}</span> của{' '}
              <span className="font-medium">{filteredSets.length}</span> kết quả
            </p>

            {/* Phân trang */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ‹ Trước
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau ›
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
