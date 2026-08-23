# Hướng dẫn Deploy lên GitHub Pages

## Bước 1: Chuẩn bị

1. **Tạo repository trên GitHub**:
   - Vào https://github.com/new
   - Đặt tên repo (ví dụ: `quiz-app`)
   - Chọn Public hoặc Private (GitHub Pages miễn phí cho cả hai)
   - Tạo repository

2. **Cập nhật base path trong `vite.config.ts`**:
   ```typescript
   base: process.env.NODE_ENV === 'production' ? '/TÊN-REPO-CỦA-BẠN/' : '/',
   ```
   Thay `TÊN-REPO-CỦA-BẠN` bằng tên repo thực tế (ví dụ: `/quiz-app/`)

## Bước 2: Push code lên GitHub

```bash
# Khởi tạo git (nếu chưa có)
git init

# Add tất cả files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (thay YOUR-USERNAME và YOUR-REPO)
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Push lên GitHub
git branch -M main
git push -u origin main
```

## Bước 3: Cấu hình GitHub Pages

1. Vào repo trên GitHub
2. Vào **Settings** (tab bên phải)
3. Tìm **Pages** trong menu bên trái
4. Tại **Source**, chọn **GitHub Actions**
5. Lưu lại

## Bước 4: Deploy

Sau khi push code, GitHub Actions sẽ tự động:
- Build project
- Deploy lên GitHub Pages

Xem tiến trình tại: `Actions` tab trên GitHub

## Bước 5: Truy cập website

URL sẽ là: `https://YOUR-USERNAME.github.io/YOUR-REPO/`

Ví dụ: `https://johndoe.github.io/quiz-app/`

## Lưu ý quan trọng

### ⚠️ API Server không hoạt động trên GitHub Pages

GitHub Pages chỉ host **static files** (HTML, CSS, JS). Server Express không chạy được.

**Giải pháp**:

1. **Loại bỏ phụ thuộc server** (khuyến nghị):
   - Bỏ các tính năng cần server (ITB questions từ database)
   - Chỉ dùng localStorage + seed data
   - Sửa code để không gọi `/api/itb/*`

2. **Hoặc deploy server riêng**:
   - Deploy server lên Heroku/Railway/Render
   - Update API base URL trong code
   - Cấu hình CORS

### Sửa code để không cần server

Trong `App.tsx`, xóa hoặc comment đoạn này:

```typescript
// Auto-nap cac phan bo de ITB tu backend
useEffect(() => {
  // ... code fetch ITB từ server
}, []);
```

## Deploy lại (sau khi sửa code)

```bash
git add .
git commit -m "Update for GitHub Pages"
git push
```

GitHub Actions sẽ tự động build và deploy lại.

## Troubleshooting

### Build failed
- Kiểm tra lỗi trong **Actions** tab
- Thường do: thiếu dependencies, TypeScript errors

### 404 Not Found
- Kiểm tra `base` trong `vite.config.ts` có đúng tên repo không
- Phải có `/` ở đầu và cuối: `/quiz-app/`

### Trang trắng
- Mở Developer Console (F12) xem lỗi
- Thường do `base` path sai

### API không hoạt động
- GitHub Pages không chạy server Node.js
- Cần deploy server riêng hoặc bỏ tính năng cần server
