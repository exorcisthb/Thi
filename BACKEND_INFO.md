# Thông tin về Backend API

## Tình trạng hiện tại

App này có 2 phần:
1. **Frontend (React + Vite)**: Có thể deploy lên Vercel/GitHub Pages
2. **Backend (Express + SQLite)**: Server Node.js trong thư mục `server/`

## Vấn đề khi deploy lên Vercel/GitHub Pages

⚠️ **Vercel và GitHub Pages chỉ host static files** (HTML, CSS, JS), **không chạy được server Express**.

### Kết quả:
- ✅ Frontend hoạt động bình thường
- ❌ API `/api/itb/all-questions` trả về **404 Not Found**
- ℹ️ App vẫn chạy được, chỉ không tải được bộ đề ITB từ server

## Các giải pháp

### Giải pháp 1: Chấp nhận không có backend (khuyến nghị cho demo)
- Frontend hoạt động hoàn toàn với localStorage
- User tự tạo bộ câu hỏi
- Không có bộ đề ITB sẵn từ database

👉 **Không cần làm gì thêm** - app đã được code để xử lý trường hợp này.

### Giải pháp 2: Deploy backend riêng
Deploy server Express lên platform khác, sau đó update API URL:

**2a. Deploy server lên Railway/Render:**
1. Tạo project mới trên Railway.app hoặc Render.com
2. Deploy thư mục `server/`
3. Lấy URL của server (ví dụ: `https://your-app.railway.app`)
4. Cập nhật `src/utils/api.ts`:
   ```typescript
   const API_BASE = import.meta.env.VITE_API_URL || '/api';
   ```
5. Set environment variable trên Vercel:
   - Key: `VITE_API_URL`
   - Value: `https://your-app.railway.app/api`

**2b. Dùng Vercel Serverless Functions:**
- Chuyển các API routes trong `server/index.mjs` thành Vercel serverless functions
- Tạo thư mục `api/` ở root với các file `.ts` cho mỗi route
- Cần refactor code đáng kể

### Giải pháp 3: Dùng một platform khác
Deploy cả stack lên platform hỗ trợ full Node.js:
- Heroku
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- VPS riêng

## Chạy local với backend

Để chạy backend ở local:

```bash
# Terminal 1: Chạy backend
cd server
npm install
node index.mjs

# Terminal 2: Chạy frontend
npm run dev
```

Backend sẽ chạy ở `http://localhost:4300`

Vite proxy sẽ forward `/api/*` requests tới backend (xem `vite.config.ts`).

## Kết luận

✅ **Hiện tại**: App hoạt động tốt trên Vercel, chỉ không có bộ đề ITB từ database.

Nếu cần bộ đề ITB, chọn một trong các giải pháp trên và cấu hình theo hướng dẫn.
