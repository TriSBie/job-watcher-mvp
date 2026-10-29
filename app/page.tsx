"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import Onboarding from "@/components/Onboarding";
import ProfileForm from "@/components/ProfileForm";
import AppHeader from "@/components/AppHeader";
import JobCard, {
  JobCardSkeleton,
  SOURCE_LABEL,
  Skeleton,
  useMinVisible,
} from "@/components/JobCard";
import KanbanBoard, { KanbanSkeleton } from "@/components/KanbanBoard";
import JobDrawer from "@/components/JobDrawer";
import {
  PIPELINE,
  countJobSkills,
  jobDateMs,
  scoreJob,
  useAppState,
  type PipelineStatus,
  type PoolData,
  type Profile,
  type ScoredJob,
} from "@/lib/store";
import {
  jobMatchesRegion,
  profileRegion,
  type Region,
} from "@/lib/location";

type SortMode = "recommended" | "percent" | "newest";
type DateFilter = "24h" | "7d" | "30d" | "all";
type ViewMode = "list" | "kanban";
type LocFilter = "profile" | "all" | Region;

const REGION_OPTIONS: Region[] = ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Remote", "Khác"];

const POOL_CACHE_KEY = "jwmvp:pool";
const PENDING_JOB_KEY = "jwmvp:pendingJob";
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
  // T01: bắt đầu ở trạng thái tải để lần render đầu sau hydrate không lóe
  // text "Chưa có dữ liệu" trước khi cache/fetch kịp chạy; effect dưới sẽ
  // tắt nó ngay khi cache còn tươi.
  const [poolLoading, setPoolLoading] = useState(true);
  // T01: trạng thái tải pool giữ tối thiểu 500ms để khỏi chớp.
  const poolLoadingVisible = useMinVisible(poolLoading);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number>(0);

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<PipelineStatus | "all">("all");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [locFilter, setLocFilter] = useState<LocFilter>("profile");
  const [view, setView] = useState<ViewMode>("list");
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const autoFetched = useRef(false);
  const pendingJobUrl = useRef<string | null>(null);

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
    } else {
      // Cache còn tươi, không fetch → tắt trạng thái tải ban đầu.
      setPoolLoading(false);
    }
  }, [loadPool]);

  // Deep-link từ Dashboard: /?job=<url> → tự mở drawer của job đó.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("job");
      if (fromUrl) {
        pendingJobUrl.current = fromUrl;
        window.sessionStorage.setItem(PENDING_JOB_KEY, fromUrl);
      } else {
        pendingJobUrl.current = window.sessionStorage.getItem(PENDING_JOB_KEY);
      }
    } catch {}
  }, []);

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
    return pool.jobs.map((j) => scoreJob(j, activeProfile));
  }, [pool.jobs, activeProfile]);

  // Khi pool + hồ sơ đã sẵn sàng, mở drawer cho job được deep-link (nếu có).
  useEffect(() => {
    const target = pendingJobUrl.current;
    if (!target || scoredAll.length === 0) return;
    const found = scoredAll.find((s) => s.job.url === target);
    if (found) {
      setOpenJobId(found.job.id);
      pendingJobUrl.current = null;
      try {
        window.sessionStorage.removeItem(PENDING_JOB_KEY);
        const url = new URL(window.location.href);
        url.searchParams.delete("job");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    } else if (pool.jobs.length > 0) {
      // Job không còn trong pool → bỏ pending để không kẹt các lần sau.
      pendingJobUrl.current = null;
      try {
        window.sessionStorage.removeItem(PENDING_JOB_KEY);
      } catch {}
    }
  }, [scoredAll, pool.jobs.length]);

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
    if (locFilter !== "all") {
      const region =
        locFilter === "profile"
          ? activeProfile
            ? profileRegion(activeProfile.location)
            : null
          : locFilter;
      if (region) {
        items = items.filter((i) => jobMatchesRegion(i.scored.job.location, region));
      }
    }
    if (dateFilter !== "all") {
      const limitMs = dateFilter === "24h" ? 864e5 : dateFilter === "7d" ? 7 * 864e5 : 30 * 864e5;
      const cutoff = Date.now() - limitMs;
      items = items.filter((i) => jobDateMs(i.scored.job) >= cutoff);
    }
    const byPosted = (a: ScoredJob, b: ScoredJob) => jobDateMs(b.job) - jobDateMs(a.job);
    items.sort((a, b) => {
      if (sort === "percent") return b.scored.percent - a.scored.percent || byPosted(a.scored, b.scored);
      if (sort === "newest") return byPosted(a.scored, b.scored);
      // Đề xuất: khớp mạnh trước, sau đó % và độ mới
      const rank = (s: ScoredJob) => (s.level === "strong" ? 0 : s.level === "partial" ? 1 : 2);
      return rank(a.scored) - rank(b.scored) || b.scored.percent - a.scored.percent || byPosted(a.scored, b.scored);
    });
    return items;
  }, [scoredAll, statusOf, statusTab, query, dateFilter, sort, locFilter, activeProfile]);

  const stats = useMemo(() => {
    const total = scoredAll.length;
    const strong = scoredAll.filter((s) => s.level === "strong").length;
    const saved = Object.values(profileMatches).filter((m) => m.status === "saved").length;
    const applied = Object.values(profileMatches).filter((m) => m.status === "applied").length;
    return { total, strong, saved, applied };
  }, [scoredAll, profileMatches]);

  const hotSkills = useMemo(() => {
    return [...countJobSkills(pool.jobs).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [pool.jobs]);

  const openScored = openJobId
    ? scoredAll.find((s) => s.job.id === openJobId) ?? null
    : null;

  if (!hydrated) {
    // T01: skeleton thay chữ "Đang tải…" — khung header + lưới thẻ khớp bố cục thật.
    return (
      <main className="relative mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
        <div className="page-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <div className="relative" aria-busy="true" aria-label="Đang tải">
          <span className="sr-only">Đang tải…</span>
          <div className="mb-5 flex items-center gap-3" aria-hidden="true">
            <Skeleton className="h-9 w-9 !rounded-[10px]" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (state.profiles.length === 0) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <div className="page-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <div className="relative">
          <Onboarding
            onComplete={(p) => {
              const profile = addProfile(p);
              setActiveProfileId(profile.id);
              void loadPool();
            }}
          />
        </div>
      </main>
    );
  }

  if (!activeProfile) return null;

  const lastRun = pool.runs[pool.runs.length - 1];

  return (
    // T00: MotionConfig reducedMotion="user" biến mọi animation Motion
    // (drawer, kanban FLIP) thành fade/tức thì khi prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
      <div className="page-glow pointer-events-none absolute inset-x-0 top-0 -mx-4 h-[420px]" />

      <div className="relative">
        <AppHeader
          updatedLabel={`Cập nhật ${timeAgo(pool.updatedAt)}${poolError ? ` · ${poolError}` : ""}`}
          onReload={() => void loadPool()}
          reloading={poolLoading}
        />

        {/* Profile tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {state.profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                p.id === activeProfile.id
                  ? "bg-accent text-white"
                  : "border border-line bg-surface text-ink-secondary hover:border-white/[0.16] hover:text-ink"
              }`}
            >
              {p.name}
              {p.id === state.profiles[0].id ? " (mặc định)" : ""}
            </button>
          ))}
          <button
            className="rounded-full border border-dashed border-accent/40 px-3.5 py-1.5 text-sm font-medium text-accent-hover transition hover:bg-accent/10"
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
                className="btn-ghost !px-2.5 !py-1 text-xs hover:!border-rose-400/40 hover:!text-rose-300"
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
            <h2 className="mb-4 font-medium tracking-[-0.01em] text-ink">
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
              onDelete={
                editingProfile
                  ? () => {
                      const wasActive = editingProfile.id === activeProfile.id;
                      deleteProfile(editingProfile.id);
                      setEditingProfile(null);
                      setShowProfileForm(false);
                      // Xoá hồ sơ đang xem → rơi về hồ sơ còn lại đầu tiên;
                      // xoá hồ sơ cuối cùng → state rỗng → tự về onboarding.
                      if (wasActive) setActiveProfileId(null);
                    }
                  : undefined
              }
              onClearCv={
                editingProfile
                  ? () => {
                      updateProfile(editingProfile.id, { skills: [], keywords: [] });
                      setEditingProfile(null);
                      setShowProfileForm(false);
                    }
                  : undefined
              }
            />
          </div>
        )}

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Tổng số job", value: stats.total },
            { label: "Khớp mạnh", value: stats.strong },
            { label: "Đã lưu", value: stats.saved },
            { label: "Đã apply", value: stats.applied },
          ].map((t) => (
            <div key={t.label} className="card p-4">
              <div className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink">
                {t.value}
              </div>
              <div className="panel-title mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-3">
          {/* Kỹ năng hot */}
          <div className="card p-4">
            <h3 className="panel-title mb-3">Kỹ năng đang hot trên thị trường</h3>
            {hotSkills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {hotSkills.map(([s, n]) => (
                  <span key={s} className="chip border border-line bg-white/[0.04] text-ink-secondary">
                    {s} · <span className="tabular-nums text-accent-hover">{n}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Chưa có dữ liệu.</p>
            )}
          </div>

          {/* Sức khỏe nguồn */}
          <div className="card p-4">
            <h3 className="panel-title mb-3">Nguồn dữ liệu</h3>
            {pool.sourceStatus ? (
              <ul className="space-y-1.5 text-sm text-ink-secondary">
                {(Object.keys(SOURCE_LABEL) as (keyof typeof SOURCE_LABEL)[]).map((src) => (
                  <li key={src} className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        pool.sourceStatus?.[src] === "ok" ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    {SOURCE_LABEL[src]}:{" "}
                    {pool.sourceStatus?.[src] === "ok" ? "OK" : "Đang lỗi — dùng dữ liệu cũ"}
                    {lastRun ? (
                      <span className="tabular-nums text-ink-muted">({lastRun.perSource[src]} tin/lần quét)</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Chưa có lần quét nào.</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              Dữ liệu được hệ thống tự quét khoảng mỗi 30 phút, bạn không cần tự quét.
            </p>
          </div>

          {/* Biểu đồ mini các lần ingest */}
          <div className="card p-4">
            <h3 className="panel-title mb-3">Các lần cập nhật gần đây</h3>
            {pool.runs.length ? (
              <div className="flex h-20 items-end gap-1">
                {pool.runs.map((r, i) => {
                  const max = Math.max(...pool.runs.map((x) => x.fetched), 1);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
                      style={{ height: `${Math.max(8, (r.fetched / max) * 100)}%` }}
                      title={`${new Date(r.at).toLocaleString("vi-VN")} — quét ${r.fetched} tin, +${r.added} job mới`}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Chưa có dữ liệu.</p>
            )}
            {lastRun && (
              <p className="mt-2 text-xs tabular-nums text-ink-muted">
                Lần gần nhất: quét {lastRun.fetched} tin, thêm {lastRun.added} job mới, tổng{" "}
                {lastRun.total} job.
              </p>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="card sticky top-3 z-30 mb-4 !bg-surface/90 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input !w-52"
              placeholder="Tìm theo title, công ty…"
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
            <select
              className="input !w-auto"
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value as LocFilter)}
              aria-label="Lọc theo khu vực"
            >
              <option value="profile">
                Khu vực: Theo hồ sơ
                {activeProfile && profileRegion(activeProfile.location)
                  ? ` (${profileRegion(activeProfile.location)})`
                  : ""}
              </option>
              <option value="all">Khu vực: Tất cả</option>
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  Khu vực: {r}
                </option>
              ))}
            </select>
            <div className="ml-auto flex rounded-lg border border-line bg-surface p-0.5">
              {(
                [
                  ["list", "Danh sách"],
                  ["kanban", "Kanban"],
                ] as [ViewMode, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === v
                      ? "bg-surface-raised text-ink shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                      : "text-ink-secondary hover:text-ink"
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
              className={`chip shrink-0 border tabular-nums ${
                statusTab === "all"
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink-secondary hover:text-ink"
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
                  className={`chip shrink-0 border tabular-nums ${
                    statusTab === p.id
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink-secondary hover:text-ink"
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
          poolLoadingVisible ? (
            // T01: skeleton khớp view đang chọn, giữ tối thiểu 500ms.
            view === "kanban" ? (
              <div aria-busy="true" aria-label="Đang tải dữ liệu việc">
                <span className="sr-only">Đang tải dữ liệu việc…</span>
                <KanbanSkeleton />
              </div>
            ) : (
              <div
                className="grid gap-3 md:grid-cols-2"
                aria-busy="true"
                aria-label="Đang tải dữ liệu việc"
              >
                <span className="sr-only">Đang tải dữ liệu việc…</span>
                {Array.from({ length: 6 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            )
          ) : (
            <div className="card p-8 text-center text-ink-muted">
              Chưa có dữ liệu việc. Hệ thống quét tự động mỗi ~30 phút — hãy quay lại ít phút nữa hoặc bấm Tải lại dữ liệu.
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-ink-muted">
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

        <footer className="py-8 text-center text-xs text-ink-muted">
          Job Watcher MVP — dữ liệu việc từ LinkedIn, ITviec, TopDev (cập nhật tự động).
          Hồ sơ & trạng thái ứng tuyển chỉ lưu trên trình duyệt của bạn.
          {lastFetchAt ? ` · Đã tải lúc ${new Date(lastFetchAt).toLocaleTimeString("vi-VN")}` : ""}
        </footer>
      </div>

      {/* T02: AnimatePresence giữ drawer sống trong lúc animation thoát chạy,
          nên cả 3 cách đóng (nút, click overlay, Escape) đều trượt ra. */}
      <AnimatePresence>
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
      </AnimatePresence>
    </main>
    </MotionConfig>
  );
}
