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
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE.map((col) => {
        const colItems = items.filter((i) => i.status === col.id);
        return (
          <div
            key={col.id}
            className={`w-64 shrink-0 rounded-2xl border p-2 transition ${
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
            <div className="flex items-center justify-between px-2 py-1.5">
              <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
              <span className="chip bg-white text-slate-500">{colItems.length}</span>
            </div>
            <div className="space-y-2">
              {colItems.map(({ scored }) => (
                <div
                  key={scored.job.id}
                  draggable
                  onDragStart={() => setDragJob(scored.job.id)}
                  onDragEnd={() => {
                    setDragJob(null);
                    setDragOver(null);
                  }}
                  className="card cursor-grab p-3 active:cursor-grabbing"
                >
                  <button
                    className="flex w-full items-start gap-2 text-left"
                    onClick={() => onOpen(scored.job.id)}
                  >
                    <MatchRing percent={scored.percent} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {scored.job.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {scored.job.company || "—"} · {scored.job.location}
                      </span>
                    </span>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className={`chip ${SOURCE_BADGE[scored.job.source]}`}>
                      {SOURCE_LABEL[scored.job.source]}
                    </span>
                    <span className="chip bg-slate-100 text-slate-500">
                      {formatPosted(scored.job.postedAt)}
                    </span>
                  </div>
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
