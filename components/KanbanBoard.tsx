"use client";

import { useState } from "react";
import type { Profile } from "@/lib/store";
import { PIPELINE, type PipelineStatus, type ScoredJob } from "@/lib/store";
import { MatchRing, SOURCE_BADGE, SOURCE_LABEL, formatPosted } from "./JobCard";

interface ColumnItem {
  scored: ScoredJob;
  status: PipelineStatus;
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

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[440px] snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {PIPELINE.map((col) => {
        const colItems = items.filter((i) => i.status === col.id);
        return (
          <div
            key={col.id}
            className={`flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition sm:w-64 ${
              dragOver === col.id
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 bg-slate-100/60"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragJob) onStatusChange(dragJob, col.id);
              setDragJob(null);
              setDragOver(null);
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 bg-inherit px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
              <span className="chip bg-white text-slate-500">{colItems.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {colItems.map(({ scored }) => (
                <div
                  key={scored.job.id}
                  draggable
                  onDragStart={() => setDragJob(scored.job.id)}
                  onDragEnd={() => {
                    setDragJob(null);
                    setDragOver(null);
                  }}
                  className="card cursor-grab p-2.5 active:cursor-grabbing"
                >
                  <button
                    className="flex w-full items-start gap-2 text-left"
                    onClick={() => onOpen(scored.job.id)}
                  >
                    <MatchRing percent={scored.percent} small />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-snug text-slate-800 line-clamp-2">
                        {scored.job.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {scored.job.company || "—"}
                      </span>
                    </span>
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className={`chip ${SOURCE_BADGE[scored.job.source]}`}>
                      {SOURCE_LABEL[scored.job.source]}
                    </span>
                    <span className="chip bg-slate-100 text-slate-500">
                      {formatPosted(scored.job.postedAt)}
                    </span>
                  </div>
                  {scored.matchedSkills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {scored.matchedSkills.slice(0, 3).map((s) => (
                        <span key={s} className="chip bg-emerald-50 text-emerald-700">
                          ✓ {s}
                        </span>
                      ))}
                      {scored.matchedSkills.length > 3 && (
                        <span className="chip bg-slate-100 text-slate-500">
                          +{scored.matchedSkills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <select
                    className="input mt-2 !py-1 text-xs sm:hidden"
                    value={col.id}
                    onChange={(e) =>
                      onStatusChange(scored.job.id, e.target.value as PipelineStatus)
                    }
                    aria-label="Chuyển cột"
                  >
                    {PIPELINE.map((p) => (
                      <option key={p.id} value={p.id}>
                        Chuyển tới: {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {colItems.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-slate-400">
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
