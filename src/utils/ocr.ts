// OCR bằng Tesseract.js — chạy hoàn toàn cục bộ trong trình duyệt, không cần API key.
// Worker/core/ngon ngu tai ve tu CDN lan dau tien (can internet), sau do dung cache.

import { createWorker } from 'tesseract.js';
import type { Question, AnswerKey } from '../types';
import { generateId } from './storage';

let workerPromise: ReturnType<typeof createWorker> | null = null;

// Tao worker dung chung (mot lan), ngon ngu tieng Viet + tieng Anh
async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('vie+eng', 1, {
      logger: () => {},
    });
  }
  return workerPromise;
}

// Chuyen mot anh (data URL) thanh van ban
export async function ocrImageToText(dataUrl: string): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(dataUrl);
  return (data.text || '').trim();
}

// Chuyen nhieu anh thanh van ban, gop lai theo dung thu tu
export async function ocrImagesToText(images: string[]): Promise<string[]> {
  const texts: string[] = [];
  for (const img of images) {
    texts.push(await ocrImageToText(img));
  }
  return texts;
}

// Binh thuong hoa ky tu dac biet OCR hay doc sai.
// LUU Y: khong xoa chu so "1" hoac ky tu trong noi dung vi se lam hong so lieu/dap an.
function cleanLine(line: string): string {
  return line
    .replace(/[|]/g, '') // bỏ ký tự | OCR hay nhầm
    .replace(/\s+/g, ' ')
    .trim();
}

// Cat bot vien tren/duoi cua anh (header/footer giao dien Facebook) de OCR chi doc phan noi dung cau hoi.
// topFrac/bottomFrac la phan tram chieu cao tinh tu tren xuong / duoi len.
export function cropImageDataUrl(
  dataUrl: string,
  topFrac = 0.14,
  bottomFrac = 0.2,
  leftFrac = 0,
  rightFrac = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Khong doc duoc anh de cat'));
    img.onload = () => {
      try {
        const W = img.width;
        const H = img.height;
        const top = Math.round(H * topFrac);
        const bottom = Math.round(H * bottomFrac);
        const left = Math.round(W * leftFrac);
        const right = Math.round(W * rightFrac);
        const w = W - left - right;
        const h = H - top - bottom;
        if (w <= 0 || h <= 0) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, left, top, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

// Cac pattern nhiem cua anh chup giao dien Facebook
// LUU Y: dung ngoac gioi han do dai de tranh nuot mat noi dung cau hoi cung dong.
const FB_NOISE = [
  /mc\s*_?\s*question\s*_?\s*\d+/gi, // mc_question_1, mc question 1
  /\.(?:webp|jpe?g|png|gif)\b/gi, // duoi file anh
  /view media item/gi,
  /originally\s+posted\s+in\s+[\w_&()-]{0,40}/gi, // "Originally posted in ISC301_SP26_FE" (khong qua dong moi)
  /admin\s*©?\s*/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // ngay 31/3/26
  /l[úù]c\s*\d{1,2}:\d{2}/gi, // "luc 19:42"
  /·\s*\d{1,2}\s*(?:phút|giờ|ngày)\b/gi, // "· 3 phút"
  /bình\s*luận/gi,
  /báo\s*cáo/gi,
  /chuyển\s*tới/gi,
  /like\s*comment\s*share/gi,
  /\b\d{1,3}\s*\/\s*\d{1,3}\b/g, // so thu tu "1/50"
  /\bfxwm[^\s]*/gi, // reaction icon OCR sai
  /\bfx\s*wm[^\n]*/gi, // reaction icon OCR sai (co cach)
  /\bxwm[^\s]*/gi,
  /\bxwmlgr\s*[^\n]*/gi,
  /\bf\s*x\s*wm[^\n]*/gi,
];

function cleanOcrText(text: string): string {
  let out = text;
  for (const re of FB_NOISE) {
    out = out.replace(re, ' ');
  }
  // Làm sạch khoảng trắng, nhưng giữ cấu trúc dòng
  return out
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

// Dòng rác còn sót (ký tự lạ, icon, chỉ có số/ký hiệu, không có chữ thật)
function isNoiseLine(line: string): boolean {
  if (!line) return true;
  // Ký tự lạ OCR hay sinh ra khi doc icon/reaction: f, ®, ©, ±, ², mảnh emoji
  const printable = line.replace(/[^\x20-\x7E]/g, ''); // bỏ ký tự Unicode lạ
  if (printable.length === 0) return true;
  // Dòng chỉ toàn ký tự đặc biệt / icon
  if (line.replace(/[®©±²·•›»«~^#*&%$@!?\-+_=,.;:]/g, '').length <= 1) return true;
  // Dòng dạng "1 (Choose 1 answer)" còn sót sau khi header đã xử lý
  if (/^[\d\s()]+(?:choose\s+\d+\s+answers?|answer)/i.test(line) && line.length < 60) return true;
  // Dòng reaction icon: "= it L4", "it bình luận", "L4", "- - (6)"
  if (/^[=·:\-+*#]?\s*(?:it|iết|a|đết|L4|L\w{0,3}|bình)\s*(?:[L\d\s]|$)/i.test(line) && line.length < 30) return true;
  if (/^[-=·:]\s*[-=·:]\s*\(\d+\)?$/.test(line)) return true;
  return false;
}

// Cắt đuôi rác (reaction icon, ký tự lạ) bám cuối option/content. VD: "To improve website speed fxwmso t 9m"
function trimTrailingNoise(line: string): string {
  return line
    .replace(/\s+(?:t\s*9m|fxwm[^\s]*|xwm[^\s]*|9m|2Đ\w*|\w{4,}\d{4,})\s*$/i, '')
    .replace(/\s+[-=·:]{1,3}\s*\(\d+\)?$/, '')
    .replace(/\s+[®©±²]+$/, '')
    .replace(/\s+[A-Za-z0-9_]{2,6}\d{2,6}$/, '') // ma OCR sai cuoi: fxwmso, 2Đât6289n
    .trim();
}

// Cat phan giao dien FB truoc khi OCR
export async function ocrFacebookScreenshotToText(dataUrl: string): Promise<string> {
  const cropped = await cropImageDataUrl(dataUrl);
  const raw = await ocrImageToText(cropped);
  return cleanOcrText(raw);
}

// Nhan dien dong cau hoi: "1." "1)" "Cau 1:" "1)" "Câu 1."
const QUESTION_RE = /^(?:cau|câu)\s*(\d{1,3})[:\s.)]*\s*(.*)$/i;
const NUM_QUESTION_RE = /^(\d{1,3})[.)\]]\s*(.*)$/;

// Nhan dien tieu de cau hoi kieu: "Multiple Choice Question 1 (Choose 1 answer)"
const MC_HEADER_RE = /multiple\s*choice\s*question\s*\d+\s*(?:\(?choose[^)]*\)?)?/i;

// Nhan dien dong dap an: "A." "A)" "A." "B." ...
const OPTION_RE = /^([A-Ea-e])\s*[.)\]]\s*(.*)$/;

export interface OcrParsedQuestion {
  content: string;
  options: Partial<Record<AnswerKey, string>>;
  correctAnswer: AnswerKey | null;
}

// Phan tich text OCR -> danh sach cau hoi.
// OCR hay bi nhiễu nen parser cho phep:
//  - cau hoi co the nhieu dong
//  - option co the nhieu dong
//  - dap an dung khong xac dinh duoc tu OCR (de null -> nguoi dung tu nhap)
export function parseOcrTextToQuestions(text: string): OcrParsedQuestion[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const questions: OcrParsedQuestion[] = [];
  let current: { content: string; options: Partial<Record<AnswerKey, string>> } | null = null;
  let lastOption: AnswerKey | null = null;
  let pendingContent = '';

  const flush = () => {
    if (current && (current.content || Object.keys(current.options).length > 0)) {
      let content = current.content.trim();
      content = content.replace(/^(?:cau|câu)\s*\d{1,3}\s*[:\s.)]*/i, '').trim();
      content = content.replace(MC_HEADER_RE, '').trim();
      // Bo cac doan nhiem kieu so-thu-tu "1/50" dung dau
      content = content.replace(/^\d{1,3}\s*\/\s*\d{2,3}\s*/, '').trim();
      // Cat phan "Choose X answer" con sot
      content = content.replace(/\s*\(?\s*choose\s+\d+\s+answers?\.?\s*\)?\s*$/i, '').trim();
      if (content || Object.keys(current.options).length > 0) {
        questions.push({
          content,
          options: current.options,
          correctAnswer: null,
        });
      }
    }
    current = null;
    lastOption = null;
    pendingContent = '';
  };

  for (const raw of lines) {
    let line = cleanLine(raw);
    if (!line) continue;

    // Bo qua cac dong rac (icon, ky tu dac biet, so don)
    if (isNoiseLine(line)) continue;

    line = trimTrailingNoise(line);
    if (!line) continue;

    const qMatch = line.match(QUESTION_RE);
    const numMatch = !qMatch ? line.match(NUM_QUESTION_RE) : null;
    const optMatch = !qMatch && !numMatch ? line.match(OPTION_RE) : null;
    const headerMatch = line.match(MC_HEADER_RE);

    if (headerMatch) {
      // Dòng tieu de: bat dau cau hoi moi, bo het pendingContent rac phia truoc
      flush();
      pendingContent = '';
      current = { content: '', options: {} };
      lastOption = null;
    } else if (qMatch) {
      flush();
      current = { content: qMatch[2] || '', options: {} };
    } else if (numMatch && numMatch[2]) {
      flush();
      current = { content: numMatch[2], options: {} };
    } else if (optMatch) {
      const key = optMatch[1].toUpperCase() as AnswerKey;
      if (!current) current = { content: pendingContent || '', options: {} };
      current.options[key] = (current.options[key] || '') + optMatch[2];
      lastOption = key;
      pendingContent = '';
    } else {
      // Dong thuong: la tiep noi dung cau hoi hoac tiep noi dung option hien tai
      if (!current) current = { content: pendingContent || '', options: {} };
      if (lastOption && current.options[lastOption]) {
        current.options[lastOption] += ' ' + line;
      } else {
        current.content += (current.content ? ' ' : '') + line;
      }
      pendingContent = '';
    }
  }
  flush();

  return questions;
}

// Chuyen anh -> cau hoi (OCR + cat FB + parser)
export async function extractQuestionsFromImagesOcr(images: string[]): Promise<Question[]> {
  const results: Question[] = [];
  for (const img of images) {
    const text = await ocrFacebookScreenshotToText(img);
    const parsed = parseOcrTextToQuestions(text);
    for (const q of parsed) {
      // Bo cac dong "ra" (tieu de, ghi chu) khong co dap an nao di kem
      if (Object.keys(q.options).length === 0) continue;
      if (!q.content) continue;
      results.push({
        id: generateId(),
        content: q.content || '(Cau hoi khong ro)',
        options: { A: q.options.A || '', B: q.options.B || '', C: q.options.C || '', D: q.options.D || '', E: q.options.E || '' },
        correctAnswer: q.correctAnswer || 'A',
        weight: 1,
        explanation: '',
      });
    }
  }
  return results;
}
