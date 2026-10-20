"use client";

import { useEffect, useMemo, useState } from "react";
import { extractSkills } from "@/lib/skills";
import type { Profile, ScoredJob } from "@/lib/store";
import { PIPELINE, type PipelineStatus } from "@/lib/store";
import { MatchRing, SOURCE_BADGE, SOURCE_LABEL, formatPosted } from "./JobCard";

export default function JobDrawer({
  scored,
  profile,
  status,
  note,
  onClose,
  onStatusChange,
  onNoteChange,
}: {
  scored: ScoredJob;
  profile: Profile;
  status: PipelineStatus;
  note: string;
  onClose: () => void;
  onStatusChange: (s: PipelineStatus) => void;
  onNoteChange: (note: string) => void;
}) {
  const { job, matchedSkills, percent } = scored;
  const [description, setDescription] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDescription(null);
    setDetailError(null);
    fetch(`/api/detail?url=${encodeURIComponent(job.url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.description) setDescription(data.description as string);
        else setDetailError(data.error ?? "Không tải được mô tả.");
      })
      .catch(() => {
        if (!cancelled) setDetailError("Không tải được mô tả chi tiết.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job.url]);

  // Kỹ năng trong JD (thuộc catalog) mà profile chưa có → chips vàng "còn thiếu".
  const missingSkills = useMemo(() => {
    if (!description) return [];
    const inJd = extractSkills(`${job.title} ${description}`);
    return inJd.filter(
      (s) => !profile.skills.some((ps) => ps.toLowerCase() === s.toLowerCase())
    );
  }, [description, job.title, profile.skills]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <MatchRing percent={percent} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-snug">{job.title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {job.company || "—"} · {job.location}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`chip ${SOURCE_BADGE[job.source]}`}>
                  {SOURCE_LABEL[job.source]}
                </span>
                <span className="chip bg-slate-100 text-slate-500">
                  🗓 Đăng {formatPosted(job.postedAt)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-500">Trạng thái:</label>
            <select
              className="input !w-auto !py-1.5 text-sm"
              value={status}
              onChange={(e) => onStatusChange(e.target.value as PipelineStatus)}
            >
              {PIPELINE.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary ml-auto !py-1.5"
            >
              Ứng tuyển ↗
            </a>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Kỹ năng khớp ({matchedSkills.length})
            </h3>
            {matchedSkills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.map((s) => (
                  <span key={s} className="chip bg-emerald-100 text-emerald-800">
                    ✓ {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Chưa có kỹ năng nào khớp.</p>
            )}
          </section>

          {missingSkills.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                JD yêu cầu thêm ({missingSkills.length}) — cơ hội bổ sung CV
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((s) => (
                  <span key={s} className="chip bg-amber-100 text-amber-800">
                    + {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Mô tả công việc</h3>
            {loading && <p className="text-sm text-slate-400">Đang tải mô tả…</p>}
            {detailError && !description && (
              <p className="text-sm text-slate-400">
                {detailError}{" "}
                <a
                  className="text-indigo-600 underline"
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Xem trực tiếp tại nguồn ↗
                </a>
              </p>
            )}
            {description && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {description}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Ghi chú của {profile.name}
            </h3>
            <textarea
              className="input min-h-24"
              placeholder="Ghi chú riêng cho job này (chỉ lưu trên trình duyệt của bạn)…"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
