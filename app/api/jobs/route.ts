import { NextResponse } from "next/server";
import type { PoolData } from "@/lib/store";

export const dynamic = "force-dynamic";

// Job pool dùng chung được GitHub Actions ingest vào data/jobs.json trong repo,
// route này đọc qua CDN/raw của GitHub rồi trả kèm cache header cho client.
const SOURCES = [
  "https://cdn.jsdelivr.net/gh/TriSBie/job-watcher-mvp@main/data/jobs.json",
  "https://raw.githubusercontent.com/TriSBie/job-watcher-mvp/main/data/jobs.json",
];

export async function GET() {
  let lastError: unknown = null;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PoolData;
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
        },
      });
    } catch (e) {
      lastError = e;
    }
  }
  return NextResponse.json(
    {
      jobs: [],
      updatedAt: null,
      sourceStatus: null,
      runs: [],
      error: `Không đọc được job pool: ${String(lastError)}`,
    },
    { status: 502 }
  );
}
