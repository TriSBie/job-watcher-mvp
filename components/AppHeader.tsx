"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Việc làm" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function AppHeader({
  updatedLabel,
  onReload,
  reloading,
}: {
  updatedLabel?: string;
  onReload?: () => void;
  reloading?: boolean;
}) {
  const pathname = usePathname();
  return (
    <header className="relative mb-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-white shadow-[0_0_24px_rgba(94,106,210,0.35)]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="0.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight tracking-[-0.02em]">
              Job Watcher
            </h1>
            {updatedLabel && (
              <p className="text-xs leading-tight text-ink-muted">{updatedLabel}</p>
            )}
          </div>
        </div>

        <nav
          className="flex rounded-lg border border-line bg-surface p-0.5"
          aria-label="Điều hướng chính"
        >
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-surface-raised text-ink shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {onReload && (
          <div className="ml-auto">
            <button className="btn-ghost" onClick={onReload} disabled={reloading}>
              {reloading ? "Đang tải…" : "↻ Tải lại dữ liệu"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
