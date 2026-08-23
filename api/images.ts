// Vercel Serverless Function: /api/images
// LƯU Ý: Images được lưu trong localStorage của browser, không cần backend
// API này chỉ để tương thích với code cũ
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Trả về thông báo rằng tính năng này dùng localStorage
  return res.status(200).json({
    message: 'Images are stored in browser localStorage. No server storage needed.',
    note: 'This API endpoint is kept for backward compatibility but not used.',
  });
}
