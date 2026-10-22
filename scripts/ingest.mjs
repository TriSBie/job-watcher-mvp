// Ingest job từ 3 nguồn vào data/jobs.json (chạy trong GitHub Actions mỗi 30 phút,
// hoặc chạy tay: node scripts/ingest.mjs). Idempotent: chạy trùng không nhân đôi job.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchLinkedIn,
  fetchLinkedInDetail,
  fetchITviec,
  fetchTopDev,
  extractSkillsFromText,
  filterTechTags,
  decodeUnicodeEscapes,
} from "./sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data", "jobs.json");

const KEYWORDS = [
  "backend developer",
  "fullstack developer",
  "java developer",
  "node.js developer",
  "software engineer",
];
const LOCATION = "Ho Chi Minh City, Vietnam";
const MAX_AGE_DAYS = 30;

const TITLE_BLOCKLIST = [
  "senior", "staff", "lead", "manager", "architect", "intern", "fresher",
  "principal", "director", "qa", "qc", "tester", "data scientist",
  "data analyst", "data engineer", "machine learning", "devops",
  "business analyst", "product owner", "product manager",
];

function titlePasses(title) {
  const t = title.toLowerCase();
  return !TITLE_BLOCKLIST.some((w) =>
    new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t)
  );
}

function normalizeKey(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const crossKey = (j) => `${normalizeKey(j.title)}|${normalizeKey(j.company)}`;

async function main() {
  let existing = { jobs: [], runs: [] };
  if (existsSync(DATA_FILE)) {
    try {
      existing = JSON.parse(await readFile(DATA_FILE, "utf8"));
    } catch {
      existing = { jobs: [], runs: [] };
    }
  }
  const now = Date.now();
  const pool = new Map(); // id -> job (kèm firstSeenAt)
  for (const j of existing.jobs ?? []) pool.set(j.id, j);
  const crossSeen = new Map();
  for (const j of pool.values()) crossSeen.set(crossKey(j), j.id);

  const sourceStatus = { linkedin: "ok", itviec: "ok", topdev: "ok" };
  const perSource = { linkedin: 0, itviec: 0, topdev: 0 };
  let fetched = 0;
  let added = 0;

  const ingestJobs = (jobs, source) => {
    for (const job of jobs) {
      fetched++;
      if (!titlePasses(job.title)) continue;
      // TopDev là sàn tổng quát (không chỉ IT) — thêm cổng liên quan mảng IT.
      if (
        source === "topdev" &&
        !/developer|engineer|software|backend|back-end|frontend|front-end|fullstack|full-stack|devops|tester|mobile|ios|android|it\b|data|ai\b/i.test(job.title)
      ) {
        continue;
      }
      if (pool.has(job.id)) {
        // cập nhật nhẹ: giữ firstSeenAt cũ, làm mới postedAt/skills nếu có.
        // QUAN TRỌNG: không để skills/snippet rỗng của bản fetch mới ghi đè dữ
        // liệu đã trích được từ JD ở các lần trước (LinkedIn hay dính 429).
        const old = pool.get(job.id);
        const merged = { ...old, ...job, firstSeenAt: old.firstSeenAt };
        if (!(job.skills && job.skills.length) && old.skills && old.skills.length) {
          merged.skills = old.skills;
        }
        if (!job.snippet && old.snippet) merged.snippet = old.snippet;
        pool.set(job.id, merged);
        continue;
      }
      const ck = crossKey(job);
      if (job.company && crossSeen.has(ck)) continue; // trùng liên nguồn
      pool.set(job.id, { ...job, firstSeenAt: now });
      crossSeen.set(ck, job.id);
      added++;
    }
  };

  // LinkedIn — 1 query gộp từ khoá chính
  try {
    const jobs = await fetchLinkedIn("backend developer", LOCATION);
    perSource.linkedin = jobs.length;
    // Trang search LinkedIn không trả skills — lấy JD của job mới (và job cũ
    // còn trống skills) để trích kỹ năng. Guest API rất dễ dính 429 nên mỗi lần
    // ingest chỉ lấy tối đa 12 JD, giãn cách rộng, và dừng ngay khi gặp 429 —
    // phần còn thiếu sẽ được bù dần ở các lần ingest sau.
    let detailBudget = 12;
    for (const job of jobs) {
      if (detailBudget <= 0) break;
      const old = pool.get(job.id);
      const needsSkills = !old || !(old.skills && old.skills.length);
      if (!needsSkills || job.skills.length) continue;
      detailBudget--;
      try {
        const extId = job.id.replace("linkedin:", "");
        const jd = await fetchLinkedInDetail(extId);
        if (jd) {
          job.skills = extractSkillsFromText(jd);
          job.snippet = jd.slice(0, 280);
        }
      } catch (e) {
        console.error(`LinkedIn detail ${job.id} lỗi:`, e.message);
        if (String(e.message).includes("429")) break;
      }
      await new Promise((r) => setTimeout(r, 900));
    }
    ingestJobs(jobs, "linkedin");
  } catch (e) {
    sourceStatus.linkedin = "error";
    console.error("LinkedIn lỗi:", e.message);
  }

  // ITviec — theo từng từ khoá
  try {
    let okCount = 0;
    for (const kw of KEYWORDS) {
      try {
        const jobs = await fetchITviec(kw, LOCATION);
        perSource.itviec += jobs.length;
        okCount++;
        ingestJobs(jobs, "itviec");
      } catch (e) {
        console.error(`ITviec [${kw}] lỗi:`, e.message);
      }
    }
    if (okCount === 0) sourceStatus.itviec = "error";
  } catch {
    sourceStatus.itviec = "error";
  }

  // TopDev — theo từng từ khoá
  try {
    let okCount = 0;
    for (const kw of KEYWORDS) {
      try {
        const jobs = await fetchTopDev(kw);
        perSource.topdev += jobs.length;
        okCount++;
        ingestJobs(jobs, "topdev");
      } catch (e) {
        console.error(`TopDev [${kw}] lỗi:`, e.message);
      }
    }
    if (okCount === 0) sourceStatus.topdev = "error";
  } catch {
    sourceStatus.topdev = "error";
  }

  // Vệ sinh dữ liệu cũ: job TopDev nạp từ các lần trước (chưa qua whitelist)
  // vẫn còn tag rác — lọc lại ngay tại pool trước khi ghi ra.
  for (const j of pool.values()) {
    j.title = decodeUnicodeEscapes(j.title ?? "");
    if (j.company) j.company = decodeUnicodeEscapes(j.company);
    if (j.source === "topdev" && Array.isArray(j.skills)) {
      j.skills = filterTechTags(j.skills);
    }
  }

  // Dọn job quá 30 ngày (theo postedAt, thiếu thì theo firstSeenAt)
  const cutoff = now - MAX_AGE_DAYS * 864e5;
  const jobs = [...pool.values()].filter((j) => {
    const ref = j.postedAt ? Date.parse(j.postedAt) : j.firstSeenAt;
    return !ref || ref >= cutoff;
  });

  const run = {
    at: new Date(now).toISOString(),
    fetched,
    added,
    total: jobs.length,
    perSource,
    sourceStatus,
  };
  const out = {
    updatedAt: run.at,
    sourceStatus,
    runs: [...(existing.runs ?? []), run].slice(-12),
    jobs: jobs.sort((a, b) =>
      (b.postedAt ?? "") < (a.postedAt ?? "") ? -1 : 1
    ),
  };
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(out, null, 1));
  console.log("Ingest xong:", JSON.stringify(run));
}

main().catch((e) => {
  console.error("Ingest thất bại:", e);
  process.exit(1);
});
