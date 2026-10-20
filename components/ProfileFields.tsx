"use client";

import { SKILL_CATALOG } from "@/lib/skills";

export const LOCATIONS = [
  "Ho Chi Minh City, Vietnam",
  "Ha Noi, Vietnam",
  "Da Nang, Vietnam",
  "Vietnam",
  "Remote",
];

export function SkillPicker({
  selected,
  onChange,
  suggested,
}: {
  selected: string[];
  onChange: (skills: string[]) => void;
  suggested?: Set<string>;
}) {
  const toggle = (s: string) =>
    onChange(
      selected.includes(s)
        ? selected.filter((x) => x !== s)
        : [...selected, s]
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {SKILL_CATALOG.map((s) => {
        const active = selected.includes(s);
        const isSuggested = suggested?.has(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`chip border transition ${
              active
                ? "border-indigo-600 bg-indigo-600 text-white"
                : isSuggested
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
            }`}
          >
            {s}
            {isSuggested && !active ? " ✦" : ""}
          </button>
        );
      })}
    </div>
  );
}

export function KeywordInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (kw: string[]) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((k) => (
          <span
            key={k}
            className="chip border border-indigo-200 bg-indigo-50 text-indigo-700"
          >
            {k}
            <button
              type="button"
              aria-label={`Xoá từ khoá ${k}`}
              className="ml-1 text-indigo-400 hover:text-indigo-700"
              onClick={() => onChange(keywords.filter((x) => x !== k))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="input mt-2"
        placeholder="Nhập từ khoá rồi Enter — vd: backend developer"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = (e.target as HTMLInputElement).value.trim();
            if (v && !keywords.includes(v)) onChange([...keywords, v]);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
      <p className="mt-1 text-xs text-slate-400">
        Từ khoá dùng để gợi ý mức độ liên quan; job pool được hệ thống quét sẵn từ
        LinkedIn, ITviec, TopDev.
      </p>
    </div>
  );
}
