"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { extractSkills } from "@/lib/skills";
import type { Profile, ScoredJob } from "@/lib/store";
import { PIPELINE, type PipelineStatus } from "@/lib/store";
import {
  MatchRing,
  SOURCE_BADGE,
  SOURCE_LABEL,
  Skeleton,
  formatPosted,
  useMinVisible,
  useStatusFlash,
} from "./JobCard";

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
  // T01: skeleton mô tả giữ tối thiểu 500ms để khỏi chớp.
  const descLoadingVisible = useMinVisible(loading);
  // T03: flash xác nhận khi đổi trạng thái trong drawer.
  const statusFlash = useStatusFlash(status);

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

  // Kỹ năng trong JD (thuộc catalog) mà profile chưa có → chips "còn thiếu".
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

  // T02: đóng drawer thì trả focus về nút đã mở nó, không mất focus vô cớ.
  // Cleanup chạy khi drawer unmount, tức là sau khi animation thoát kết thúc
  // (AnimatePresence giữ component sống trong lúc animation thoát chạy).
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    // T02: root fade 250ms (token base) + panel trượt từ phải 300ms (token slow).
    // Dưới reduced-motion, MotionConfig reducedMotion="user" ở page/dashboard
    // biến trượt thành fade/tức thì.
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="sticky top-0 z-10 border-b border-line bg-surface/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <MatchRing percent={percent} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-snug tracking-[-0.02em] text-ink">
                {job.title}
              </h2>
              <p className="mt-0.5 text-sm text-ink-secondary">
                {job.company || "—"} · {job.location}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`chip ${SOURCE_BADGE[job.source]}`}>
                  {SOURCE_LABEL[job.source]}
                </span>
                <span className="chip bg-white/[0.04] tabular-nums text-ink-muted">
                  Đăng {formatPosted(job.postedAt)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-ink-muted transition hover:bg-white/[0.06] hover:text-ink"
            >
              ✕
            </button>
          </div>
          <div
            className={`mt-4 flex flex-wrap items-center gap-2 ${
              statusFlash ? "animate-status-flash rounded-lg motion-reduce:animate-none" : ""
            }`}
          >
            <label className="text-sm text-ink-secondary">Trạng thái:</label>
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
              Xem tin gốc ↗
            </a>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <section>
            <h3 className="mb-2 text-sm font-medium text-ink">
              Kỹ năng khớp ({matchedSkills.length})
            </h3>
            {matchedSkills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.map((s) => (
                  <span key={s} className="chip bg-emerald-400/10 text-emerald-300">
                    ✓ {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Chưa có kỹ năng nào khớp.</p>
            )}
          </section>

          {missingSkills.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-ink">
                JD yêu cầu thêm ({missingSkills.length}) — cơ hội bổ sung CV
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((s) => (
                  <span key={s} className="chip bg-amber-400/10 text-amber-300">
                    + {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-medium text-ink">Mô tả công việc</h3>
            {/* T01: skeleton lines khớp bố cục đoạn mô tả, có aria-busy. Mô tả
                và lỗi chỉ hiện sau khi skeleton đủ 500ms để khỏi chớp. */}
            {descLoadingVisible && (
              <div aria-busy="true" aria-label="Đang tải mô tả">
                <span className="sr-only">Đang tải mô tả…</span>
                <div className="space-y-2" aria-hidden="true">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            )}
            {detailError && !description && !descLoadingVisible && (
              <p className="text-sm text-ink-muted">
                {detailError}{" "}
                <a
                  className="text-accent-hover underline"
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Xem trực tiếp tại nguồn ↗
                </a>
              </p>
            )}
            {description && !descLoadingVisible && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
                {description}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-ink">
              Ghi chú của {profile.name}
            </h3>
            <textarea
              className="input min-h-24"
              placeholder="Ghi chú riêng cho job này (chỉ lưu trên trình duyệt của bạn)…"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </section>

          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost w-full !py-2.5"
          >
            ↗ Xem trang chi tiết gốc tại {SOURCE_LABEL[job.source]}
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
