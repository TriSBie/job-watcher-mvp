"use client";

import { useState } from "react";
import { KeywordInput, LOCATIONS, SkillPicker } from "./ProfileFields";
import type { Profile } from "@/lib/store";

export default function ProfileForm({
  initial,
  onSave,
  onCancel,
  onDelete,
  onClearCv,
}: {
  initial?: Profile;
  onSave: (p: Omit<Profile, "id" | "createdAt">) => void;
  onCancel: () => void;
  /** Chỉ truyền khi đang SỬA hồ sơ: xoá hẳn hồ sơ + dữ liệu gắn kèm. */
  onDelete?: () => void;
  /** Chỉ truyền khi đang SỬA hồ sơ: xoá skills/keywords đã nạp từ CV, giữ lại hồ sơ. */
  onClearCv?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? LOCATIONS[0]);
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Tên</label>
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
      <div>
        <label className="mb-2 block text-sm font-medium">
          Kỹ năng ({skills.length} đã chọn)
        </label>
        <SkillPicker selected={skills} onChange={setSkills} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Từ khoá vị trí mong muốn</label>
        <KeywordInput keywords={keywords} onChange={setKeywords} />
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn-ghost" onClick={onCancel}>
          Huỷ
        </button>
        <button
          className="btn-primary flex-1"
          disabled={!name.trim() || skills.length === 0}
          onClick={() =>
            onSave({ name: name.trim(), location, keywords, skills })
          }
        >
          {initial ? "Lưu thay đổi" : "Tạo hồ sơ"}
        </button>
      </div>

      {initial && (onDelete || onClearCv) && (
        <div className="border-t border-line pt-4">
          <h3 className="text-sm font-medium text-ink">
            Xoá dữ liệu CV / hồ sơ
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Nếu không còn nhu cầu dùng thông tin CV đã nạp cho hồ sơ này, bạn có
            thể gỡ bỏ bên dưới. Dữ liệu chỉ lưu trên trình duyệt của bạn.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onClearCv && (
              <button
                type="button"
                className="btn-ghost !border-amber-400/30 !text-amber-300 hover:!border-amber-400/60"
                onClick={() => {
                  if (
                    confirm(
                      `Xoá dữ liệu CV của hồ sơ "${initial.name}"?\n\nToàn bộ kỹ năng và từ khoá đã nạp sẽ bị xoá, nhưng hồ sơ vẫn được giữ lại (trạng thái job và ghi chú không bị ảnh hưởng). Bạn có thể nạp lại CV sau.`
                    )
                  ) {
                    onClearCv();
                  }
                }}
              >
                🧹 Xoá dữ liệu CV
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="btn-ghost !border-rose-400/30 !text-rose-300 hover:!border-rose-400/60"
                onClick={() => {
                  if (
                    confirm(
                      `Xoá hẳn hồ sơ "${initial.name}"?\n\nToàn bộ trạng thái pipeline và ghi chú của hồ sơ này sẽ bị xoá khỏi trình duyệt và không thể khôi phục.`
                    )
                  ) {
                    onDelete();
                  }
                }}
              >
                🗑 Xoá hồ sơ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
