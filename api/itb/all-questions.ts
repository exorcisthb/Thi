// Vercel Serverless Function: GET /api/itb/all-questions
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Chỉ cho phép GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch data từ public URL thay vì đọc file
    const baseUrl = `https://${req.headers.host}`;
    const dataUrl = `${baseUrl}/data/itb-questions.json`;
    
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const data: ItbData = await response.json();

    // Trả về danh sách câu hỏi
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data.questions);
  } catch (error) {
    console.error('Error loading ITB questions:', error);
    return res.status(500).json({ 
      error: 'Failed to load questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
