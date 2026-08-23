// Vercel Serverless Function: GET /api/itb/parts
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const baseUrl = `https://${req.headers.host}`;
    const dataUrl = `${baseUrl}/data/itb-questions.json`;
    
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const data: ItbData = await response.json();

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data.parts);
  } catch (error) {
    console.error('Error loading ITB parts:', error);
    return res.status(500).json({ 
      error: 'Failed to load parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
