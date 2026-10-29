"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Profile } from "@/lib/store";
import { PIPELINE, type PipelineStatus, type ScoredJob } from "@/lib/store";
import {
  MatchRing,
  SOURCE_BADGE,
  SOURCE_LABEL,
  Skeleton,
  formatPosted,
  useStatusFlash,
} from "./JobCard";

interface ColumnItem {
  scored: ScoredJob;
  status: PipelineStatus;
}

/**
 * Một thẻ kanban (T05). Dùng motion.div với layout + layoutId:
 * - layout: các thẻ còn lại trượt nhường chỗ khi một thẻ rời/khỏi cột;
 * - layoutId (theo job id): chính thẻ đang di chuyển trượt từ cột cũ sang
 *   cột mới thay vì nhảy tức thì (FLIP xuyên cây component).
 * Lưu ý: class transition ở đây là transition-colors, KHÔNG phải transition
 * mặc định — transition mặc định bao gồm transform sẽ xung đột với transform
 * mà Motion ghi inline mỗi frame.
 */
function KanbanCard({
  scored,
  status,
  isDragging,
  onOpen,
  onStatusChange,
  onDragStart,
  onDragEnd,
  onDragOverCard,
}: {
  scored: ScoredJob;
  status: PipelineStatus;
  isDragging: boolean;
  onOpen: () => void;
  onStatusChange: (s: PipelineStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: () => void;
}) {
  // T03/T05: flash xác nhận khi trạng thái đổi (đường mobile select).
  const flash = useStatusFlash(status);
  return (
    <motion.div
      layout
      layoutId={scored.job.id}
      animate={{
        scale: isDragging ? 1.02 : 1,
        rotate: isDragging ? 1 : 0,
        opacity: isDragging ? 0.95 : 1,
      }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOverCard();
      }}
      className={`card cursor-grab p-2.5 transition-colors duration-fast ease-motion hover:border-white/[0.14] hover:bg-surface-raised active:cursor-grabbing ${
        isDragging ? "shadow-[0_12px_32px_rgba(0,0,0,0.55)]" : ""
      } ${flash ? "animate-status-flash motion-reduce:animate-none" : ""}`}
    >
      <button
        className="flex w-full items-start gap-2 text-left"
        onClick={onOpen}
      >
        <MatchRing percent={scored.percent} small />
        <span className="min-w-0">
          <span className="block text-[13px] font-medium leading-snug text-ink line-clamp-2">
            {scored.job.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-secondary">
            {scored.job.company || "—"}
          </span>
        </span>
      </button>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className={`chip ${SOURCE_BADGE[scored.job.source]}`}>
          {SOURCE_LABEL[scored.job.source]}
        </span>
        <span className="chip bg-white/[0.04] tabular-nums text-ink-muted">
          {formatPosted(scored.job.postedAt)}
        </span>
      </div>
      {scored.matchedSkills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {scored.matchedSkills.slice(0, 3).map((s) => (
            <span key={s} className="chip bg-emerald-400/10 text-emerald-300">
              ✓ {s}
            </span>
          ))}
          {scored.matchedSkills.length > 3 && (
            <span className="chip bg-white/[0.04] text-ink-muted">
              +{scored.matchedSkills.length - 3}
            </span>
          )}
        </div>
      )}
      <select
        className="input mt-2 !py-1 text-xs sm:hidden"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as PipelineStatus)}
        aria-label="Chuyển cột"
      >
        {PIPELINE.map((p) => (
          <option key={p.id} value={p.id}>
            Chuyển tới: {p.label}
          </option>
        ))}
      </select>
    </motion.div>
  );
}

/** Skeleton khớp bố cục kanban (T01): 3 cột × 3 thẻ, dùng khi pool đang tải. */
export function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-2" aria-hidden="true">
      {[0, 1, 2].map((col) => (
        <div
          key={col}
          className="flex w-60 shrink-0 flex-col rounded-2xl border border-line bg-surface sm:w-64"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-8 !rounded-full" />
          </div>
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 p-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-14 !rounded-full" />
                  <Skeleton className="h-5 w-14 !rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KanbanBoard({
  items,
  profile,
  onOpen,
  onStatusChange,
}: {
  items: ColumnItem[];
  profile: Profile;
  onOpen: (jobId: string) => void;
  onStatusChange: (jobId: string, s: PipelineStatus) => void;
}) {
  const [dragJob, setDragJob] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStatus | null>(null);
  // Vị trí thả đang chỉ tới trong cột đích (index thẻ), để vẽ placeholder.
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const resetDrag = () => {
    setDragJob(null);
    setDragOver(null);
    setDropIndex(null);
  };

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[440px] snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {PIPELINE.map((col) => {
        const colItems = items.filter((i) => i.status === col.id);
        const showPlaceholder = (i: number) =>
          dragJob !== null && dragOver === col.id && dropIndex === i;
        return (
          <div
            key={col.id}
            className={`flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition duration-fast ease-motion sm:w-64 ${
              dragOver === col.id
                ? "border-accent bg-accent/[0.07]"
                : "border-line bg-surface"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
              // Kéo qua khoảng trống của cột → placeholder ở cuối cột.
              setDropIndex(colItems.length);
            }}
            onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragJob) {
                // Thả cùng cột là no-op thật: không gọi onStatusChange nên
                // state không đổi, không re-render thừa.
                const from = items.find((i) => i.scored.job.id === dragJob)?.status;
                if (from && from !== col.id) onStatusChange(dragJob, col.id);
              }
              resetDrag();
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
              <h3 className="text-[13px] font-medium text-ink">{col.label}</h3>
              <span className="chip bg-white/[0.05] tabular-nums text-ink-secondary">
                {colItems.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {colItems.map(({ scored }, i) => (
                <div key={scored.job.id}>
                  {showPlaceholder(i) && (
                    <div
                      aria-hidden="true"
                      className="mb-2 h-20 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/[0.05]"
                    />
                  )}
                  <KanbanCard
                    scored={scored}
                    status={col.id}
                    isDragging={dragJob === scored.job.id}
                    onOpen={() => onOpen(scored.job.id)}
                    onStatusChange={(s) => onStatusChange(scored.job.id, s)}
                    onDragStart={() => setDragJob(scored.job.id)}
                    onDragEnd={resetDrag}
                    onDragOverCard={() => {
                      setDragOver(col.id);
                      setDropIndex(i);
                    }}
                  />
                </div>
              ))}
              {showPlaceholder(colItems.length) && (
                <div
                  aria-hidden="true"
                  className="h-20 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/[0.05]"
                />
              )}
              {colItems.length === 0 && (
                <p
                  className={`px-2 py-3 text-center text-xs text-ink-muted ${
                    // T05: cột rỗng thành dropzone nét đứt pulse nhẹ CHỈ trong
                    // lúc đang kéo; bình thường vẫn là text tĩnh.
                    dragJob !== null
                      ? "animate-dropzone-pulse rounded-xl border-2 border-dashed py-6 motion-reduce:animate-none"
                      : ""
                  }`}
                >
                  Kéo job vào đây
                </p>
              )}
            </div>
          </div>
        );
      })}
      <span className="hidden">{profile.name}</span>
    </div>
  );
}
