import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Ở kiến trúc hiện tại, ingest chạy bằng GitHub Actions (cron 30 phút) trực tiếp
// trong repo và commit data/jobs.json — endpoint HTTP không đảm nhiệm ingest.
// Route này tồn tại để trả lời rõ ràng thay vì 404 khó hiểu.
export async function GET() {
  return NextResponse.json(
    {
      mode: "scheduled-github-actions",
      message:
        "Ingest chạy theo lịch bằng GitHub Actions (mỗi 30 phút) và commit vào data/jobs.json. Client hãy đọc GET /api/jobs.",
    },
    { status: 501 }
  );
}

export async function POST() {
  return GET();
}
