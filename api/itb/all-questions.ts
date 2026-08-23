// Vercel Serverless Function: GET /api/itb/all-questions
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ItbQuestion {
  id: string;
  partNo: number;
  content: string;
  options: Record<string, string>;
  answers: string[];
  weight: number;
  explanation: string;
}

interface ItbData {
  parts: Array<{
    id: number;
    partNo: number;
    name: string;
    questionCount: number;
  }>;
  questions: ItbQuestion[];
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Chỉ cho phép GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Đọc file JSON từ public/data
    const dataPath = join(process.cwd(), 'public', 'data', 'itb-questions.json');
    const data: ItbData = JSON.parse(readFileSync(dataPath, 'utf8'));

    // Trả về danh sách câu hỏi
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 giờ
    return res.status(200).json(data.questions);
  } catch (error) {
    console.error('Error loading ITB questions:', error);
    return res.status(500).json({ error: 'Failed to load questions' });
  }
}
