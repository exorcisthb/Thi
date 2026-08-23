// Vercel Serverless Function: GET /api/itb/parts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ItbPart {
  id: number;
  partNo: number;
  name: string;
  questionCount: number;
}

interface ItbData {
  parts: ItbPart[];
  questions: any[];
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dataPath = join(process.cwd(), 'public', 'data', 'itb-questions.json');
    const data: ItbData = JSON.parse(readFileSync(dataPath, 'utf8'));

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(data.parts);
  } catch (error) {
    console.error('Error loading ITB parts:', error);
    return res.status(500).json({ error: 'Failed to load parts' });
  }
}
