import { useState, useEffect } from 'react';
import type { Question, AnswerKey } from '../types';
import { generateId } from '../utils/storage';
import { fileToDataUrl } from '../utils/gemini';
import { extractQuestionsFromImagesOcr } from '../utils/ocr';
import { uploadImage } from '../utils/api';

interface QuestionFormProps {
  onAddQuestion: (q: Question) => void;
  onUpdateQuestion: (q: Question) => void;
  editQuestion: Question | null;
  setEditQuestion: (q: Question | null) => void;
  setId: string | null;
  onImagesSaved?: () => void;
}

const defaultForm = {
  content: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  optionE: '',
  correctAnswer: 'A' as AnswerKey,
  weight: 1,
  explanation: '',
  keywordsText: '',
};

const ALL_LABELS: AnswerKey[] = ['A', 'B', 'C', 'D', 'E'];

const optionFieldMap: Record<AnswerKey, keyof typeof defaultForm> = {
  A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD', E: 'optionE',
};

export default function QuestionForm({ onAddQuestion, onUpdateQuestion, editQuestion, setEditQuestion, setId, onImagesSaved }: QuestionFormProps) {
  const [form, setForm] = useState(defaultForm);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState('');
  const [importImages, setImportImages] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Khi sửa câu hỏi, fill form với dữ liệu cũ
  useEffect(() => {
    if (editQuestion) {
      setForm({
        content: editQuestion.content,
        optionA: editQuestion.options.A,
        optionB: editQuestion.options.B,
        optionC: editQuestion.options.C,
        optionD: editQuestion.options.D,
        optionE: editQuestion.options.E || '',
        correctAnswer: editQuestion.correctAnswer,
        weight: editQuestion.weight,
        explanation: editQuestion.explanation,
        keywordsText: editQuestion.keywords ? editQuestion.keywords.join(', ') : '',
      });
    }
  }, [editQuestion]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditQuestion(null);
    setError('');
  };

  const handleSubmit = () => {
    if (!form.content.trim() || !form.optionA.trim()) {
      setError('Vui lòng nhập nội dung câu hỏi và ít nhất đáp án A');
      return;
    }

    const keywords = form.keywordsText
      ? form.keywordsText.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined;

    const question: Question = {
      id: editQuestion?.id ?? generateId(),
      content: form.content,
      options: { A: form.optionA, B: form.optionB, C: form.optionC, D: form.optionD, E: form.optionE },
      correctAnswer: form.correctAnswer,
      weight: form.weight || 1,
      explanation: form.explanation,
      keywords,
    };

    if (editQuestion) {
      onUpdateQuestion(question);
    } else {
      onAddQuestion(question);
    }
    resetForm();
  };

  // Import câu hỏi từ text theo định dạng có cấu trúc
  const handleImportText = () => {
    const lines = importText.split('\n').filter((l) => l.trim());
    const questions: Question[] = [];
    let current: { content?: string; options?: string[]; weight?: number; explanation?: string } = {};

    for (const line of lines) {
      const trimmed = line.trim();

      // Dòng trống = kết thúc 1 câu hỏi
      if (!trimmed) {
        if (current.content && current.options && current.options.length > 0) {
          const opts: Record<string, string> = {};
          let correctAnswer: AnswerKey | null = null;

          current.options.forEach((opt, i) => {
            const label = ALL_LABELS[i];
            if (!label) return;
            if (opt.startsWith('*')) {
              opts[label] = opt.substring(1).trim();
              correctAnswer = label as AnswerKey;
            } else {
              opts[label] = opt.trim();
            }
          });

          if (correctAnswer && opts.A) {
            questions.push({
              id: generateId(),
              content: current.content,
              options: { A: opts.A, B: opts.B || '', C: opts.C || '', D: opts.D || '', E: opts.E || '' },
              correctAnswer,
              weight: current.weight || 1,
              explanation: current.explanation || '',
            });
          }
        }
        current = {};
        continue;
      }

      // Nhận dạng các dòng (hỗ trợ A-E)
      if (trimmed.match(/^[A-Ea-e][.)\s]/)) {
        const match = trimmed.match(/^[A-Ea-e][.)\s]\s*(.*)/);
        if (match) {
          if (!current.options) current.options = [];
          current.options.push(match[1]);
        }
      } else if (trimmed.toLowerCase().startsWith('giai thich') || trimmed.toLowerCase().startsWith('giải thích') || trimmed.toLowerCase().startsWith('explain')) {
        current.explanation = trimmed.replace(/^(giải thích|giai thich|explain)[:\s]*/i, '');
      } else if (trimmed.toLowerCase().startsWith('trong so') || trimmed.toLowerCase().startsWith('trọng số') || trimmed.toLowerCase().startsWith('weight')) {
        const w = parseFloat(trimmed.replace(/^(trọng số|trong so|weight)[:\s]*/i, ''));
        if (!isNaN(w)) current.weight = w;
      } else if (!current.content) {
        current.content = trimmed;
      }
    }

    // Xử lý câu cuối cùng
    if (current.content && current.options && current.options.length > 0) {
      const opts: Record<string, string> = {};
      let correctAnswer: AnswerKey | null = null;

      current.options.forEach((opt, i) => {
        const label = ALL_LABELS[i];
        if (!label) return;
        if (opt.startsWith('*')) {
          opts[label] = opt.substring(1).trim();
          correctAnswer = label as AnswerKey;
        } else {
          opts[label] = opt.trim();
        }
      });

      if (correctAnswer && opts.A) {
        questions.push({
          id: generateId(),
          content: current.content,
          options: { A: opts.A, B: opts.B || '', C: opts.C || '', D: opts.D || '', E: opts.E || '' },
          correctAnswer,
          weight: current.weight || 1,
          explanation: current.explanation || '',
        });
      }
    }

    if (questions.length === 0) {
      setError('Không thể phân tích câu hỏi từ text. Kiểm tra lại định dạng.');
      return;
    }

    questions.forEach((q) => onAddQuestion(q));
    setImportText('');
    setShowImport(false);
  };

  // Lấy giá trị từ options (hỗ trợ cả key hoa và thường)
  const getOptionValue = (opts: Record<string, string> | undefined, key: string): string => {
    if (!opts) return '';
    return opts[key] || opts[key.toLowerCase()] || opts[key.toUpperCase()] || '';
  };

  // Import từ file JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        const arr = Array.isArray(data) ? data : [data];
        arr.forEach((item: Record<string, unknown>) => {
          const opts = item.options as Record<string, string> | undefined;
          const q: Question = {
            id: generateId(),
            content: String(item.content || item.question || ''),
            options: {
              A: getOptionValue(opts, 'A'),
              B: getOptionValue(opts, 'B'),
              C: getOptionValue(opts, 'C'),
              D: getOptionValue(opts, 'D'),
              E: getOptionValue(opts, 'E'),
            },
            correctAnswer: ((item.correctAnswer || item.correct || 'A') as string).toUpperCase() as AnswerKey,
            weight: Number(item.weight) || 1,
            explanation: String(item.explanation || ''),
          };
          onAddQuestion(q);
        });
      } catch {
        setError('File JSON không hợp lệ.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Chọn nhiều ảnh đề thi
  const handleImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    Promise.all(files.map((f) => fileToDataUrl(f)))
      .then((urls) => setImportImages((prev) => [...prev, ...urls]))
      .catch(() => setError('Không đọc được ảnh. Kiểm tra lại file ảnh.'));
    e.target.value = '';
  };

  // Chuyển ảnh -> câu hỏi bằng OCR (lưu ảnh vào DB trước, rồi nhận dạng)
  const handleAiImport = async () => {
    if (importImages.length === 0) {
      setError('Vui lòng chọn ít nhất 1 ảnh đề thi.');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      // 1) Lưu ảnh vào DB backend
      if (setId) {
        for (let i = 0; i < importImages.length; i++) {
          try {
            await uploadImage(setId, `de-thi-${Date.now()}-${i + 1}.jpg`, importImages[i]);
          } catch (e) {
            console.warn('Không lưu được ảnh vào DB:', e);
          }
        }
        onImagesSaved?.();
      }

      // 2) OCR nhận dạng câu hỏi từ ảnh
      const questions = await extractQuestionsFromImagesOcr(importImages);
      if (questions.length === 0) {
        throw new Error('Không nhận dạng được câu hỏi nào trong ảnh. Ảnh có thể bị mờ hoặc chưa rõ.');
      }
      questions.forEach((q) => onAddQuestion(q));
      setImportImages([]);
      setShowImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi nhận dạng ảnh.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Nội dung câu hỏi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Nội dung câu hỏi
        </label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Nhập nội dung câu hỏi..."
        />
      </div>

      {/* 5 đáp án (A-E) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_LABELS.map((key) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Đáp án {key}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="correctAnswer"
                checked={form.correctAnswer === key}
                onChange={() => setForm({ ...form, correctAnswer: key })}
                className="accent-blue-600 shrink-0"
                title={`Chọn đáp án ${key} là đúng`}
              />
              <input
                type="text"
                value={form[optionFieldMap[key]]}
                onChange={(e) => setForm({ ...form, [optionFieldMap[key]]: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Đáp án ${key}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Trọng số, Giải thích & Từ khóa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Trọng số / Điểm
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Từ khóa (Key words - cách nhau bởi dấu phẩy)
          </label>
          <input
            type="text"
            value={form.keywordsText}
            onChange={(e) => setForm({ ...form, keywordsText: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="VD: Business Intelligence, analyst (để trống sẽ tự động trích xuất)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Giải thích (không bắt buộc)
          </label>
          <textarea
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            rows={1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Giải thích tại sao đáp án này đúng..."
          />
        </div>
      </div>

      {/* Button actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {editQuestion ? 'Cập nhật' : 'Thêm câu hỏi'}
        </button>
        {editQuestion && (
          <button
            onClick={resetForm}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            Hủy
          </button>
        )}
        <button
          onClick={() => { setShowImport(!showImport); setError(''); }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Import
        </button>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Import câu hỏi
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Định dạng: Mỗi câu hỏi cách nhau bằng dòng trống. Đáp án đúng đánh dấu *.
            VD: A. Nội dung *B. Đáp án đúng C. ... D. ...
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
            placeholder="Paste text câu hỏi vào đây..."
          />
          <div className="flex gap-3">
            <button
              onClick={handleImportText}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Import từ text
            </button>
            <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm cursor-pointer">
              Import từ file JSON
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>

          {/* Import từ ảnh (OCR) */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Import từ ảnh đề thi (OCR nhận dạng ký tự, không cần AI)
            </p>
            <label className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm cursor-pointer">
              Chọn ảnh đề thi
              <input type="file" accept="image/*" multiple onChange={handleImageFiles} className="hidden" />
            </label>
            {importImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {importImages.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt={`Ảnh ${i + 1}`}
                      className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                    />
                    <button
                      onClick={() => setImportImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                      title="Bỏ ảnh này"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleAiImport}
              disabled={aiLoading || importImages.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? 'Đang nhận dạng... (có thể mất vài giây/1 phút)' : `Chuyển ${importImages.length} ảnh thành câu hỏi`}
            </button>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              OCR đọc được chữ in rõ ràng. Đầu nhận dạng tiên sẽ mất vài giây để tải bộ nhận dạng tiếng Việt từ CDN. OCR không nhận diện được đáp án đã đánh dấu (bôi đen, khoanh tròn), nên sau khi tạo xong bộ câu hỏi bạn nên dùng nút "Import đáp án" ở phía trên để điền đáp án đúng.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
