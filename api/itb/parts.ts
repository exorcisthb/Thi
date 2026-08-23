// Vercel Serverless Function: GET /api/itb/parts
import type { VercelRequest, VercelResponse } from '@vercel/node';
// Import data trực tiếp
import data from '../../public/data/itb-questions.json';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    return res.status(200).json(data.parts);
  } catch (error) {
    console.error('Error loading ITB parts:', error);
    return res.status(500).json({ 
      error: 'Failed to load parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
