"use client";

import { useRef, useState } from "react";
import { extractSkills, SKILL_CATALOG } from "@/lib/skills";
import { KeywordInput, LOCATIONS, SkillPicker } from "./ProfileFields";
import type { Profile } from "@/lib/store";

const KEYWORD_SUGGESTIONS = [
  "backend developer",
  "fullstack developer",
  "java developer",
  "node.js developer",
  "software engineer",
  "frontend developer",
];

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

export default function Onboarding({
  onComplete,
}: {
  onComplete: (p: Omit<Profile, "id" | "createdAt">) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [skills, setSkills] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [cvName, setCvName] = useState<string | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCv = async (file: File) => {
    setCvBusy(true);
    setCvError(null);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) throw new Error("empty");
      const found = extractSkills(text);
      setSuggested(new Set(found));
      setSkills((prev) => [...new Set([...prev, ...found])]);
      const kw = KEYWORD_SUGGESTIONS.filter((k) =>
        text.toLowerCase().includes(k.split(" ")[0])
      );
      if (kw.length) setKeywords((prev) => [...new Set([...prev, ...kw.slice(0, 3)])]);
      setCvName(file.name);
    } catch {
      setCvError(
        "Không đọc được text từ PDF này (có thể là CV dạng ảnh). Bạn cứ nhập kỹ năng tay bên dưới nhé."
      );
    } finally {
      setCvBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 text-4xl">🎯</div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Job Watcher — săn việc theo CV của bạn
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Hệ thống quét sẵn việc từ LinkedIn, ITviec và TopDev. Bạn chỉ cần tạo hồ
          sơ kỹ năng — Job Watcher sẽ chấm điểm từng job có khớp với CV của bạn
          hay không.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium">
        {["Hồ sơ", "Kỹ năng & CV", "Hoàn tất"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                step >= i + 1
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <span className={step >= i + 1 ? "text-indigo-700" : "text-slate-400"}>
              {label}
            </span>
            {i < 2 && <span className="mx-1 h-px w-8 bg-slate-300" />}
          </div>
        ))}
      </div>

      <div className="card p-5 sm:p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Tên của bạn</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vd: Nguyễn Văn A"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Khu vực tìm việc</label>
              <select
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-primary w-full"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Tiếp tục →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 text-center">
              <p className="text-sm font-medium text-indigo-900">
                Tải CV (PDF) để gợi ý kỹ năng tự động
              </p>
              <p className="mt-1 text-xs text-indigo-500">
                CV chỉ được đọc ngay trên trình duyệt của bạn, không tải lên máy chủ.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleCv(f);
                }}
              />
              <button
                className="btn-ghost mt-3"
                onClick={() => fileRef.current?.click()}
                disabled={cvBusy}
              >
                {cvBusy ? "Đang đọc CV…" : cvName ? `📄 ${cvName} — chọn file khác` : "📄 Chọn file CV (PDF)"}
              </button>
              {suggested.size > 0 && (
                <p className="mt-2 text-xs font-medium text-emerald-600">
                  Đã gợi ý {suggested.size} kỹ năng từ CV (đánh dấu ✦) — bạn tick duyệt lại bên dưới.
                </p>
              )}
              {cvError && <p className="mt-2 text-xs text-rose-500">{cvError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Kỹ năng của bạn ({skills.length}/{SKILL_CATALOG.length})
              </label>
              <SkillPicker selected={skills} onChange={setSkills} suggested={suggested} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Từ khoá vị trí mong muốn</label>
              <KeywordInput keywords={keywords} onChange={setKeywords} />
            </div>

            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>
                ← Quay lại
              </button>
              <button
                className="btn-primary flex-1"
                disabled={skills.length === 0}
                onClick={() => setStep(3)}
              >
                Tiếp tục →
              </button>
            </div>
            {skills.length === 0 && (
              <p className="text-center text-xs text-slate-400">
                Chọn ít nhất 1 kỹ năng để hệ thống chấm điểm khớp.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Kiểm tra lại hồ sơ</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">Tên</dt>
                <dd className="font-medium">{name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">Khu vực</dt>
                <dd>{location}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">Kỹ năng</dt>
                <dd className="flex flex-wrap gap-1">
                  {skills.map((s) => (
                    <span key={s} className="chip bg-indigo-50 text-indigo-700">
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">Từ khoá</dt>
                <dd>{keywords.length ? keywords.join(", ") : "—"}</dd>
              </div>
            </dl>
            <div className="flex gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setStep(2)}>
                ← Sửa lại
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() =>
                  onComplete({ name: name.trim(), location, keywords, skills })
                }
              >
                Tạo hồ sơ & xem việc ngay
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Hồ sơ của bạn chỉ lưu trên trình duyệt này. Dữ liệu việc là dữ liệu chung,
        được cập nhật tự động khoảng mỗi 30 phút.
      </p>
    </div>
  );
}
