"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
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

/* ------------------------------------------------------------------ */
/* Motion helpers dùng chung (Đợt 0+1). Tất cả đều tôn trọng token T00 */
/* và suy biến về tức thì khi prefers-reduced-motion.                  */
/* ------------------------------------------------------------------ */

/** true sau lần mount đầu — dùng để animate bar/ring từ 0 lên giá trị thật. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/** true (một lần, không tắt lại) khi element lần đầu lọt vào viewport. */
export function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

/**
 * Giữ trạng thái tải hiển thị tối thiểu minMs để khỏi chớp (T01).
 * Mỗi lần loading bắt đầu lại thì tính lại từ đầu.
 */
export function useMinVisible(active: boolean, minMs = 500) {
  const [visible, setVisible] = useState(active);
  const startRef = useRef<number | null>(null);
  const prevRef = useRef(active);
  useEffect(() => {
    if (active) {
      if (!prevRef.current) startRef.current = Date.now();
      prevRef.current = true;
      setVisible(true);
      return;
    }
    prevRef.current = false;
    if (startRef.current === null) {
      setVisible(false);
      return;
    }
    const elapsed = Date.now() - startRef.current;
    if (elapsed >= minMs) {
      startRef.current = null;
      setVisible(false);
      return;
    }
    const t = setTimeout(
      () => {
        startRef.current = null;
        setVisible(false);
      },
      minMs - elapsed
    );
    return () => clearTimeout(t);
  }, [active, minMs]);
  return visible;
}

/**
 * Flash xác nhận khi trạng thái job thay đổi (T03): true trong ~650ms ngay
 * sau khi status đổi (bỏ qua lần render đầu). Dưới reduced-motion, class
 * motion-reduce:animate-none ở nơi dùng sẽ tắt animation, chỉ còn chữ chip
 * đổi tức thì — vẫn là xác nhận nhìn thấy được.
 */
export function useStatusFlash(status: string) {
  const [flash, setFlash] = useState(false);
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 650);
    return () => clearTimeout(t);
  }, [status]);
  return flash;
}

/**
 * Count-up (T04): chạy đúng 1 lần mỗi lần target thay đổi (kể cả lần mount
 * đầu, từ 0 lên target), 700ms ease-out. Dưới reduced-motion trả về target
 * ngay. Số cuối luôn nằm trong DOM sau khi animation kết thúc.
 */
export function useCountUp(target: number, duration = 700) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(0);
  const firstRef = useRef(true);
  useEffect(() => {
    if (reduce) {
      setDisplay(target);
      prevRef.current = target;
      firstRef.current = false;
      return;
    }
    const from = firstRef.current ? 0 : prevRef.current;
    firstRef.current = false;
    if (from === target) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return display;
}

/** Số KPI headline dạng count-up, giữ tabular-nums để số không nhảy chiều rộng. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const display = useCountUp(value);
  return <span className={`tabular-nums ${className}`}>{display}</span>;
}

/** Một khối skeleton shimmer (T01). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

/** Skeleton khớp bố cục thật của một thẻ job ở trang Việc làm (T01). */
export function JobCardSkeleton() {
  return (
    <div className="card flex gap-3 p-4" aria-hidden="true">
      <Skeleton className="h-11 w-11 shrink-0 !rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-16 !rounded-full" />
          <Skeleton className="h-5 w-16 !rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function MatchRing({ percent, small }: { percent: number; small?: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = percent >= 60 ? "#34d399" : percent >= 35 ? "#fbbf24" : "#62666b";
  const box = small ? "h-8 w-8" : "h-11 w-11";
  // T04: vòng chạy từ 0 lên giá trị thật khi lần đầu vào viewport. Dùng
  // transition trên stroke-dasharray — class transition mặc định của Tailwind
  // KHÔNG bao phủ thuộc tính này nên phải khai báo tường minh.
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`relative ${box} shrink-0`}
      title={`Đáp ứng ${percent}% yêu cầu của job`}
    >
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
          strokeDasharray={inView ? `${(percent / 100) * c} ${c}` : `0 ${c}`}
          className="transition-[stroke-dasharray] duration-data ease-motion motion-reduce:transition-none"
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
  // T03: flash xác nhận khi trạng thái đổi (kể cả đường mobile select).
  const flash = useStatusFlash(status);
  return (
    <div
      className={`card group flex gap-3 p-4 transition duration-fast ease-motion hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-surface-raised hover:shadow-[0_10px_28px_rgba(0,0,0,0.5)] ${
        flash ? "animate-status-flash motion-reduce:animate-none" : ""
      }`}
    >
      <MatchRing percent={percent} />
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block w-full text-left">
          <h3 className="truncate font-medium leading-snug tracking-[-0.01em] text-ink transition duration-fast ease-motion group-hover:text-accent-hover">
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
