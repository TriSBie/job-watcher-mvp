import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="vi" className={inter.variable}>
      <body className="bg-base font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
