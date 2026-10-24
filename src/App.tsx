import { useState, useEffect, useCallback } from 'react';
import type { Question, QuestionSet, AnswerKey } from './types';
import { getSubject } from './types';
import { loadQuestionSets, saveQuestionSets, loadDarkMode, saveDarkMode, generateId } from './utils/storage';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import SubjectDetail from './components/SubjectDetail';
import SetDetail from './components/SetDetail';
import { deleteSetImages, fetchItbAllQuestions } from './utils/api';

function App() {
  // State chinh
  const [viewMode, setViewMode] = useState<'dashboard' | 'subject' | 'detail'>(() => {
    const saved = localStorage.getItem('quiz-app-viewMode');
    return (saved as 'dashboard' | 'subject' | 'detail') || 'dashboard';
  });
  const [selectedSubject, setSelectedSubject] = useState<string | null>(() => {
    return localStorage.getItem('quiz-app-selectedSubject') || null;
  });
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState('');
  const [imagesRefreshKey, setImagesRefreshKey] = useState(0);

  // Lưu navigation state vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem('quiz-app-viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (selectedSubject) {
      localStorage.setItem('quiz-app-selectedSubject', selectedSubject);
    } else {
      localStorage.removeItem('quiz-app-selectedSubject');
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (currentSetId) {
      localStorage.setItem('quiz-app-currentSetId', currentSetId);
    } else {
      localStorage.removeItem('quiz-app-currentSetId');
    }
  }, [currentSetId]);

  // Khoi tao tu localStorage
  useEffect(() => {
    let saved = loadQuestionSets();
    
    // Gán lại subject cho dữ liệu cũ chưa có
    saved = saved.map((s) => {
      if (!s.subject) {
        return { ...s, subject: 'Khác' };
      }
      return s;
    });

    // XÓA các bộ ITB cũ có ID trùng (có thể từ code cũ)
    saved = saved.filter((s) => !s.id.startsWith('itb-part-'));

    if (saved.length > 0) {
      saveQuestionSets(saved);
    }

    setQuestionSets(saved);
    
    // Reset về dashboard khi mở trang mới
    setViewMode('dashboard');
    setCurrentSetId(null);
    setSelectedSubject(null);
    
    const isDark = loadDarkMode();
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Luu questionSets khi thay doi
  useEffect(() => {
    saveQuestionSets(questionSets);
  }, [questionSets]);

  // Auto-nap cac phan bo de ITB tu backend thanh bo cau hoi (subject "ITB") 1 lan
  // LƯU Ý: Chỉ hoạt động khi có backend Express chạy (localhost hoặc server riêng)
  // Trên Vercel/GitHub Pages (static hosting), API này sẽ 404 - đây là hành vi bình thường
  useEffect(() => {
    let cancelled = false;
    fetchItbAllQuestions()
      .then((all) => {
        if (cancelled) return;
        const byPart = new Map<number, typeof all>();
        for (const q of all) {
          const part = q.partNo;
          if (!byPart.has(part)) byPart.set(part, []);
          byPart.get(part)!.push(q);
        }
        setQuestionSets((prev) => {
          const next = [...prev];
          for (const [partNo, qs] of [...byPart.entries()].sort((a, b) => a[0] - b[0])) {
            const name = `Source ITB Phần ${partNo}`;
            if (next.some((s) => s.name === name)) continue;
            const newSet: QuestionSet = {
              id: `itb-part-${partNo}`,
              name,
              subject: 'ITB',
              questions: qs.map((q, idx) => {
                const answers = q.answers && q.answers.length > 0 ? q.answers : ['A' as AnswerKey];
                return {
                  id: `itb-${partNo}-${idx + 1}-${q.id}`,
                  content: q.content,
                  options: {
                    A: q.options.A || '',
                    B: q.options.B || '',
                    C: q.options.C || '',
                    D: q.options.D || '',
                    E: q.options.E || '',
                  },
                  correctAnswer: answers[0],
                  correctAnswers: answers,
                  weight: q.weight || 1,
                  explanation: q.explanation || '',
                };
              }),
              createdAt: Date.now(),
            };
            next.push(newSet);
          }
          return next;
        });
        console.log('✅ Đã tải bộ đề ITB từ server');
      })
      .catch((e) => {
        // Bình thường khi deploy lên static hosting (Vercel/GitHub Pages)
        console.info('ℹ️ Không thể tải bộ đề ITB từ server (có thể là static hosting):', e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  // Auto-nap cac bo de mon HCM202 va VNR202 tu public/data/
  useEffect(() => {
    let cancelled = false;

    const loadBuiltinSubject = async (dataPath: string, subjectCode: string) => {
      try {
        const resp = await fetch(dataPath);
        if (!resp.ok) return;
        const sets: QuestionSet[] = await resp.json();
        if (cancelled || !Array.isArray(sets)) return;

        const deletedIds: string[] = JSON.parse(
          localStorage.getItem('quiz-app-deleted-sets') || '[]'
        );
        const deletedSet = new Set(deletedIds);

        setQuestionSets((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          let addedCount = 0;
          for (const s of sets) {
            if (deletedSet.has(s.id)) continue;
            // Luon dong bo / cap nhat bo de tu file du lieu goc
            map.set(s.id, s);
            addedCount++;
          }
          if (addedCount > 0) {
            console.log(`✓ Đã nạp thành công ${addedCount} bộ đề môn ${subjectCode}`);
          }
          return Array.from(map.values());
        });
      } catch (err) {
        console.info(`Không thể nạp bộ đề ${subjectCode}:`, err);
      }
    };

    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    loadBuiltinSubject(`${cleanBase}data/hcm-sets.json`, 'HCM202');
    loadBuiltinSubject(`${cleanBase}data/vnr-sets.json`, 'VNR202');

    return () => {
      cancelled = true;
    };
  }, []);

  // Ham toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      saveDarkMode(next);
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);

  // Hien thi notification tam thoi
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2000);
  };

  // Lay cau hoi cua bo hien tai
  const currentSet = questionSets.find((s) => s.id === currentSetId);

  // --- Quản lý bộ câu hỏi ---
  const handleCreateSet = () => {
    const name = prompt('Nhập tên bộ câu hỏi:');
    if (!name?.trim()) return;
    
    // Hỏi môn học
    const subjectInput = prompt('Nhập tên môn học (để trống sẽ dùng môn hiện tại):', selectedSubject || undefined);
    const subject = subjectInput?.trim() || selectedSubject || undefined;
    
    const newSet: QuestionSet = {
      id: generateId(),
      name: name.trim(),
      subject,
      questions: [],
      createdAt: Date.now(),
    };
    setQuestionSets((prev) => [...prev, newSet]);
    setCurrentSetId(newSet.id);
    setSelectedSubject(subject || null);
    setViewMode('detail');
    showNotification(`Đã tạo bộ "${name}"`);
  };

  const handleDeleteSet = (id: string) => {
    if (!window.confirm('Xóa bộ câu hỏi này?')) return;
    deleteSetImages(id).catch((e) => console.warn('Xóa ảnh trong DB lỗi:', e));

    try {
      const deleted: string[] = JSON.parse(
        localStorage.getItem('quiz-app-deleted-sets') || '[]'
      );
      if (!deleted.includes(id)) {
        deleted.push(id);
        localStorage.setItem('quiz-app-deleted-sets', JSON.stringify(deleted));
      }
    } catch (e) {
      console.warn('Lỗi lưu quiz-app-deleted-sets:', e);
    }

    setQuestionSets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (currentSetId === id) {
        const target = next.find((s) => getSubject(s) === selectedSubject) ?? next[0];
        setCurrentSetId(target?.id ?? null);
        if (!target) setViewMode('dashboard');
      }
      return next;
    });
    showNotification('Đã xóa bộ câu hỏi');
  };

  const handleSelectSet = (id: string) => {
    setCurrentSetId(id);
    setViewMode('detail');
  };

  const handleSelectSubject = (subject: string) => {
    setSelectedSubject(subject);
    setViewMode('subject');
  };

  const handleBackToDashboard = () => {
    setSelectedSubject(null);
    setViewMode('dashboard');
  };

  // --- Quản lý câu hỏi trong bộ ---
  const addQuestion = (q: Question) => {
    if (!currentSetId) return;
    setQuestionSets((prev) =>
      prev.map((s) =>
        s.id === currentSetId
          ? { ...s, questions: [...s.questions, q] }
          : s
      )
    );
    showNotification('Đã thêm câu hỏi');
  };

  const updateQuestion = (q: Question) => {
    if (!currentSetId) return;
    setQuestionSets((prev) =>
      prev.map((s) =>
        s.id === currentSetId
          ? { ...s, questions: s.questions.map((cq) => (cq.id === q.id ? q : cq)) }
          : s
      )
    );
    showNotification('Đã cập nhật câu hỏi');
  };

  const deleteQuestion = (id: string) => {
    if (!currentSetId) return;
    if (!window.confirm('Xóa câu hỏi này?')) return;
    setQuestionSets((prev) =>
      prev.map((s) =>
        s.id === currentSetId
          ? { ...s, questions: s.questions.filter((q) => q.id !== id) }
          : s
      )
    );
    showNotification('Đã xóa câu hỏi');
  };

  const deleteAllQuestions = () => {
    if (!currentSetId) return;
    if (!window.confirm('Xóa TẤT CẢ câu hỏi trong bộ này? Hành động này không thể hoàn tác.')) return;
    setQuestionSets((prev) =>
      prev.map((s) => (s.id === currentSetId ? { ...s, questions: [] } : s))
    );
    showNotification('Đã xóa toàn bộ câu hỏi');
  };

  // Áp dụng danh sách đáp án (mapping số câu 1-based -> AnswerKey) vào bộ câu hỏi hiện tại
  const applyAnswers = (answers: Record<number, AnswerKey>) => {
    if (!currentSetId) return;
    setQuestionSets((prev) =>
      prev.map((s) => {
        if (s.id !== currentSetId) return s;
        const updated = s.questions.map((q, idx) => {
          const ans = answers[idx + 1];
          if (ans && ans !== q.correctAnswer) {
            return { ...q, correctAnswer: ans };
          }
          return q;
        });
        return { ...s, questions: updated };
      })
    );
    showNotification('Đã cập nhật đáp án');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        title={currentSet?.name}
      />

      {/* Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            {notification}
          </div>
        </div>
      )}

      <main className={`mx-auto py-6 transition-all duration-300 ${
        viewMode === 'detail'
          ? 'max-w-[1680px] w-full px-2 sm:px-6'
          : 'max-w-7xl px-4 sm:px-6'
      }`}>
        {/* Dashboard - Trang chủ hiển thị các môn học */}
        {viewMode === 'dashboard' && (
          <Dashboard
            questionSets={questionSets}
            onSelectSubject={handleSelectSubject}
            onSelectSet={handleSelectSet}
            onCreateSet={handleCreateSet}
            onDeleteSet={handleDeleteSet}
          />
        )}

        {/* SubjectDetail - Chi tiết môn học với danh sách bộ đề */}
        {viewMode === 'subject' && selectedSubject && (
          <SubjectDetail
            subject={selectedSubject}
            questionSets={questionSets.filter((s) => getSubject(s) === selectedSubject)}
            onBack={handleBackToDashboard}
            onSelectSet={handleSelectSet}
            onDeleteSet={handleDeleteSet}
          />
        )}

        {/* SetDetail - Quản lý câu hỏi trong bộ đề */}
        {viewMode === 'detail' && currentSet && (
          <SetDetail
            set={currentSet}
            onBack={() => {
              if (selectedSubject) {
                setViewMode('subject');
              } else {
                setViewMode('dashboard');
              }
            }}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onDeleteQuestion={deleteQuestion}
            onDeleteAllQuestions={deleteAllQuestions}
            onApplyAnswers={applyAnswers}
            onNotify={showNotification}
            imagesRefreshKey={imagesRefreshKey}
            onImagesSaved={() => setImagesRefreshKey((k) => k + 1)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
