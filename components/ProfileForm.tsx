"use client";

import { useState } from "react";
import { KeywordInput, LOCATIONS, SkillPicker } from "./ProfileFields";
import type { Profile } from "@/lib/store";

export default function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Profile;
  onSave: (p: Omit<Profile, "id" | "createdAt">) => void;
  onCancel: () => void;
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
    </div>
  );
}
