# Job Watcher MVP

Web app săn việc IT: hệ thống tự quét việc từ **LinkedIn, ITviec, TopDev** vào một
job pool dùng chung; mỗi người dùng tạo hồ sơ kỹ năng (có thể trích từ CV PDF) và
app chấm điểm khớp, quản lý pipeline ứng tuyển bằng kanban — ngay trên trình duyệt.

## Kiến trúc

- **Ingest theo lịch (dữ liệu chung):** GitHub Actions chạy `scripts/ingest.mjs`
  mỗi 30 phút — quét 3 nguồn theo tập từ khoá chuẩn, lọc title, dedupe liên nguồn,
  dọn job quá 30 ngày, rồi commit vào `data/jobs.json`. Mỗi nguồn có circuit
  breaker riêng: nguồn lỗi thì giữ dữ liệu cũ của nguồn đó.
- **Đọc dữ liệu:** client gọi `GET /api/jobs` (route đọc `data/jobs.json` qua
  jsDelivr/raw GitHub, kèm header `Cache-Control: s-maxage=300`). Nút "Tải lại dữ
  liệu" chỉ đọc lại cache này — người dùng không kích hoạt việc quét nguồn.
- **Dữ liệu cá nhân:** hồ sơ, trạng thái pipeline, ghi chú lưu ở `localStorage`
  của từng trình duyệt (key `jwmvp:v1`). Chấm match chạy hoàn toàn ở client.
- **Chi tiết job:** mở drawer mới fetch lười qua `GET /api/detail?url=...`
  (server-side, tránh CORS; có cache header).
- **Onboarding:** wizard 3 bước khi chưa có hồ sơ — tên/khu vực → tải CV PDF
  (đọc bằng pdfjs ngay trên client, gợi ý kỹ năng để người dùng tick duyệt) →
  xác nhận.

## Chạy local

```bash
npm install
npm run dev        # http://localhost:3000
node scripts/ingest.mjs   # quét thủ công 1 vòng vào data/jobs.json
```

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS. Không database server,
không auth.
