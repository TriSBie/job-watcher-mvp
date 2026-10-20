"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Onboarding from "@/components/Onboarding";
import ProfileForm from "@/components/ProfileForm";
import JobCard, { SOURCE_LABEL } from "@/components/JobCard";
import KanbanBoard from "@/components/KanbanBoard";
import JobDrawer from "@/components/JobDrawer";
import {
  PIPELINE,
  scoreJob,
  useAppState,
  type PipelineStatus,
  type PoolData,
  type Profile,
  type ScoredJob,
} from "@/lib/store";
import { extractSkills } from "@/lib/skills";

type SortMode = "recommended" | "percent" | "newest";
type DateFilter = "24h" | "7d" | "30d" | "all";
type ViewMode = "list" | "kanban";

const POOL_CACHE_KEY = "jwmvp:pool";
const EMPTY_POOL: PoolData = { jobs: [], updatedAt: null, sourceStatus: null, runs: [] };

function timeAgo(iso: string | null): string {
  if (!iso) return "chưa có dữ liệu";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function HomePage() {
  const { state, hydrated, addProfile, updateProfile, deleteProfile, setMatch } =
    useAppState();
  const [pool, setPool] = useState<PoolData>(EMPTY_POOL);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number>(0);

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<PipelineStatus | "all">("all");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const autoFetched = useRef(false);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const data = (await res.json()) as PoolData & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPool(data);
      setPoolError(null);
      setLastFetchAt(Date.now());
      try {
        window.localStorage.setItem(POOL_CACHE_KEY, JSON.stringify(data));
      } catch {}
    } catch (e) {
      setPoolError(
        "Chưa tải được dữ liệu việc mới nhất — đang hiển thị bản cache gần nhất nếu có."
      );
      console.error(e);
    } finally {
      setPoolLoading(false);
    }
  }, []);

  // Nạp cache pool để hiển thị ngay, sau đó tải bản mới nếu cache quá 15 phút.
  useEffect(() => {
    if (autoFetched.current) return;
    autoFetched.current = true;
    let cachedAt = 0;
    try {
      const raw = window.localStorage.getItem(POOL_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as PoolData;
        setPool(cached);
        cachedAt = cached.updatedAt ? new Date(cached.updatedAt).getTime() : 0;
      }
    } catch {}
    if (Date.now() - cachedAt > 15 * 60000) {
      void loadPool();
    }
  }, [loadPool]);

  const activeProfile =
    state.profiles.find((p) => p.id === activeProfileId) ?? state.profiles[0] ?? null;

  useEffect(() => {
    if (activeProfile && activeProfileId !== activeProfile.id) {
      setActiveProfileId(activeProfile.id);
    }
  }, [activeProfile, activeProfileId]);

  const profileMatches = useMemo(
    () => (activeProfile ? state.matches[activeProfile.id] ?? {} : {}),
    [state.matches, activeProfile]
  );

  const scoredAll: ScoredJob[] = useMemo(() => {
    if (!activeProfile) return [];
    return pool.jobs.map((j) => scoreJob(j, activeProfile.skills));
  }, [pool.jobs, activeProfile]);

  const statusOf = useCallback(
    (jobId: string): PipelineStatus => profileMatches[jobId]?.status ?? "new",
    [profileMatches]
  );

  const filtered = useMemo(() => {
    let items = scoredAll.map((scored) => ({
      scored,
      status: statusOf(scored.job.id),
    }));
    if (statusTab !== "all") items = items.filter((i) => i.status === statusTab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.scored.job.title.toLowerCase().includes(q) ||
          i.scored.job.company.toLowerCase().includes(q)
      );
    }
    if (dateFilter !== "all") {
      const limitMs = dateFilter === "24h" ? 864e5 : dateFilter === "7d" ? 7 * 864e5 : 30 * 864e5;
      const cutoff = Date.now() - limitMs;
      items = items.filter((i) => {
        if (!i.scored.job.postedAt) return true; // thiếu ngày đăng thì luôn hiển thị
        return new Date(`${i.scored.job.postedAt}T00:00:00`).getTime() >= cutoff;
      });
    }
    const byPosted = (a: ScoredJob, b: ScoredJob) =>
      (b.job.postedAt ?? "") < (a.job.postedAt ?? "") ? -1 : (b.job.postedAt ?? "") > (a.job.postedAt ?? "") ? 1 : 0;
    items.sort((a, b) => {
      if (sort === "percent") return b.scored.percent - a.scored.percent || byPosted(a.scored, b.scored);
      if (sort === "newest") return byPosted(a.scored, b.scored);
      // Đề xuất: khớp mạnh trước, sau đó % và độ mới
      const rank = (s: ScoredJob) => (s.level === "strong" ? 0 : s.level === "partial" ? 1 : 2);
      return rank(a.scored) - rank(b.scored) || b.scored.percent - a.scored.percent || byPosted(a.scored, b.scored);
    });
    return items;
  }, [scoredAll, statusOf, statusTab, query, dateFilter, sort]);

  const stats = useMemo(() => {
    const total = scoredAll.length;
    const strong = scoredAll.filter((s) => s.level === "strong").length;
    const saved = Object.values(profileMatches).filter((m) => m.status === "saved").length;
    const applied = Object.values(profileMatches).filter((m) => m.status === "applied").length;
    return { total, strong, saved, applied };
  }, [scoredAll, profileMatches]);

  const hotSkills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of pool.jobs) {
      for (const s of j.skills) counts.set(s, (counts.get(s) ?? 0) + 1);
      for (const s of extractSkills(j.title)) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [pool.jobs]);

  const openScored = openJobId
    ? scoredAll.find((s) => s.job.id === openJobId) ?? null
    : null;

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Đang tải…
      </main>
    );
  }

  if (state.profiles.length === 0) {
    return (
      <main className="min-h-screen">
        <Onboarding
          onComplete={(p) => {
            const profile = addProfile(p);
            setActiveProfileId(profile.id);
            void loadPool();
          }}
        />
      </main>
    );
  }

  if (!activeProfile) return null;

  const lastRun = pool.runs[pool.runs.length - 1];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">🎯 Job Watcher</h1>
          <p className="text-xs text-slate-400">
            Cập nhật {timeAgo(pool.updatedAt)}
            {poolError ? ` · ${poolError}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost" onClick={() => void loadPool()} disabled={poolLoading}>
            {poolLoading ? "Đang tải…" : "↻ Tải lại dữ liệu"}
          </button>
        </div>
      </header>

      {/* Profile tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {state.profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProfileId(p.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              p.id === activeProfile.id
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
            }`}
          >
            {p.name}
            {p.id === state.profiles[0].id ? " (mặc định)" : ""}
          </button>
        ))}
        <button
          className="rounded-full border border-dashed border-indigo-300 px-3.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          onClick={() => {
            setEditingProfile(null);
            setShowProfileForm(true);
          }}
        >
          + Thêm hồ sơ
        </button>
        <div className="ml-auto flex gap-1">
          <button
            className="btn-ghost !px-2.5 !py-1 text-xs"
            onClick={() => {
              setEditingProfile(activeProfile);
              setShowProfileForm(true);
            }}
          >
            ✏️ Sửa hồ sơ
          </button>
          {state.profiles.length > 1 && (
            <button
              className="btn-ghost !px-2.5 !py-1 text-xs hover:!border-rose-300 hover:!text-rose-600"
              onClick={() => {
                if (confirm(`Xoá hồ sơ "${activeProfile.name}"? Trạng thái và ghi chú của hồ sơ này sẽ mất.`)) {
                  deleteProfile(activeProfile.id);
                  setActiveProfileId(null);
                }
              }}
            >
              🗑 Xoá
            </button>
          )}
        </div>
      </div>

      {showProfileForm && (
        <div className="card mb-5 p-5">
          <h2 className="mb-4 font-semibold">
            {editingProfile ? `Sửa hồ sơ — ${editingProfile.name}` : "Thêm hồ sơ mới"}
          </h2>
          <ProfileForm
            initial={editingProfile ?? undefined}
            onCancel={() => setShowProfileForm(false)}
            onSave={(data) => {
              if (editingProfile) {
                updateProfile(editingProfile.id, data);
              } else {
                const p = addProfile(data);
                setActiveProfileId(p.id);
              }
              setShowProfileForm(false);
            }}
          />
        </div>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng số job", value: stats.total },
          { label: "Khớp mạnh (≥4 skills)", value: stats.strong },
          { label: "Đã lưu", value: stats.saved },
          { label: "Đã apply", value: stats.applied },
        ].map((t) => (
          <div key={t.label} className="card p-4">
            <div className="text-2xl font-bold">{t.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        {/* Kỹ năng hot */}
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">🔥 Kỹ năng đang hot trên thị trường</h3>
          {hotSkills.length ? (
            <div className="flex flex-wrap gap-1.5">
              {hotSkills.map(([s, n]) => (
                <span key={s} className="chip bg-orange-50 text-orange-700">
                  {s} · {n}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
          )}
        </div>

        {/* Sức khỏe nguồn */}
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">📡 Nguồn dữ liệu</h3>
          {pool.sourceStatus ? (
            <ul className="space-y-1 text-sm">
              {(Object.keys(SOURCE_LABEL) as (keyof typeof SOURCE_LABEL)[]).map((src) => (
                <li key={src} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      pool.sourceStatus?.[src] === "ok" ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  {SOURCE_LABEL[src]}:{" "}
                  {pool.sourceStatus?.[src] === "ok" ? "OK" : "Đang lỗi — dùng dữ liệu cũ"}
                  {lastRun ? (
                    <span className="text-slate-400">({lastRun.perSource[src]} tin/lần quét)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Chưa có lần quét nào.</p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Dữ liệu được hệ thống tự quét khoảng mỗi 30 phút, bạn không cần tự quét.
          </p>
        </div>

        {/* Biểu đồ mini các lần ingest */}
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">📊 Các lần cập nhật gần đây</h3>
          {pool.runs.length ? (
            <div className="flex h-20 items-end gap-1">
              {pool.runs.map((r, i) => {
                const max = Math.max(...pool.runs.map((x) => x.fetched), 1);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-indigo-400/80"
                    style={{ height: `${Math.max(8, (r.fetched / max) * 100)}%` }}
                    title={`${new Date(r.at).toLocaleString("vi-VN")} — quét ${r.fetched} tin, +${r.added} job mới`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
          )}
          {lastRun && (
            <p className="mt-2 text-xs text-slate-400">
              Lần gần nhất: quét {lastRun.fetched} tin, thêm {lastRun.added} job mới, tổng{" "}
              {lastRun.total} job.
            </p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="card sticky top-3 z-30 mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input !w-52"
            placeholder="🔍 Tìm theo title, công ty…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input !w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sắp xếp"
          >
            <option value="recommended">Sắp xếp: Đề xuất</option>
            <option value="percent">Sắp xếp: Khớp cao nhất</option>
            <option value="newest">Sắp xếp: Mới nhất</option>
          </select>
          <select
            className="input !w-auto"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            aria-label="Lọc theo ngày đăng"
          >
            <option value="24h">Ngày đăng: 24 giờ qua</option>
            <option value="7d">Ngày đăng: 7 ngày qua</option>
            <option value="30d">Ngày đăng: 30 ngày qua</option>
            <option value="all">Ngày đăng: Tất cả</option>
          </select>
          <div className="ml-auto flex rounded-xl border border-slate-200 bg-white p-0.5">
            {(
              [
                ["list", "☰ Danh sách"],
                ["kanban", "▦ Kanban"],
              ] as [ViewMode, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  view === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setStatusTab("all")}
            className={`chip shrink-0 border ${
              statusTab === "all"
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            Tất cả ({scoredAll.length})
          </button>
          {PIPELINE.map((p) => {
            const n = scoredAll.filter((s) => statusOf(s.job.id) === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setStatusTab(p.id)}
                className={`chip shrink-0 border ${
                  statusTab === p.id
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {p.label} ({n})
              </button>
            );
          })}
        </div>
      </div>

      {/* Nội dung chính */}
      {pool.jobs.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          {poolLoading
            ? "Đang tải dữ liệu việc…"
            : "Chưa có dữ liệu việc. Hệ thống quét tự động mỗi ~30 phút — hãy quay lại ít phút nữa hoặc bấm Tải lại dữ liệu."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          Không có job nào khớp bộ lọc hiện tại.
        </div>
      ) : view === "list" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(({ scored, status }) => (
            <JobCard
              key={scored.job.id}
              scored={scored}
              status={status}
              onOpen={() => setOpenJobId(scored.job.id)}
              onStatusChange={(s) => setMatch(activeProfile.id, scored.job.id, { status: s })}
            />
          ))}
        </div>
      ) : (
        <KanbanBoard
          items={filtered}
          profile={activeProfile}
          onOpen={(id) => setOpenJobId(id)}
          onStatusChange={(id, s) => setMatch(activeProfile.id, id, { status: s })}
        />
      )}

      <footer className="py-8 text-center text-xs text-slate-400">
        Job Watcher MVP — dữ liệu việc từ LinkedIn, ITviec, TopDev (cập nhật tự động).
        Hồ sơ & trạng thái ứng tuyển chỉ lưu trên trình duyệt của bạn.
        {lastFetchAt ? ` · Đã tải lúc ${new Date(lastFetchAt).toLocaleTimeString("vi-VN")}` : ""}
      </footer>

      {openScored && (
        <JobDrawer
          scored={openScored}
          profile={activeProfile}
          status={statusOf(openScored.job.id)}
          note={profileMatches[openScored.job.id]?.note ?? ""}
          onClose={() => setOpenJobId(null)}
          onStatusChange={(s) => setMatch(activeProfile.id, openScored.job.id, { status: s })}
          onNoteChange={(note) => setMatch(activeProfile.id, openScored.job.id, { note })}
        />
      )}
    </main>
  );
}
