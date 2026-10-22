"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import JobDrawer from "@/components/JobDrawer";
import { MatchRing, SOURCE_LABEL, formatPosted } from "@/components/JobCard";
import {
  countJobSkills,
  jobDateMs,
  jobSkillSet,
  scoreJob,
  useAppState,
  type PipelineStatus,
  type PoolData,
  type PoolJob,
  type ScoredJob,
  type SourceId,
} from "@/lib/store";
import { primaryRegion } from "@/lib/location";

const POOL_CACHE_KEY = "jwmvp:pool";
const EMPTY_POOL: PoolData = { jobs: [], updatedAt: null, sourceStatus: null, runs: [] };
const DAY = 864e5;

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

function postedLabel(job: PoolJob): string {
  const ms = jobDateMs(job);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - ms) / DAY);
  if (days <= 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days <= 30) return `${days} ngày trước`;
  return formatPosted(job.postedAt);
}

function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="panel-title">{title}</h2>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function Donut({ segments, size = 132 }: { segments: DonutSegment[]; size?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const frac = s.value / total;
              const dash = `${Math.max(0, frac * c - 1.5)} ${c}`;
              const offset = -acc * c;
              acc += frac;
              return (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="11"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              );
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-ink">
          {total}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-ink-muted">job</span>
      </div>
    </div>
  );
}

function Legend({ segments }: { segments: DonutSegment[] }) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {segments.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: s.color }} />
          <span className="truncate text-ink-secondary">{s.label}</span>
          <span className="ml-auto tabular-nums text-ink">
            {s.value}
            <span className="ml-1 text-xs text-ink-muted">
              ({Math.round((s.value / total) * 100)}%)
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { state, hydrated, setMatch } = useAppState();
  const [pool, setPool] = useState<PoolData>(EMPTY_POOL);
  const [poolLoading, setPoolLoading] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const autoFetched = useRef(false);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const data = (await res.json()) as PoolData & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPool(data);
      try {
        window.localStorage.setItem(POOL_CACHE_KEY, JSON.stringify(data));
      } catch {}
    } catch (e) {
      console.error(e);
    } finally {
      setPoolLoading(false);
    }
  }, []);

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
    if (Date.now() - cachedAt > 15 * 60000) void loadPool();
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
    return pool.jobs.map((j) => scoreJob(j, activeProfile));
  }, [pool.jobs, activeProfile]);

  const now = Date.now();

  const kpis = useMemo(() => {
    const total = pool.jobs.length;
    let new24h = 0;
    let new7d = 0;
    const companies = new Set<string>();
    for (const j of pool.jobs) {
      if (j.company) companies.add(j.company);
      const ms = jobDateMs(j);
      if (ms >= now - DAY) new24h++;
      if (ms >= now - 7 * DAY) new7d++;
    }
    const strong = scoredAll.filter((s) => s.level === "strong").length;
    return { total, new24h, new7d, strong, companies: companies.size };
  }, [pool.jobs, scoredAll, now]);

  const skillStats = useMemo(() => {
    const counts = countJobSkills(pool.jobs);
    const dated14 = pool.jobs.filter((j) => jobDateMs(j) >= now - 14 * DAY);
    const hasDelta = dated14.length >= 5;
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([skill, count]) => {
        let delta: number | null = null;
        if (hasDelta) {
          let recent = 0;
          let prev = 0;
          for (const j of pool.jobs) {
            if (!jobSkillSet(j).includes(skill)) continue;
            const ms = jobDateMs(j);
            if (ms >= now - 7 * DAY) recent++;
            else if (ms >= now - 14 * DAY) prev++;
          }
          delta = recent - prev;
        }
        return { skill, count, delta };
      });
    return { top, hasDelta, max: Math.max(1, ...top.map((t) => t.count)) };
  }, [pool.jobs, now]);

  const rhythm = useMemo(() => {
    const days: { key: string; label: string; count: number; isToday: boolean }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(start.getTime() - i * DAY);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      days.push({
        key,
        label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        count: 0,
        isToday: i === 0,
      });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const j of pool.jobs) {
      const d = new Date(jobDateMs(j));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      const i = idx.get(key);
      if (i !== undefined) days[i].count++;
    }
    return { days, max: Math.max(1, ...days.map((d) => d.count)) };
  }, [pool.jobs]);

  const hotJobs = useMemo(() => {
    const counts = countJobSkills(pool.jobs);
    const demandOf = (j: PoolJob) =>
      jobSkillSet(j).reduce((a, s) => a + (counts.get(s) ?? 0), 0);
    const maxDemand = Math.max(1, ...pool.jobs.map(demandOf));
    const scoredById = new Map(scoredAll.map((s) => [s.job.id, s]));
    return pool.jobs
      .map((job) => {
        const ms = jobDateMs(job);
        const freshness = Math.min(1, Math.max(0, 1 - (now - ms) / (30 * DAY)));
        const scored = scoredById.get(job.id);
        // Trọng số: mức khớp hồ sơ 50 — độ mới 35 — nhu cầu kỹ năng 15.
        const matchPart = activeProfile && scored ? scored.percent * 0.5 : 25;
        const hot = Math.round(
          freshness * 35 + matchPart + (demandOf(job) / maxDemand) * 15
        );
        return { job, scored, hot };
      })
      .sort((a, b) => b.hot - a.hot || (b.scored?.percent ?? 0) - (a.scored?.percent ?? 0))
      .slice(0, 8);
  }, [pool.jobs, scoredAll, activeProfile, now]);

  const topCompanies = useMemo(() => {
    const map = new Map<string, { count: number; sources: Map<SourceId, number> }>();
    for (const j of pool.jobs) {
      const name = j.company || "Không rõ công ty";
      const entry = map.get(name) ?? { count: 0, sources: new Map() };
      entry.count++;
      entry.sources.set(j.source, (entry.sources.get(j.source) ?? 0) + 1);
      map.set(name, entry);
    }
    return [...map.entries()]
      .map(([name, e]) => {
        const mainSource = [...e.sources.entries()].sort((a, b) => b[1] - a[1])[0][0];
        return { name, count: e.count, mainSource };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [pool.jobs]);

  const sourceSegments: DonutSegment[] = useMemo(() => {
    const colors: Record<SourceId, string> = {
      linkedin: "#38bdf8",
      itviec: "#fb7185",
      topdev: "#a78bfa",
    };
    return (Object.keys(SOURCE_LABEL) as SourceId[]).map((src) => ({
      label: SOURCE_LABEL[src],
      value: pool.jobs.filter((j) => j.source === src).length,
      color: colors[src],
    }));
  }, [pool.jobs]);

  const locationSegments: DonutSegment[] = useMemo(() => {
    const defs = [
      { label: "Hồ Chí Minh", color: "#5e6ad2" },
      { label: "Hà Nội", color: "#38bdf8" },
      { label: "Đà Nẵng", color: "#f59e0b" },
      { label: "Remote", color: "#34d399" },
      { label: "Khác", color: "#62666b" },
    ] as const;
    return defs.map((d) => ({
      ...d,
      value: pool.jobs.filter((j) => primaryRegion(j.location) === d.label).length,
    }));
  }, [pool.jobs]);

  const matchDist = useMemo(() => {
    const strong = scoredAll.filter((s) => s.level === "strong").length;
    const partial = scoredAll.filter((s) => s.level === "partial").length;
    const weak = scoredAll.filter((s) => s.level === "weak").length;
    return { strong, partial, weak, total: Math.max(1, scoredAll.length) };
  }, [scoredAll]);

  const openScored = openJobId
    ? scoredAll.find((s) => s.job.id === openJobId) ?? null
    : null;
  const statusOf = (jobId: string): PipelineStatus =>
    profileMatches[jobId]?.status ?? "new";

  if (!hydrated) {
    return (
      <main className="relative flex min-h-screen items-center justify-center text-ink-muted">
        <div className="page-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <span className="relative">Đang tải…</span>
      </main>
    );
  }

  const kpiCards = [
    { label: "Tổng số job", value: String(kpis.total) },
    { label: "Job mới 24h", value: String(kpis.new24h) },
    { label: "Job mới 7 ngày", value: String(kpis.new7d) },
    {
      label: "Khớp mạnh" + (activeProfile ? ` · ${activeProfile.name}` : ""),
      value: activeProfile ? String(kpis.strong) : "—",
    },
    { label: "Công ty đang tuyển", value: String(kpis.companies) },
  ];

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-4 py-6">
      <div className="page-glow pointer-events-none absolute inset-x-0 top-0 -mx-4 h-[420px]" />

      <div className="relative">
        <AppHeader
          updatedLabel={`Phân tích thị trường · Cập nhật ${timeAgo(pool.updatedAt)}`}
          onReload={() => void loadPool()}
          reloading={poolLoading}
        />

        {/* Chọn hồ sơ để chấm match */}
        {state.profiles.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="panel-title mr-1">Hồ sơ</span>
            {state.profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProfileId(p.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  activeProfile && p.id === activeProfile.id
                    ? "bg-accent text-white"
                    : "border border-line bg-surface text-ink-secondary hover:border-white/[0.16] hover:text-ink"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {pool.jobs.length === 0 ? (
          <div className="card p-8 text-center text-ink-muted">
            {poolLoading
              ? "Đang tải dữ liệu việc…"
              : "Chưa có dữ liệu việc để phân tích. Hệ thống quét tự động mỗi ~30 phút — hãy quay lại ít phút nữa hoặc bấm Tải lại dữ liệu."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Hàng KPI */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-12 lg:grid-cols-5">
              {kpiCards.map((k) => (
                <div key={k.label} className="card p-4">
                  <div className="text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-ink">
                    {k.value}
                  </div>
                  <div className="panel-title mt-2">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Độ hot kỹ năng */}
            <Panel
              title="Độ hot kỹ năng"
              hint={skillStats.hasDelta ? "Δ = 7 ngày gần nhất so với 7 ngày trước" : "Top 12 theo số job yêu cầu"}
              className="lg:col-span-7"
            >
              {skillStats.top.length === 0 ? (
                <p className="text-sm text-ink-muted">Chưa có dữ liệu kỹ năng.</p>
              ) : (
                <ul className="space-y-2.5">
                  {skillStats.top.map(({ skill, count, delta }) => (
                    <li key={skill} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-sm text-ink" title={skill}>
                        {skill}
                      </span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(count / skillStats.max) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-secondary">
                        {count} job · {Math.round((count / pool.jobs.length) * 100)}%
                      </span>
                      {skillStats.hasDelta && (
                        <span
                          className={`w-12 shrink-0 text-right text-xs font-medium tabular-nums ${
                            delta === null || delta === 0
                              ? "text-ink-muted"
                              : delta > 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                          }`}
                          title="Chênh lệch số job 7 ngày gần nhất so với 7 ngày trước đó"
                        >
                          {delta === null ? "" : delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "— 0"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Nhịp đăng tuyển */}
            <Panel title="Nhịp đăng tuyển" hint="Số job theo ngày đăng · 14 ngày" className="lg:col-span-5">
              <div className="flex h-36 items-end gap-1">
                {rhythm.days.map((d) => (
                  <div
                    key={d.key}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={`${d.label}: ${d.count} job`}
                  >
                    <span className="text-[10px] tabular-nums text-ink-secondary">
                      {d.count > 0 ? d.count : ""}
                    </span>
                    <div
                      className={`w-full rounded-t transition ${
                        d.isToday ? "bg-accent" : "bg-accent/45 hover:bg-accent/70"
                      }`}
                      style={{ height: `${Math.max(4, (d.count / rhythm.max) * 78)}%` }}
                    />
                    <span className="text-[9px] tabular-nums text-ink-muted">
                      {d.label.slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Cột sáng nhất là hôm nay. Job thiếu ngày đăng được tính theo ngày hệ
                thống ghi nhận lần đầu.
              </p>
            </Panel>

            {/* Job đang hot */}
            <Panel
              title="Job đang hot"
              hint="Điểm hot = độ mới × mức khớp hồ sơ × nhu cầu kỹ năng"
              className="lg:col-span-7"
            >
              <ul className="divide-y divide-line">
                {hotJobs.map(({ job, scored, hot }, i) => (
                  <li key={job.id}>
                    <button
                      className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-white/[0.02]"
                      onClick={() => {
                        if (activeProfile) setOpenJobId(job.id);
                        else
                          window.location.href = `/?job=${encodeURIComponent(job.url)}`;
                      }}
                    >
                      <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-muted">
                        {i + 1}
                      </span>
                      {activeProfile && scored ? (
                        <MatchRing percent={scored.percent} small />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {job.title}
                        </span>
                        <span className="block truncate text-xs text-ink-secondary">
                          {job.company || "—"} · {job.location}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs tabular-nums text-ink-secondary">
                          {postedLabel(job)}
                        </span>
                        <span className="block text-[11px] tabular-nums text-accent-hover">
                          Hot {hot}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Công ty tuyển nhiều nhất */}
            <Panel title="Công ty đang tuyển nhiều nhất" hint="Top 8 theo số job trong pool" className="lg:col-span-5">
              {topCompanies.length === 0 ? (
                <p className="text-sm text-ink-muted">Chưa có dữ liệu.</p>
              ) : (
                <ul className="space-y-3">
                  {topCompanies.map((c) => (
                    <li key={c.name}>
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-ink" title={c.name}>
                          {c.name}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          nguồn chính: {SOURCE_LABEL[c.mainSource]}
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                          {c.count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-accent/80"
                          style={{
                            width: `${(c.count / Math.max(1, topCompanies[0].count)) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Phân bố nguồn & địa điểm */}
            <Panel title="Phân bố" hint="Theo nguồn tin và địa điểm" className="lg:col-span-7">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-medium text-ink-secondary">Theo nguồn</p>
                  <div className="flex items-center gap-4">
                    <Donut segments={sourceSegments} />
                    <Legend segments={sourceSegments} />
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium text-ink-secondary">Theo địa điểm</p>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    {locationSegments
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <div
                          key={s.label}
                          style={{
                            background: s.color,
                            width: `${(s.value / Math.max(1, pool.jobs.length)) * 100}%`,
                          }}
                          title={`${s.label}: ${s.value}`}
                        />
                      ))}
                  </div>
                  <div className="mt-3">
                    <Legend segments={locationSegments} />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Phân bố độ khớp */}
            <Panel
              title="Phân bố độ khớp"
              hint={activeProfile ? `Theo hồ sơ ${activeProfile.name}` : undefined}
              className="lg:col-span-5"
            >
              {!activeProfile ? (
                <div className="text-sm leading-relaxed text-ink-secondary">
                  <p>
                    Bạn chưa có hồ sơ nên chưa chấm được mức khớp. Tạo hồ sơ (miễn phí,
                    chỉ lưu trên trình duyệt) để xem job nào khớp mạnh với kỹ năng của bạn.
                  </p>
                  <Link href="/" className="btn-primary mt-4">
                    Tạo hồ sơ →
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="bg-emerald-400"
                      style={{ width: `${(matchDist.strong / matchDist.total) * 100}%` }}
                      title={`Khớp mạnh: ${matchDist.strong}`}
                    />
                    <div
                      className="bg-amber-400"
                      style={{ width: `${(matchDist.partial / matchDist.total) * 100}%` }}
                      title={`Khớp một phần: ${matchDist.partial}`}
                    />
                    <div
                      className="bg-[#62666b]"
                      style={{ width: `${(matchDist.weak / matchDist.total) * 100}%` }}
                      title={`Khớp yếu: ${matchDist.weak}`}
                    />
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      { label: "Khớp mạnh (≥60% yêu cầu)", value: matchDist.strong, color: "#34d399" },
                      { label: "Khớp một phần (35–59%)", value: matchDist.partial, color: "#fbbf24" },
                      { label: "Khớp yếu (<35%)", value: matchDist.weak, color: "#62666b" },
                    ].map((r) => (
                      <li key={r.label} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[4px]"
                          style={{ background: r.color }}
                        />
                        <span className="text-ink-secondary">{r.label}</span>
                        <span className="ml-auto tabular-nums text-ink">
                          {r.value}
                          <span className="ml-1 text-xs text-ink-muted">
                            ({Math.round((r.value / matchDist.total) * 100)}%)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>
        )}

        <footer className="py-8 text-center text-xs text-ink-muted">
          Job Watcher MVP — số liệu tính trực tiếp từ pool việc hiện tại (
          <span className="tabular-nums">{pool.jobs.length}</span> job) và hồ sơ đang
          chọn trên trình duyệt của bạn.
        </footer>
      </div>

      {openScored && activeProfile && (
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
