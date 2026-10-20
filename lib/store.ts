"use client";

import { useCallback, useEffect, useState } from "react";
import { skillInText } from "./skills";

export type SourceId = "linkedin" | "itviec" | "topdev";
export type SourceStatus = Record<SourceId, "ok" | "error">;

export interface PoolJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: SourceId;
  postedAt: string | null; // ISO date
  snippet: string;
  skills: string[];
  firstSeenAt: number;
}

export interface IngestRun {
  at: string;
  fetched: number;
  added: number;
  total: number;
  perSource: Record<SourceId, number>;
  sourceStatus: SourceStatus;
}

export interface PoolData {
  jobs: PoolJob[];
  updatedAt: string | null;
  sourceStatus: SourceStatus | null;
  runs: IngestRun[];
}

export type PipelineStatus =
  | "new"
  | "viewing"
  | "saved"
  | "applied"
  | "interview"
  | "offer"
  | "skipped";

export const PIPELINE: { id: PipelineStatus; label: string }[] = [
  { id: "new", label: "Mới" },
  { id: "viewing", label: "Đang xem" },
  { id: "saved", label: "Đã lưu" },
  { id: "applied", label: "Đã apply" },
  { id: "interview", label: "Phỏng vấn" },
  { id: "offer", label: "Offer" },
  { id: "skipped", label: "Bỏ qua" },
];

export interface Profile {
  id: string;
  name: string;
  location: string;
  keywords: string[];
  skills: string[];
  createdAt: number;
}

export interface MatchState {
  status: PipelineStatus;
  note: string;
}

/** Dữ liệu CÁ NHÂN (lưu localStorage của từng visitor): hồ sơ + trạng thái pipeline + ghi chú.
 *  Job pool là dữ liệu CHUNG lấy từ /api/jobs, không lưu ở đây. */
export interface AppState {
  profiles: Profile[];
  matches: Record<string, Record<string, MatchState>>;
}

const STORAGE_KEY = "jwmvp:v1";
const EMPTY: AppState = { profiles: [], matches: {} };

function load(): AppState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AppState;
    return { profiles: parsed.profiles ?? [], matches: parsed.matches ?? {} };
  } catch {
    return EMPTY;
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage không khả dụng — app vẫn chạy trong phiên.
    }
  }, [state, hydrated]);

  const addProfile = useCallback((p: Omit<Profile, "id" | "createdAt">) => {
    const profile: Profile = {
      ...p,
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, profiles: [...s.profiles, profile] }));
    return profile;
  }, []);

  const updateProfile = useCallback((id: string, patch: Partial<Profile>) => {
    setState((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setState((s) => {
      const matches = { ...s.matches };
      delete matches[id];
      return { ...s, profiles: s.profiles.filter((p) => p.id !== id), matches };
    });
  }, []);

  const setMatch = useCallback(
    (profileId: string, jobId: string, patch: Partial<MatchState>) => {
      setState((s) => {
        const forProfile = { ...(s.matches[profileId] ?? {}) };
        const current = forProfile[jobId] ?? {
          status: "new" as PipelineStatus,
          note: "",
        };
        forProfile[jobId] = { ...current, ...patch };
        return { ...s, matches: { ...s.matches, [profileId]: forProfile } };
      });
    },
    []
  );

  return { state, hydrated, addProfile, updateProfile, deleteProfile, setMatch };
}

export interface ScoredJob {
  job: PoolJob;
  matchedSkills: string[];
  score: number;
  percent: number; // 0..100
  level: "strong" | "partial" | "weak";
}

/** Chấm điểm 1 job trong pool theo skills của profile (chạy ở client). */
export function scoreJob(job: PoolJob, profileSkills: string[]): ScoredJob {
  const text = `${job.title} ${job.snippet} ${job.skills.join(" ")}`;
  const matchedSkills = profileSkills.filter((s) => skillInText(s, text));
  const score = matchedSkills.length;
  const percent = profileSkills.length
    ? Math.round((score / profileSkills.length) * 100)
    : 0;
  const level: ScoredJob["level"] = score >= 4 ? "strong" : score >= 2 ? "partial" : "weak";
  return { job, matchedSkills, score, percent, level };
}
