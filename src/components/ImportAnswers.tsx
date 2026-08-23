import { useState, useMemo } from 'react';
import type { Question, AnswerKey } from '../types';
import { fileToDataUrl, parseAnswerText } from '../utils/gemini';
import { ocrImageToText } from '../utils/ocr';

type Tab = 'ai' | 'text' | 'manual';

interface ImportAnswersProps {
  questions: Question[];
  onApply: (answers: Record<number, AnswerKey>) => void;
  onClose: () => void;
}

const ALL_LABELS: AnswerKey[] = ['A', 'B', 'C', 'D', 'E'];

export default function ImportAnswers({ questions, onApply, onClose }: ImportAnswersProps) {
  const [tab, setTab] = useState<Tab>('ai');
  const [images, setImages] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Record<number, AnswerKey> | null>(null);
  const [manual, setManual] = useState<Record<number, AnswerKey>>(() => {
    const m: Record<number, AnswerKey> = {};
    questions.forEach((q, i) => {
      m[i + 1] = q.correctAnswer;
    });
    return m;
  });

  const validPending = useMemo(() => {
    if (!pending) return null;
    const filtered: Record<number, AnswerKey> = {};
    Object.entries(pending).forEach(([k, v]) => {
      const idx = parseInt(k, 10);
      if (idx >= 1 && idx <= questions.length) filtered[idx] = v;
    });
    return Object.keys(filtered).length > 0 ? filtered : null;
  }, [pending, questions.length]);

  const handleImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    Promise.all(files.map((f) => fileToDataUrl(f)))
      .then((urls) => setImages((prev) => [...prev, ...urls]))
      .catch(() => setError('Khong doc duoc anh. Kiem tra lai file anh.'));
    e.target.value = '';
  };

  const handleAiRecognize = async () => {
    if (images.length === 0) {
      setError('Vui long chon it nhat 1 anh dap an.');
      return;
    }
    setAiLoading(true);
    setError('');
    setPending(null);
    try {
      const text = await ocrImageToText(images[0]);
      const answers = parseAnswerText(text);
      if (Object.keys(answers).length === 0) {
        throw new Error('Khong nhan dang duoc dap an nao trong anh. OCR chi doc duoc bang dap an IN SAN dang "1A 2B 3C". Neu bang dap an la phieu to/cham den thi khong nhan dang duoc - hay dung tab "Tu text" hoac "Chon tay".');
      }
      setPending(answers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loi khi nhan dang anh.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleParseText = () => {
    setError('');
    const answers = parseAnswerText(text);
    if (Object.keys(answers).length === 0) {
      setError('Khong tim thay dap an nao trong text. VD: 1A 2B 3C 4D');
      setPending(null);
      return;
    }
    setPending(answers);
  };

  const apply = () => {
    const source = tab === 'manual' ? manual : validPending;
    if (!source) return;
    const filtered: Record<number, AnswerKey> = {};
    Object.entries(source).forEach(([k, v]) => {
      const idx = parseInt(k, 10);
      if (idx >= 1 && idx <= questions.length) filtered[idx] = v;
    });
    if (Object.keys(filtered).length === 0) {
      setError('Khong co dap an hop le de ap dung.');
      return;
    }
    onApply(filtered);
    onClose();
  };

  const previewList = validPending ? Object.entries(validPending).sort((a, b) => parseInt(a[0]) - parseInt(b[0])) : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import dap an ({questions.length} cau)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-4">
          {(
            [
              { key: 'ai', label: 'Tu anh (OCR)' },
              { key: 'text', label: 'Tu text' },
              { key: 'manual', label: 'Chon tay' },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(''); setPending(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {tab === 'ai' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tai anh bang dap an IN SAN dang "1. A  2. B  3. C..." de OCR doc va phan tich. OCR khong doc duoc phieu to/cham den (da danh dau bang tay).
              </p>
              <label className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm cursor-pointer">
                Chon anh dap an
                <input type="file" accept="image/*" multiple onChange={handleImageFiles} className="hidden" />
              </label>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative">
                      <img
                        src={src}
                        alt={`Anh ${i + 1}`}
                        className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                      />
                      <button
                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                        title="Bo anh nay"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleAiRecognize}
                disabled={aiLoading || images.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiLoading ? 'Dang nhan dang...' : 'Nhan dang dap an'}
              </button>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Lan dau tien se tai bo nhan dang tieng Viet tu CDN (mat vai giay).
              </p>
            </div>
          )}

          {tab === 'text' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nhap dap an theo dang "1A 2B 3C 4D" hoac "1. A 2. B 3. C". Moi dap an ung voi so thu tu cau hoi.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="1A 2B 3C 4D ..."
              />
              <button
                onClick={handleParseText}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Phan tich dap an
              </button>
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chon dap an dung cho tung cau:
              </p>
              <div className="space-y-2">
                {questions.map((q, idx) => {
                  const num = idx + 1;
                  return (
                    <div key={q.id} className="flex items-center gap-3 text-sm">
                      <span className="w-8 shrink-0 text-gray-500">{num}.</span>
                      <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-white">{q.content}</span>
                      <select
                        value={manual[num] || 'A'}
                        onChange={(e) => setManual((prev) => ({ ...prev, [num]: e.target.value as AnswerKey }))}
                        className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shrink-0"
                      >
                        {ALL_LABELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {validPending && previewList.length > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                Da nhan dang {previewList.length} dap an hop le:
              </p>
              <div className="flex flex-wrap gap-1">
                {previewList.map(([k, v]) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300"
                  >
                    {k}. {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
          >
            Huy
          </button>
          <button
            onClick={apply}
            disabled={tab === 'manual' ? false : !validPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ap dung dap an
          </button>
        </div>
      </div>
    </div>
  );
}
