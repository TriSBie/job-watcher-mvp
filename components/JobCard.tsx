"use client";

import type { ScoredJob, SourceId } from "@/lib/store";
import { PIPELINE, type PipelineStatus } from "@/lib/store";

export const SOURCE_LABEL: Record<SourceId, string> = {
  linkedin: "LinkedIn",
  itviec: "ITviec",
  topdev: "TopDev",
};

export const SOURCE_BADGE: Record<SourceId, string> = {
  linkedin: "bg-sky-100 text-sky-700",
  itviec: "bg-rose-100 text-rose-700",
  topdev: "bg-violet-100 text-violet-700",
};

export function MatchRing({ percent }: { percent: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = percent >= 40 ? "#059669" : percent >= 20 ? "#d97706" : "#94a3b8";
  return (
    <div className="relative h-11 w-11 shrink-0" title={`Khớp ${percent}% kỹ năng`}>
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
        {percent}%
      </span>
    </div>
  );
}

export function formatPosted(postedAt: string | null): string {
  if (!postedAt) return "Không rõ ngày đăng";
  const d = new Date(`${postedAt}T00:00:00`);
  if (Number.isNaN(d.getTime())) return postedAt;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function JobCard({
  scored,
  status,
  onOpen,
  onStatusChange,
}: {
  scored: ScoredJob;
  status: PipelineStatus;
  onOpen: () => void;
  onStatusChange: (s: PipelineStatus) => void;
}) {
  const { job, matchedSkills, percent } = scored;
  return (
    <div className="card group flex gap-3 p-4 transition hover:border-indigo-300 hover:shadow-md">
      <MatchRing percent={percent} />
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block w-full text-left">
          <h3 className="truncate font-semibold leading-snug text-slate-800 group-hover:text-indigo-700">
            {job.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {job.company || "—"} · {job.location}
          </p>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`chip ${SOURCE_BADGE[job.source]}`}>
            {SOURCE_LABEL[job.source]}
          </span>
          <span className="chip bg-slate-100 text-slate-500">
            🗓 {formatPosted(job.postedAt)}
          </span>
          {status !== "new" && (
            <span className="chip bg-indigo-100 text-indigo-700">
              {PIPELINE.find((p) => p.id === status)?.label}
            </span>
          )}
        </div>
        {matchedSkills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {matchedSkills.slice(0, 6).map((s) => (
              <span key={s} className="chip bg-emerald-50 text-emerald-700">
                ✓ {s}
              </span>
            ))}
            {matchedSkills.length > 6 && (
              <span className="chip bg-slate-100 text-slate-500">
                +{matchedSkills.length - 6}
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={onOpen}>
            Chi tiết
          </button>
          <select
            className="input !w-auto !py-1 text-xs sm:hidden"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as PipelineStatus)}
            aria-label="Chuyển trạng thái"
          >
            {PIPELINE.map((p) => (
              <option key={p.id} value={p.id}>
                Chuyển tới: {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
