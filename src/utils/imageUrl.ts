// Tiện ích chuẩn hoá đường dẫn hình ảnh dựa theo Vite BASE_URL (hỗ trợ cả Local, Vercel và GitHub Pages)
export function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = url.replace(/^\//, '');
  return `${cleanBase}${cleanPath}`;
}
