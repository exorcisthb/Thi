// Giao tiep voi backend (server Express + SQLite) qua /api
import type { AnswerKey } from '../types';

export interface SavedImage {
  id: number;
  setId: string;
  fileName: string;
  createdAt: number;
}

export interface SavedImageDetail extends SavedImage {
  dataUrl: string;
}

export interface ItbPart {
  id: number;
  partNo: number;
  name: string;
  questionCount: number;
}

export interface ItbQuestion {
  index: number;
  content: string;
  options: Record<AnswerKey, string>;
  answers: AnswerKey[];
  weight: number;
  explanation: string;
}

export interface ItbPartDetail {
  part: Omit<ItbPart, 'questionCount'>;
  questions: ItbQuestion[];
}

const API_BASE = '/api';

async function handleResponse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = '';
    try {
      // Đọc text trước, sau đó parse JSON nếu cần
      const text = await resp.text();
      try {
        const err = JSON.parse(text);
        detail = err?.error || JSON.stringify(err);
      } catch {
        detail = text;
      }
    } catch {
      detail = 'Không đọc được response';
    }
    throw new Error(`Lỗi server (${resp.status}): ${detail.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

// Lay danh sach anh (khong kem dataUrl) cua mot bo cau hoi
export async function fetchSavedImages(setId: string): Promise<SavedImage[]> {
  const resp = await fetch(`${API_BASE}/images?setId=${encodeURIComponent(setId)}`);
  return handleResponse<SavedImage[]>(resp);
}

// Lay chi tiet anh (kem dataUrl) de xem lai / xu ly lai
export async function fetchSavedImageDetail(id: number): Promise<SavedImageDetail> {
  const resp = await fetch(`${API_BASE}/images/${id}`);
  return handleResponse<SavedImageDetail>(resp);
}

// Luu anh vao DB
export async function uploadImage(setId: string, fileName: string, dataUrl: string): Promise<SavedImage> {
  const resp = await fetch(`${API_BASE}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setId, fileName, dataUrl }),
  });
  return handleResponse<SavedImage>(resp);
}

// Xoa mot anh
export async function deleteImage(id: number): Promise<void> {
  const resp = await fetch(`${API_BASE}/images/${id}`, { method: 'DELETE' });
  await handleResponse<{ ok: boolean }>(resp);
}

// Xoa toan bo anh cua mot bo cau hoi
export async function deleteSetImages(setId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/sets/${encodeURIComponent(setId)}/images`, { method: 'DELETE' });
  await handleResponse<{ ok: boolean }>(resp);
}

// Danh sach cac phan cua bo de ITB
export async function fetchItbParts(): Promise<ItbPart[]> {
  const resp = await fetch(`${API_BASE}/itb/parts`);
  return handleResponse<ItbPart[]>(resp);
}

// Lay chi tiet mot phan ITB (kem tat ca cau hoi)
export async function fetchItbPart(partId: number): Promise<ItbPartDetail> {
  const resp = await fetch(`${API_BASE}/itb/parts/${partId}/questions`);
  return handleResponse<ItbPartDetail>(resp);
}

// Lay toan bo cau hoi ITB (de nap vao bo cau hoi trong app)
export async function fetchItbAllQuestions(): Promise<(ItbQuestion & { id: string; partNo: number })[]> {
  const resp = await fetch(`${API_BASE}/itb/all-questions`);
  return handleResponse<(ItbQuestion & { id: string; partNo: number })[]>(resp);
}
