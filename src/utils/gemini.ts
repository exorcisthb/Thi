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

// ==========================================
// CHATBOT ASSISTANT (GEMINI 2.5 FLASH)
// ==========================================

import { getImageUrl } from './imageUrl';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface QuestionContext {
  subject?: string;
  setName?: string;
  questionNumber?: number;
  content?: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  correctAnswers?: string[];
  explanation?: string;
  imageUrl?: string;
  imageBase64?: { mimeType: string; data: string } | null;
}

// Chuyển ảnh từ URL sang Base64 để gửi trực tiếp cho Gemini Multimodal Vision
export async function fetchImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const fullUrl = getImageUrl(imageUrl);
    const resp = await fetch(fullUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resStr = reader.result as string;
        const matches = resStr.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          resolve({ mimeType: matches[1], data: matches[2] });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Không thể nạp ảnh câu hỏi cho Gemini Vision:', err);
    return null;
  }
}

const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

export async function sendGeminiChatMessage(
  messages: { role: 'user' | 'model'; text: string }[],
  context?: QuestionContext | null,
  customApiKey?: string,
  onRetryProgress?: (attempt: number, maxAttempts: number, statusMsg?: string) => void
): Promise<string> {
  const apiKey = (customApiKey || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error('Chưa có Gemini API Key! Vui lòng cấu hình VITE_GEMINI_API_KEY trong file .env hoặc nhập key trong cài đặt Chatbot.');
  }

  // Build System Instruction: chuyên sâu, sư phạm, bảo toàn đáp án, mở rộng tình huống thi
  let systemText = `Bạn là Trợ lý Gia sư AI chuyên sâu về ôn thi và giải đề trắc nghiệm Đại học FPT (sử dụng model Gemini 2.5 Flash).

MỤC TIÊU CỐT LÕI:
Giúp sinh viên hiểu cặn kẽ bản chất câu hỏi, nắm vững tư duy logic môn học để khi đi thi gặp bất kỳ dạng đề biến thể hay câu hỏi tình huống nào cũng biết cách tư duy chính xác, không học vẹt.

QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):

1. NGUYÊN TẮC BẢO TOÀN ĐÁP ÁN (TUYỆT ĐỐI KHÔNG TỰ ĐỔI ĐÁP ÁN):
   - Đáp án đúng chính thức của câu hỏi được ghi trong phần [NGỮ CẢNH CÂU HỎI HIỆN TẠI] (mục "Đáp án đúng theo hệ thống").
   - TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý ĐẢO ĐÁP ÁN hay thay đổi đáp án đúng của câu hỏi này khi người dùng trò chuyện, hỏi xoáy, thắc mắc hoặc thảo luận về một phương án khác (ví dụ: người dùng hỏi "upstream là gì?", "sao biết cái nào trước cái nào sau?" KHÔNG ĐƯỢC tự ý biến phương án upstream/A thành đáp án đúng của câu này!). Đáp án đúng của câu hỏi luôn giữ nguyên.
   - Luôn phân biệt rạch ròi:
     (1) Đáp án đúng của câu hỏi này vẫn là [Đáp án chính thức theo hệ thống].
     (2) Giải thích rõ khái niệm mà người dùng thắc mắc, phân tích cơ chế và chỉ ra trường hợp nào thì khái niệm đó mới là đáp án đúng trong một câu hỏi khác.

2. CÁCH PHẢN HỒI THÔNG MINH THEO TỪNG TÌNH HUỐNG:

   👉 TÌNH HUỐNG A - KHI GIẢI THÍCH TỔNG QUAN CÂU HỎI (người dùng bấm "Vì sao đúng?", "Hỏi AI" hoặc mới gửi câu hỏi):
      Trình bày gãy gọn, chuyên sâu với cấu trúc:
      - **Đáp án đúng**: [Ký tự A/B/C/D] - [Nội dung tóm tắt ngắn]
      - **Bản chất logic & Vì sao đúng**: Phân tích cốt lõi lý thuyết/giáo trình chuẩn trong 2 - 3 câu, chỉ rõ mốc tham chiếu và cơ chế logic.
      - **Vì sao các phương án khác chưa đúng**: Chỉ ra điểm sai hoặc bẫy đề thi của từng phương án còn lại trong 1 - 2 câu.
      - **MỞ RỘNG - KHI NÀO CHỌN CÁC ĐÁP ÁN KHÁC (RẤT QUAN TRỌNG)**:
        Chỉ rõ nếu đề thi thay đổi cách hỏi hoặc tình huống thì khi nào sẽ chọn từng phương án A, B, C, D còn lại:
        * *Chọn [Phương án A] khi*: [Mô tả tình huống / dạng câu hỏi biến thể]
        * *Chọn [Phương án B] khi*: [Mô tả tình huống / dạng câu hỏi biến thể]
        * *Chọn [Phương án C/D] khi*: [Mô tả tình huống / dạng câu hỏi biến thể]
      - **Mẹo nhớ thi**: 1 từ khóa (keyword) hoặc quy tắc liên tưởng thực tế ngắn gọn để nhận diện nhanh khi vào phòng thi.

   👉 TÌNH HUỐNG B - KHI NGƯỜI DÙNG HỎI TIẾP (Follow-up chat, hỏi sâu, thắc mắc từ ngữ, so sánh các trường hợp, phản biện):
      - TUYỆT ĐỐI KHÔNG lặp lại khuôn mẫu 4 mục ("Đáp án đúng / Lý do / Vì sao sai / Mẹo nhớ") một cách máy móc!
      - ĐI THẲNG VÀO TRẢ LỜI TRỰC TIẾP ĐIỀU NGƯỜI DÙNG ĐANG BĂN KHOĂN:
        * Trả lời trực diện vào câu hỏi: chỉ rõ mốc tham chiếu nằm ở đâu, trình tự chuẩn trong chuỗi quy trình thực tế là gì, tại sao môn học lại quy ước như vậy (ví dụ: trong chuỗi Order-to-Cash, trình tự tự nhiên là Đặt hàng -> Giao hàng -> Thanh toán, nên bước đi sau là Downstream, bước đi trước là Upstream).
        * LUÔN ĐƯA RA BẢN ĐỒ TÌNH HUỐNG SO SÁNH ("KHI NÀO CHỌN CÁI NÀY - KHI NÀO CHỌN CÁI KIA"):
          Vạch rõ sự khác biệt giữa các phương án, trường hợp cụ thể nào trong đề thi thì chọn đáp án này, trường hợp nào thì chọn đáp án kia.
        * Sử dụng ví dụ trực quan (sơ đồ dòng chảy A ➔ B ➔ C), lời văn sư phạm dễ hiểu, tự nhiên, thuyết phục.

3. QUAN TRỌNG VỀ VĂN PHONG VÀ BẢN QUYỀN:
   - TUYỆT ĐỐI KHÔNG mở bài chào hỏi xã giao rườm rà ("Chào bạn!", "Mình hiểu bạn đang hỏi...", "Trong lúc chờ đợi...").
   - Hãy luôn tự diễn giải nội dung bằng văn phong sư phạm của bạn một cách cô đọng, súc tích, logic.
   - TUYỆT ĐỐI KHÔNG chép nguyên văn từng đoạn câu chữ dài từ giáo trình hay tài liệu mạng để tránh bị kích hoạt bộ lọc kiểm duyệt bản quyền (Recitation filter).

4. KHI CÂU HỎI CÓ HÌNH ẢNH KÈM THEO:
   - Bạn được cung cấp trực tiếp ảnh chụp đề thi gốc. Hãy QUAN SÁT VÀ ĐỌC TRỰC TIẾP từ hình ảnh để thấy đầy đủ câu hỏi, 4 phương án A, B, C, D và đáp án được đánh dấu/khoanh tròn/tô màu trên ảnh.
   - TUYỆT ĐỐI KHÔNG phàn nàn thiếu thông tin hoặc yêu cầu người dùng cung cấp thêm phương án.
5. Trả lời bằng tiếng Việt chuẩn xác, sử dụng Markdown in đậm ở các đề mục.`;

  const hasOptions = context?.options && Object.values(context.options).some((v) => Boolean(v && v.trim()));

  if (context && (context.content || context.imageUrl)) {
    systemText += `\n\n[NGỮ CẢNH CÂU HỎI HIỆN TẠI]:
- Môn học: ${context.subject || 'Đại học FPT'}
- Bộ đề: ${context.setName || 'Chưa xác định'}
- Câu số: ${context.questionNumber || 'N/A'}
- Nội dung câu hỏi: ${context.content || 'Xem trên ảnh đính kèm'}
${hasOptions ? `- Các phương án lựa chọn:\n${Object.entries(context.options || {})
  .filter(([_, val]) => Boolean(val && val.trim()))
  .map(([k, val]) => `  ${k}. ${val}`)
  .join('\n')}` : '- Các phương án lựa chọn: (Được chụp trực tiếp trong ảnh đính kèm)'}
- Đáp án đúng theo hệ thống: ${context.correctAnswers?.join(', ') || context.correctAnswer || 'Xem đánh dấu trên ảnh'}
${context.explanation ? `- Ghi chú đề bài: ${context.explanation}` : ''}
${context.imageUrl ? `- Có ảnh đề thi đính kèm trực tiếp trong yêu cầu.` : ''}`;
  }

  // Chuẩn bị ảnh base64 nếu có imageUrl
  let imageInlinePart: { inlineData: { mimeType: string; data: string } } | null = null;
  if (context?.imageBase64) {
    imageInlinePart = { inlineData: context.imageBase64 };
  } else if (context?.imageUrl) {
    const fetched = await fetchImageAsBase64(context.imageUrl);
    if (fetched) {
      imageInlinePart = { inlineData: fetched };
    }
  }

  // 1. Làm sạch danh sách tin nhắn: loại bỏ tin nhắn chào ban đầu và các tin nhắn báo lỗi
  const cleanedMessages = messages.filter((m) => {
    const text = m.text.trim();
    if (!text) return false;
    if (m.role === 'model') {
      if (text.startsWith('⚠️') || text.includes('Không thể kết nối Gemini')) return false;
      if (text.includes('Xin chào bạn!') || text.includes('Cuộc trò chuyện đã được làm mới')) return false;
    }
    return true;
  });

  // 2. Đảm bảo tin nhắn đầu tiên gửi cho Gemini luôn có role 'user'
  while (cleanedMessages.length > 0 && cleanedMessages[0].role !== 'user') {
    cleanedMessages.shift();
  }

  if (cleanedMessages.length === 0) {
    cleanedMessages.push({ role: 'user', text: 'Hãy giải thích câu hỏi này.' });
  }

  // 3. Giới hạn 10 tin nhắn gần nhất để giữ mạch trò chuyện thông minh và tránh tràn token
  const recentMessages = cleanedMessages.slice(-10);

  // 4. Định dạng contents đảm bảo xen kẽ role hợp lệ theo chuẩn Gemini API
  const formattedContents: { role: 'user' | 'model'; parts: any[] }[] = [];
  for (let i = 0; i < recentMessages.length; i++) {
    const m = recentMessages[i];
    const isLatest = i === recentMessages.length - 1;
    const parts: any[] = [];
    if (isLatest && m.role === 'user' && imageInlinePart) {
      parts.push(imageInlinePart);
    }
    parts.push({ text: m.text });

    if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === (m.role === 'model' ? 'model' : 'user')) {
      formattedContents[formattedContents.length - 1].parts.push(...parts);
    } else {
      formattedContents.push({
        role: m.role === 'model' ? 'model' : 'user',
        parts,
      });
    }
  }

  // Safety settings BLOCK_NONE cho cả 5 danh mục để tránh báo động giả với các môn lịch sử/chính trị (VNR202, HCM202)
  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
  ];

  const MAX_ATTEMPTS = 3;
  let lastErr: any = null;

  // Tự động thử lại tối đa 3 lần trước khi hiển thị thông báo lỗi cho người dùng
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      onRetryProgress?.(attempt, MAX_ATTEMPTS, `Đang tự động thử lại kết nối (lần ${attempt}/${MAX_ATTEMPTS})...`);
    }

    // Nhiệt độ tăng dần nếu bị ngắt do recitation (trùng tài liệu) để AI tự diễn đạt lại linh hoạt hơn
    const currentTemperature = attempt === 1 ? 0.35 : 0.5 + (attempt - 2) * 0.15;

    const body = {
      contents: formattedContents,
      systemInstruction: {
        parts: [{ text: systemText }],
      },
      safetySettings,
      generationConfig: {
        temperature: currentTemperature,
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    };

    // Lần lượt thử qua các candidate models (gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-flash-latest)
    for (const model of CANDIDATE_MODELS) {
      try {
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

          // Nếu model này bị 429 (hết quota) hoặc 503 (quá tải), ghi nhận lỗi và fallback sang model kế tiếp
          if (resp.status === 429 || resp.status === 503) {
            console.warn(`Model ${model} phản hồi ${resp.status}, tự động chuyển sang model kế tiếp...`);
            lastErr = new Error(`Model ${model} (${resp.status}): ${detail.slice(0, 200)}`);
            continue;
          }

          throw new Error(`Lỗi Gemini API (${resp.status}): ${detail.slice(0, 300)}`);
        }

        const data = await resp.json();
        const candidate = data?.candidates?.[0];
        const finishReason = candidate?.finishReason || 'N/A';
        const blockReason = data?.promptFeedback?.blockReason;

        if (blockReason) {
          console.warn(`Nội dung bị chặn bởi Gemini (${blockReason})`);
          lastErr = new Error(`Nội dung bị chặn bởi bộ lọc Gemini (${blockReason}).`);
          continue;
        }

        const partsOut = candidate?.content?.parts as Array<{ text?: string } | undefined> | undefined;
        const reply = (partsOut || []).map((p) => p?.text || '').join('').trim();

        // NẾU BỊ CẮT BỞI RECITATION (trùng khớp nguyên văn giáo trình):
        // KHÔNG trả về đoạn văn bị đứt giữa câu, ghi nhận để thử lại với diễn đạt mới
        if (finishReason === 'RECITATION') {
          console.warn(`Model ${model} bị cắt giữa chừng bởi bộ lọc RECITATION (trùng tài liệu). Tự động thử lại...`);
          lastErr = new Error('Câu trả lời bị cắt giữa chừng do trùng khớp văn bản giáo trình (Recitation). Đang tự động thử lại...');
          continue;
        }

        if (reply) {
          return reply;
        }

        if (finishReason && finishReason !== 'STOP') {
          lastErr = new Error(`Gemini kết thúc với mã ${finishReason}.`);
        }
      } catch (err: any) {
        lastErr = err;
      }
    }

    // Nếu các model trong lượt này chưa thành công và chưa hết 3 lần thử, chờ tăng dần rồi thử lại
    if (attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 1200);
    }
  }

  throw lastErr || new Error('Đã tự động thử lại 3 lần qua các model nhưng không nhận được phản hồi. Vui lòng thử lại!');
}
