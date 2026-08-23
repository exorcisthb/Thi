# 🚀 Deploy Quiz App lên GitHub Pages

## ✅ ĐÃ CÀI ĐẶT

File cấu hình GitHub Actions đã được tạo sẵn tại `.github/workflows/deploy.yml`

## 📋 HƯỚNG DẪN NHANH

### 1. Sửa tên repo trong `vite.config.ts`

Mở file `vite.config.ts` và sửa dòng này:

```typescript
base: process.env.NODE_ENV === 'production' ? '/quiz-app/' : '/',
```

Thay `/quiz-app/` bằng `/TÊN-REPO-CỦA-BẠN/`

**Ví dụ**: Nếu repo của bạn tên là `thi-thu-itb`, sửa thành:
```typescript
base: process.env.NODE_ENV === 'production' ? '/thi-thu-itb/' : '/',
```

### 2. Push code lên GitHub

```bash
# Nếu chưa có git
git init
git add .
git commit -m "Initial commit"

# Thay YOUR-USERNAME và YOUR-REPO
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

### 3. Bật GitHub Pages

1. Vào repo trên GitHub
2. **Settings** → **Pages** (menu bên trái)
3. **Source**: Chọn **GitHub Actions**
4. Lưu

### 4. Đợi deploy

- Vào tab **Actions** để xem tiến trình
- Sau khi xong, truy cập: `https://YOUR-USERNAME.github.io/YOUR-REPO/`

## ⚠️ LƯU Ý QUAN TRỌNG VỀ SERVER

GitHub Pages **KHÔNG** chạy được Node.js server. Bạn có 2 lựa chọn:

### Lựa chọn 1: Bỏ server (Đơn giản nhất)

Xóa đoạn code load ITB từ server trong `src/App.tsx`:

```typescript
// XÓA HOẶC COMMENT đoạn này:
useEffect(() => {
  let cancelled = false;
  fetchItbAllQuestions()
    .then((all) => {
      // ... code
    })
    .catch((e) => console.warn('Khong the nap bo de ITB tu server:', e));
  return () => {
    cancelled = true;
  };
}, []);
```

App vẫn hoạt động với:
- Thêm câu hỏi thủ công
- Lưu trong localStorage
- Seed data có sẵn

### Lựa chọn 2: Deploy server riêng

Deploy server lên:
- **Railway.app** (miễn phí, dễ dùng)
- **Render.com** (miễn phí)
- **Heroku** (có phí)

Sau đó sửa API base URL trong code.

## 🔄 CẬP NHẬT SAU KHI DEPLOY

Mỗi lần sửa code:

```bash
git add .
git commit -m "Mô tả thay đổi"
git push
```

GitHub Actions sẽ tự động build và deploy lại.

## 🛠️ TROUBLESHOOTING

### Build failed (màu đỏ trong Actions)
- Xem log chi tiết trong Actions
- Thường do: TypeScript errors, thiếu dependencies
- Fix lỗi → commit → push lại

### Trang trắng sau deploy
1. F12 mở Console xem lỗi
2. Kiểm tra `base` trong `vite.config.ts` có đúng không
3. Phải có `/` ở đầu VÀ cuối: `/my-repo/`

### 404 Not Found cho các route
- GitHub Pages chỉ host static files
- Không có server-side routing
- Tất cả routes đều trỏ về `index.html`

### API không hoạt động
- GitHub Pages không chạy Node.js
- Cần deploy server riêng HOẶC bỏ phần phụ thuộc server

## 📚 TÀI LIỆU THAM KHẢO

- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [Vite Deploy Guide](https://vitejs.dev/guide/static-deploy.html#github-pages)
- [GitHub Actions](https://docs.github.com/en/actions)

## 💡 MẸO

1. **Test local trước khi deploy**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Xem site ngay sau deploy**:
   - Vào Actions → Click workflow mới nhất
   - Xem "Deploy to GitHub Pages" step
   - Có link đến site

3. **Custom domain** (nếu muốn):
   - Settings → Pages → Custom domain
   - Cấu hình DNS theo hướng dẫn GitHub

## 🎉 DONE!

Sau khi làm theo các bước trên, quiz app của bạn sẽ online tại:

**`https://YOUR-USERNAME.github.io/YOUR-REPO/`**

Chia sẻ link này cho bạn bè để cùng học!
