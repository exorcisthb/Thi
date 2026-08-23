import { useState, useEffect, useCallback } from 'react';
import type { Question } from '../types';
import { fetchSavedImages, fetchSavedImageDetail, deleteImage, type SavedImage } from '../utils/api';
import { extractQuestionsFromImagesOcr } from '../utils/ocr';

interface SavedImagesProps {
  setId: string | null;
  refreshKey: number;
  onAddQuestion: (q: Question) => void;
  onNotify?: (msg: string) => void;
}

export default function SavedImages({ setId, refreshKey, onAddQuestion, onNotify }: SavedImagesProps) {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadImages = useCallback(async () => {
    if (!setId) {
      setImages([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list = await fetchSavedImages(setId);
      setImages(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong tai duoc danh sach anh.');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    loadImages();
  }, [loadImages, refreshKey]);

  const handleView = async (id: number) => {
    try {
      const detail = await fetchSavedImageDetail(id);
      setViewing(detail.dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong tai duoc anh.');
    }
  };

  const handleReprocess = async (id: number, name: string) => {
    setReprocessingId(id);
    setError('');
    try {
      const detail = await fetchSavedImageDetail(id);
      const questions = await extractQuestionsFromImagesOcr([detail.dataUrl]);
      if (questions.length === 0) {
        throw new Error('Khong tim thay cau hoi nao trong anh.');
      }
      questions.forEach((q) => onAddQuestion(q));
      onNotify?.(`Da xu ly lai anh "${name}" (${questions.length} cau hoi)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loi khi xu ly lai anh.');
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xoa anh nay khoi DB?')) return;
    setError('');
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      onNotify?.('Da xoa anh');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loi khi xoa anh.');
    }
  };

  if (!setId) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Anh da luu trong DB ({images.length})
        </h2>
        <button
          onClick={loadImages}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs disabled:opacity-50"
        >
          {loading ? 'Dang tai...' : 'Tai lai'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {images.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Chua co anh nao. Chon anh o phan "Import tu anh de thi" o tren, anh se tu dong duoc luu vao DB.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-700/50"
            >
              <button
                onClick={() => handleView(img.id)}
                className="w-full h-28 rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:opacity-90 transition-opacity"
                title="Xem anh"
              >
                <img
                  src={`/api/images/${img.id}/data`}
                  alt={img.fileName || `Anh ${img.id}`}
                  className="w-full h-full object-contain"
                />
              </button>
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={img.fileName}>
                  {img.fileName || `Anh ${img.id}`}
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleView(img.id)}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-[11px] hover:bg-blue-700 transition-colors"
                  >
                    Xem
                  </button>
                  <button
                    onClick={() => handleReprocess(img.id, img.fileName || `Anh ${img.id}`)}
                    disabled={reprocessingId === img.id}
                    className="flex-1 px-2 py-1 bg-teal-600 text-white rounded text-[11px] hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {reprocessingId === img.id ? 'Dang xu ly...' : 'Xu ly lai'}
                  </button>
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded text-[11px] hover:bg-red-700 transition-colors"
                  >
                    Xoa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal xem anh */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <div className="relative max-w-4xl w-full bg-white dark:bg-gray-800 rounded-lg p-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewing(null)}
              className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 text-lg hover:bg-red-600"
            >
              ×
            </button>
            <img src={viewing} alt="Anh da luu" className="w-full h-auto max-h-[80vh] object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
