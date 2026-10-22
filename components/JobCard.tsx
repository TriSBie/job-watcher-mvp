"use client";

import type { ScoredJob, SourceId } from "@/lib/store";
import { PIPELINE, type PipelineStatus } from "@/lib/store";

export const SOURCE_LABEL: Record<SourceId, string> = {
  linkedin: "LinkedIn",
  itviec: "ITviec",
  topdev: "TopDev",
};

export const SOURCE_BADGE: Record<SourceId, string> = {
  linkedin: "bg-sky-400/10 text-sky-300",
  itviec: "bg-rose-400/10 text-rose-300",
  topdev: "bg-violet-400/10 text-violet-300",
};

export function MatchRing({ percent, small }: { percent: number; small?: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = percent >= 60 ? "#34d399" : percent >= 35 ? "#fbbf24" : "#62666b";
  const box = small ? "h-8 w-8" : "h-11 w-11";
  return (
    <div className={`relative ${box} shrink-0`} title={`Đáp ứng ${percent}% yêu cầu của job`}>
      <svg viewBox="0 0 36 36" className={`${box} -rotate-90`}>
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="3.5"
        />
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
      <span
        className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-ink ${
          small ? "text-[8px]" : "text-[10px]"
        }`}
      >
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
    <div className="card group flex gap-3 p-4 transition duration-200 hover:border-white/[0.14] hover:bg-surface-raised">
      <MatchRing percent={percent} />
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block w-full text-left">
          <h3 className="truncate font-medium leading-snug tracking-[-0.01em] text-ink transition group-hover:text-accent-hover">
            {job.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-ink-secondary">
            {job.company || "—"} · {job.location}
          </p>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`chip ${SOURCE_BADGE[job.source]}`}>
            {SOURCE_LABEL[job.source]}
          </span>
          <span className="chip bg-white/[0.04] tabular-nums text-ink-muted">
            {formatPosted(job.postedAt)}
          </span>
          {status !== "new" && (
            <span className="chip bg-accent/15 text-accent-hover">
              {PIPELINE.find((p) => p.id === status)?.label}
            </span>
          )}
        </div>
        {matchedSkills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {matchedSkills.slice(0, 6).map((s) => (
              <span key={s} className="chip bg-emerald-400/10 text-emerald-300">
                ✓ {s}
              </span>
            ))}
            {matchedSkills.length > 6 && (
              <span className="chip bg-white/[0.04] text-ink-muted">
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
