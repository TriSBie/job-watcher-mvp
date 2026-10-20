import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Watcher — Săn việc IT theo CV của bạn",
  description:
    "Quét việc từ LinkedIn, ITviec và TopDev, chấm điểm khớp theo kỹ năng trong CV, quản lý pipeline ứng tuyển bằng kanban.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
