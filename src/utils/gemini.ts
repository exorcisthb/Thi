import type { Question, AnswerKey } from '../types';
import { generateId } from './storage';

const GEMINI_MODEL = 'gemini-2.5-flash';
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Free tier giới hạn ~20 request/phút => tối thiểu 3.2s giữa các request
const MIN_REQUEST_INTERVAL_MS = 3200;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Đảm bảo mỗi request cách nhau tối thiểu MIN_REQUEST_INTERVAL_MS
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

// Trích thời gian "Please retry in X seconds" từ message lỗi 429
function extractRetrySeconds(detail: string): number {
  const m = detail.match(/retry\s+in\s+([0-9.]+)/i);
  if (m) {
    const s = parseFloat(m[1]);
    if (!isNaN(s)) return Math.min(s + 2, 120);
  }
  return 30;
}

// API key chi doc tu file .env (VITE_GEMINI_API_KEY). Khong luu key trong UI.
export function getGeminiApiKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';
}

// Chỉ dùng gemini-2.5-flash (model duy nhất được phép ở free tier)
export function getGeminiModel(): string {
  return GEMINI_MODEL;
}

// Chuyển file ảnh thành data URL (tự giảm kích thước nếu ảnh quá lớn)
export function fileToDataUrl(file: File, maxDim = 3072): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Khong doc duoc file anh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File khong phai anh hop le'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        if (scale >= 1) {
          resolve(reader.result as string);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function stripDataUrlPrefix(dataUrl: string): { mime: string; base64: string } {
  const commaIdx = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  return { mime, base64 };
}

// Gọi một model cụ thể, trả về text hoặc throw kèm finishReason/blockReason
async function callModel(
  model: string,
  prompt: string,
  images: string[],
  apiKey: string,
  temperature = 0.2
): Promise<{ text: string; finishReason: string; blockReason: string }> {
  const parts: unknown[] = [];
  images.forEach((img) => {
    const { mime, base64 } = stripDataUrlPrefix(img);
    parts.push({ inlineData: { mimeType: mime, data: base64 } });
  });
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
  };

  await throttle();

  const resp = await fetch(`${API_ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = '';
    try {
      const err = await resp.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await resp.text();
    }
    const err = new Error(`Loi Gemini API (${resp.status}): ${detail.slice(0, 400)}`) as Error & {
      status?: number;
      retryAfter?: number;
    };
    err.status = resp.status;
    if (resp.status === 429) {
      err.retryAfter = extractRetrySeconds(detail);
    }
    throw err;
  }

  const data = await resp.json();
  const partsOut = data?.candidates?.[0]?.content?.parts as
    | Array<{ text?: string } | undefined>
    | undefined;
  const text = (partsOut || []).map((p) => p?.text || '').join('').trim() || '';
  const finishReason = data?.candidates?.[0]?.finishReason || 'N/A';
  const blockReason = data?.promptFeedback?.blockReason || 'N/A';
  return { text, finishReason, blockReason };
}

// Gọi Gemini (gemini-2.5-flash) với ảnh.
// RECITATION xảy ra ngẫu nhiên khi trích xuất văn bản nguyên văn -> thử lại nhiều lần:
//  1) nhiệt độ thấp tăng dần, 2) nếu vẫn bị chặn thì thêm hướng dẫn "diễn đạt lại mạnh" để né lọc bản quyền.
// Lỗi 429 (hết quota) -> tự chờ rồi thử lại.
export async function callGeminiVision(prompt: string, images: string[]): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chua co API key trong file .env. Vui long kiem tra lai.');
  }

  const model = getGeminiModel();
  const temperatures = [0.1, 0.3, 0.6];

  // Các câu lệnh bổ sung để né RECITATION, thử tăng dần độ mạnh
  const recitationHints = [
    '',
    ' LƯU Ý VỀ BẢN QUYỀN: Tuyệt đối KHÔNG sao chép nguyên văn văn bản trong ảnh. Bạn PHẢI viết lại toàn bộ câu hỏi và đáp án bằng ngôn từ của riêng bạn (paraphrase), chỉ giữ nguyên ý nghĩa, số liệu, tên riêng và các đáp án A/B/C/D. Không trích dẫn câu chữ gốc.',
    ' QUAN TRỌNG: Đây là yêu cầu pháp lý — bạn không được tái tạo văn bản gốc. Hãy tóm tắt và diễn đạt lại nội dung câu hỏi thành lời văn hoàn toàn mới của bạn, giữ nguyên ý và các phương án A/B/C/D. Trả về JSON theo đúng cấu trúc đã yêu cầu.',
  ];

  for (let round = 0; round < recitationHints.length; round++) {
    const temperature = temperatures[round] ?? temperatures[temperatures.length - 1];
    const hint = recitationHints[round];
    const effectivePrompt = hint ? prompt + hint : prompt;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { text, finishReason, blockReason } = await callModel(
          model,
          effectivePrompt,
          images,
          apiKey,
          temperature
        );
        if (text) return text;
        if (finishReason === 'RECITATION') break; // chuyển sang round kế tiếp với hint mạnh hơn
        if (finishReason === 'SAFETY' || blockReason) {
          throw new Error(
            `Gemini da chan noi dung nay (finishReason: ${finishReason}, blockReason: ${blockReason}). ` +
              `Thu anh ro rang hon hoac kiem tra anh co chua noi dung nhan cam.`
          );
        }
      } catch (err) {
        const e = err as Error & { status?: number; retryAfter?: number };
        if (e.status === 429) {
          await sleep(e.retryAfter ? e.retryAfter * 1000 : 30000);
          continue; // chờ xong rồi thử lại
        }
        throw err;
      }
    }
  }

  throw new Error(
    `Gemini lien tuc bi chan loi RECITATION khi trich xuat noi dung nay (model: ${model}). ` +
      `App se tu cat anh thanh phan nho de thu lai. Neu van loi, ban nen tu cat anh thanh tung phan nho hon hoac dung anh ro hon.`
  );
}

// Trích xuất JSON từ text (bỏ markdown fences, lấy mảng hoặc object đầu tiên)
export function extractJson(text: string): unknown {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const arrStart = cleaned.indexOf('[');
  const objStart = cleaned.indexOf('{');
  if (arrStart >= 0 && (objStart < 0 || arrStart < objStart)) {
    const end = cleaned.lastIndexOf(']');
    if (end > arrStart) return JSON.parse(cleaned.slice(arrStart, end + 1));
  }
  if (objStart >= 0) {
    const end = cleaned.lastIndexOf('}');
    if (end > objStart) return JSON.parse(cleaned.slice(objStart, end + 1));
  }
  return JSON.parse(cleaned);
}

// Phân tích mảng câu hỏi từ kết quả AI (chưa có id)
export interface ParsedQuestion {
  content: string;
  options: Partial<Record<AnswerKey, string>>;
  correctAnswer: AnswerKey | null;
  weight: number;
  explanation: string;
}

export function parseQuestionsFromJson(data: unknown): ParsedQuestion[] {
  const arr = Array.isArray(data)
    ? data
    : (data as { questions?: unknown[] })?.questions;
  if (!Array.isArray(arr)) {
    throw new Error('Khong phan tich duoc cau hoi tu ket qua AI.');
  }
  return arr
    .map((item) => {
      const it = (item ?? {}) as Record<string, unknown>;
      const options = (it.options ?? {}) as Record<string, unknown>;
      const getOpt = (k: string) => (typeof options[k] === 'string' ? (options[k] as string) : '');
      const rawCorrect = it.correctAnswer != null ? String(it.correctAnswer).trim().toUpperCase() : '';
      const correctAnswer = 'ABCDE'.includes(rawCorrect) ? (rawCorrect as AnswerKey) : null;
      return {
        content: String(it.content || it.question || '').trim(),
        options: { A: getOpt('A'), B: getOpt('B'), C: getOpt('C'), D: getOpt('D'), E: getOpt('E') },
        correctAnswer,
        weight: Number(it.weight) || 1,
        explanation: String(it.explanation || ''),
      };
    })
    .filter((q) => q.content);
}

// Cắt một ảnh (data URL) thành nhiều dải ngang chồng lấp nhẹ, mỗi dải cao tối đa tileHeight px.
// Giúp giảm lượng văn bản mỗi lần gọi -> giảm khả năng bị RECITATION.
export async function tileImageDataUrl(dataUrl: string, tileHeight = 1800): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Khong doc duoc anh de cat'));
    img.onload = () => {
      try {
        const width = img.width;
        const height = img.height;
        if (height <= tileHeight) {
          resolve([dataUrl]);
          return;
        }
        const overlap = Math.round(tileHeight * 0.1);
        const step = tileHeight - overlap;
        const tiles: string[] = [];
        let y = 0;
        while (y < height) {
          const tileH = Math.min(tileHeight, height - y);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = tileH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Khong the tao canvas de cat anh'));
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, tileH);
          ctx.drawImage(img, 0, y, width, tileH, 0, 0, width, tileH);
          tiles.push(canvas.toDataURL('image/jpeg', 0.92));
          y += step;
        }
        resolve(tiles);
      } catch {
        reject(new Error('Loi khi cat anh'));
      }
    };
    img.src = dataUrl;
  });
}

// Chuyển toàn bộ ảnh đề thi thành danh sách câu hỏi.
// Xử lý TỪNG ẢNH + TỪNG DẢI CẮT MỘT (giảm lượng văn bản mỗi lần gọi -> giảm khả năng bị RECITATION) rồi gộp lại.
// Nếu vẫn bị RECITATION ở 1 dải, tự chia đôi dải đó và xử lý từng nửa.
export async function extractQuestionsFromImages(images: string[]): Promise<Question[]> {
  const results: Question[] = [];
  for (let i = 0; i < images.length; i++) {
    const tiles = await tileImageDataUrl(images[i]);
    for (let t = 0; t < tiles.length; t++) {
      const questions = await extractQuestionsFromTileWithRetry(tiles[t], 0);
      results.push(...questions);
    }
  }
  return results;
}

// Chia một ảnh thành 2 nửa ngang (chồng lấp nhẹ để không cắt mất câu hỏi ở ranh giới)
async function splitImageInHalf(dataUrl: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Khong doc duoc anh de chia doi'));
    img.onload = () => {
      try {
        const width = img.width;
        const height = img.height;
        const half = Math.ceil(height / 2);
        const overlap = Math.round(half * 0.1);
        const halves: string[] = [];
        for (const [y0, h] of [
          [0, half + overlap],
          [Math.max(0, half - overlap), height - (half - overlap)],
        ] as const) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Khong the tao canvas de chia anh'));
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, h);
          ctx.drawImage(img, 0, y0, width, h, 0, 0, width, h);
          halves.push(canvas.toDataURL('image/jpeg', 0.92));
        }
        resolve(halves);
      } catch {
        reject(new Error('Loi khi chia anh'));
      }
    };
    img.src = dataUrl;
  });
}

// Trích xuất từ một tile, nếu bị RECITATION thì chia đôi và thử lại (tối đa 2 cấp)
async function extractQuestionsFromTileWithRetry(tile: string, depth: number): Promise<Question[]> {
  try {
    return await extractQuestionsFromOneImage(tile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRecitation = msg.includes('RECITATION');
    if (isRecitation && depth < 2) {
      const halves = await splitImageInHalf(tile);
      const results: Question[] = [];
      for (const half of halves) {
        try {
          const qs = await extractQuestionsFromTileWithRetry(half, depth + 1);
          results.push(...qs);
        } catch {
          // bỏ qua nửa không đọc được, vẫn tiếp tục nửa còn lại
        }
      }
      if (results.length > 0) return results;
    }
    throw err;
  }
}

async function extractQuestionsFromOneImage(image: string): Promise<Question[]> {
  const prompt = `Ban la tro ly tao de thi trac nghiem tu anh de thi. Hay doc anh dinh kem va tao ra cac cau hoi trac nghiem tu noi dung trong anh.

QUAN TRONG NHAT - TRANH LOI BAN QUYEN: KHONG duoc sao chep nguyen van van ban trong anh. Hay VIET LAI moi cau hoi va dap an bang chinh loi van cua ban (rewrite/paraphrase), GIONG Y nghia, so lieu, ten rieng, ky hieu, thuat ngu. Giu nguyen dung thu tu cau hoi, khong bo sot, khong them bot cau.

Yeu cau:
1. Doc het cac cau hoi trac nghiem trong anh va tao ra cau hoi tuong ung cho TAT CA cac cau, giu dung thu tu.
2. Moi cau hoi tra ve mot object JSON voi cau truc:
{
  "content": "Noi dung cau hoi (viet lai bang loi cua ban)",
  "options": {"A": "Dap an A", "B": "Dap an B", "C": "Dap an C", "D": "Dap an D", "E": "Dap an E"},
  "correctAnswer": "B",
  "weight": 1,
  "explanation": "Giai thich ngan gon neu co, khong thi chuoi rong"
}
3. Viet lai TUNG dap an bang loi cua ban (paraphrase), khong sao chep nguyen van. Neu cau hoi khong co du 4 dap an, de cac o con lai la chuoi rong.
4. Neu trong anh co danh dau dap an dung (boi den, khoanh tron, gach chan, chu dam, tick ✓, hoac co bang/danh sach dap an o cuoi de) thi dien chinh xac correctAnswer theo dung ky tu A/B/C/D/E tuong ung trong bang dap an.
5. Neu KHONG xac dinh duoc dap an dung cho mot cau, de correctAnswer la "A" (nguoi dung se tu nhap sau).
6. Neu trong anh co phan van ban dai (doan van, bai doc) thi tom tat lai y chinh bang loi cua ban, KHONG sao chep nguyen van doan van do.
7. Day la de thi cua nguoi dung tu tao. Chi tra ve mot mang JSON hop le [...] boc toan bo cau hoi, khong kem bat ky text nao khac.`;

  const raw = await callGeminiVision(prompt, [image]);
  const parsed = extractJson(raw);
  const parsedQ = parseQuestionsFromJson(parsed);
  if (parsedQ.length === 0) {
    throw new Error('Khong tim thay cau hoi nao trong anh.');
  }
  return parsedQ.map((q) => ({
    id: generateId(),
    content: q.content,
    options: { A: q.options.A || '', B: q.options.B || '', C: q.options.C || '', D: q.options.D || '', E: q.options.E || '' },
    correctAnswer: q.correctAnswer || 'A',
    weight: q.weight || 1,
    explanation: q.explanation || '',
  }));
}

// Nhận dạng bảng/phần đáp án từ ảnh, trả về mapping số câu -> đáp án (1-based).
// Cũng cắt ảnh thành dải để tránh RECITATION.
export async function extractAnswersFromImages(images: string[]): Promise<Record<number, AnswerKey>> {
  const prompt = `Ban la tro ly doc bang/phan dap an trac nghiem. Hay doc anh dinh kem (bang dap an, danh sach dap an, hoac phieu to dap an) va trich xuat dap an dung cho tung cau.

Tra ve duy nhat mot object JSON voi cau truc: {"1": "B", "2": "A", "3": "C", ...}
- Key la so thu tu cau hoi (bat dau tu 1).
- Value la chu dap an A/B/C/D/E (chi in hoa).
- Chi bao gom nhung cau ban tim thay dap an.
- Neu khong xac dinh duoc chu dap an cho mot cau, bo qua cau do.
- Day la tai lieu cua nguoi dung, ban DUOC PHEP trich xuat du lieu. Chi can doc chu, khong can sao chep doan van dai.
- Chi tra ve JSON hop le, khong kem text khac.`;

  const result: Record<number, AnswerKey> = {};
  for (let i = 0; i < images.length; i++) {
    const tiles = await tileImageDataUrl(images[i]);
    for (let t = 0; t < tiles.length; t++) {
      const raw = await callGeminiVision(prompt, [tiles[t]]);
      const parsed = extractJson(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        continue;
      }
      Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
        const num = parseInt(k.replace(/[^0-9]/g, ''), 10);
        const letter = String(v).trim().toUpperCase().replace(/[^A-E]/g, '');
        if (!isNaN(num) && num > 0 && letter) {
          result[num] = letter as AnswerKey;
        }
      });
    }
  }
  return result;
}

// Phân tích đáp án từ text dạng "1A 2B 3C", "1. A 2. B", "1-A 2-B"
export function parseAnswerText(text: string): Record<number, AnswerKey> {
  const result: Record<number, AnswerKey> = {};
  const re = /(\d{1,4})\s*[.:\-)]?\s*([A-Ea-e])\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const letter = match[2].toUpperCase() as AnswerKey;
    if (!isNaN(num) && num > 0) result[num] = letter;
  }
  return result;
}
