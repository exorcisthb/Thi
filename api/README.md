# Vercel Serverless Functions

API endpoints for quiz app deployed on Vercel.

## Available Endpoints

### GET /api/itb/all-questions
Trả về tất cả câu hỏi ITB từ file JSON.

**Response**: 
```json
[
  {
    "id": "1-1",
    "partNo": 1,
    "content": "What are the typical...",
    "options": {
      "A": "...",
      "B": "...",
      "C": "...",
      "D": "..."
    },
    "answers": ["B", "C", "D"],
    "weight": 1,
    "explanation": ""
  }
]
```

### GET /api/itb/parts
Trả về danh sách các phần của bộ đề ITB.

**Response**:
```json
[
  {
    "id": 1,
    "partNo": 1,
    "name": "ITB - Phần 1",
    "questionCount": 70
  }
]
```

## Data Source

- Data được parse từ file `Bộ đề.txt`
- Lưu trong `public/data/itb-questions.json`
- Generate tự động khi chạy `npm run build`

## Local Development

Để test API locally với Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Sau đó truy cập: `http://localhost:3000/api/itb/all-questions`
