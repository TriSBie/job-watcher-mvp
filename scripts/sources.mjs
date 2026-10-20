// Parser 3 nguồn job dùng cho ingest (chạy bằng Node thuần trong GitHub Actions).
// Mỗi hàm trả về mảng job đã chuẩn hoá:
// { id, title, company, location, url, source, postedAt (ISO|null), snippet, skills[] }

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function fetchText(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeById(jobs) {
  const seen = new Map();
  for (const j of jobs) if (!seen.has(j.id)) seen.set(j.id, j);
  return [...seen.values()];
}

// Chuẩn hoá vài tên kỹ năng hay gặp về dạng catalog.
const SKILL_CANON = new Map(
  Object.entries({
    reactjs: "React",
    "react.js": "React",
    nodejs: "Node.js",
    "node js": "Node.js",
    postgresql: "PostgreSQL",
    postgres: "PostgreSQL",
    javascript: "JavaScript",
    typescript: "TypeScript",
    nextjs: "Next.js",
    "next js": "Next.js",
    vuejs: "Vue.js",
    vue: "Vue.js",
    golang: "Go",
    k8s: "Kubernetes",
    dotnet: ".NET",
    "asp.net": ".NET",
    springboot: "Spring Boot",
    "spring boot": "Spring Boot",
    nestjs: "NestJS",
    expressjs: "Express",
    "rest api": "REST APIs",
    restful: "REST APIs",
  })
);

export function canonSkill(s) {
  return SKILL_CANON.get(s.trim().toLowerCase()) ?? s.trim();
}

// ---------------- LinkedIn (guest API, không login) ----------------
export async function fetchLinkedIn(keywords, location) {
  const jobs = [];
  for (const start of [0, 25]) {
    const url =
      "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
      `?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&start=${start}`;
    const html = await fetchText(url);
    const cards = html.split('<li>').slice(1);
    for (const card of cards) {
      const href = card.match(/href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"?]+)/);
      const title = card.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
      if (!href || !title) continue;
      const company = card.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
      const loc = card.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const time = card.match(/<time[^>]*datetime="([0-9-]+)"/);
      const jobUrl = href[1];
      const extId = (jobUrl.match(/-(\d+)\/?$/) || jobUrl.match(/(\d{6,})/) || [])[1] || jobUrl;
      jobs.push({
        id: `linkedin:${extId}`,
        title: stripTags(title[1]),
        company: company ? stripTags(company[1]) : "",
        location: loc ? stripTags(loc[1]) : location,
        url: jobUrl,
        source: "linkedin",
        postedAt: time ? time[1] : null,
        snippet: "",
        skills: [],
      });
    }
    if (cards.length < 10) break;
  }
  return dedupeById(jobs);
}

// ---------------- ITviec (parse trang search SSR) ----------------
const ITV_LOCATION_SLUGS = [
  [/hồ chí minh|ho chi minh|hcm/i, "ho-chi-minh-hcm"],
  [/hà nội|ha noi/i, "ha-noi"],
  [/đà nẵng|da nang/i, "da-nang"],
];

export function slugifyKeyword(kw) {
  return kw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function relativePostedToISO(text) {
  const now = Date.now();
  const m = text.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 }[m[2].toLowerCase()];
  return new Date(now - n * unit).toISOString().slice(0, 10);
}

export async function fetchITviec(keyword, location) {
  const kwSlug = slugifyKeyword(keyword);
  const locSlug = (ITV_LOCATION_SLUGS.find(([re]) => re.test(location)) || [])[1];
  const url = `https://itviec.com/it-jobs/${kwSlug}${locSlug ? `/${locSlug}` : ""}`;
  const html = await fetchText(url);
  const parts = html.split("data-search--job-selection-job-slug-value='").slice(1);
  const jobs = [];
  for (const part of parts) {
    const slug = part.slice(0, part.indexOf("'"));
    if (!slug) continue;
    const card = part.slice(0, 9000);
    const titleM = card.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    if (!titleM) continue;
    // Tên công ty: duyệt các thẻ a trỏ tới /companies/, lấy thẻ đầu tiên có text
    // (bỏ qua thẻ logo chỉ chứa ảnh).
    let company = "";
    for (const am of card.matchAll(/<a[^>]*href="\/companies\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
      const text = stripTags(am[1]);
      if (text) {
        company = text;
        break;
      }
    }
    const postedM = card.match(/Posted\s*([^<]+)/i);
    const skills = [...card.matchAll(/class="[^"]*itag[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((mm) =>
      canonSkill(stripTags(mm[1]))
    );
    const cityM = card.match(
      /(Ho Chi Minh|Ha Noi|Da Nang|Can Tho|Binh Duong|Dong Nai|Hai Phong|Remote)/i
    );
    jobs.push({
      id: `itviec:${slug}`,
      title: stripTags(titleM[1]),
      company,
      location: cityM ? cityM[1] : location,
      url: `https://itviec.com/it-jobs/${slug}`,
      source: "itviec",
      postedAt: postedM ? relativePostedToISO(postedM[1]) : null,
      snippet: "",
      skills: [...new Set(skills)],
    });
  }
  return dedupeById(jobs);
}

// ---------------- TopDev (parse flight payload của trang search) ----------------
function parseDMY(s) {
  const m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function fetchTopDev(keyword) {
  const html = await fetchText(
    `https://topdev.vn/jobs/search?keyword=${encodeURIComponent(keyword)}`
  );
  const flat = html.split('\\"').join('"');
  const jobs = [];
  const re = /\{"id":(\d{5,}),"title":"([^"]+)"/g;
  let m;
  while ((m = re.exec(flat)) !== null) {
    const id = m[1];
    const title = m[2];
    const seg = flat.slice(m.index, m.index + 12000);
    const companyM = seg.match(/"company":\{"id":\d+,"display_name":"([^"]+)"/);
    const slugM = seg.match(/"job_url":"[^"]*","slug":"([^"]+)"/);
    const publishedM = seg.match(/"published":\{"date":"([0-9-]+)"/);
    const skills = new Set();
    for (const sm of seg.matchAll(/"skills_arr":\[([^\]]*)\]/g)) {
      for (const q of sm[1].matchAll(/"([^"]+)"/g)) skills.add(canonSkill(q[1]));
    }
    const locM = seg.match(/"address_short_region_list":"([^"]+)"/);
    jobs.push({
      id: `topdev:${id}`,
      title,
      company: companyM ? companyM[1] : "",
      location: locM ? locM[1] : "Vietnam",
      url: `https://topdev.vn/detail-jobs/${slugM ? slugM[1] : ""}-${id}`,
      source: "topdev",
      postedAt: publishedM ? parseDMY(publishedM[1]) : null,
      snippet: "",
      skills: [...skills],
    });
    re.lastIndex = m.index + 100;
  }
  return dedupeById(jobs);
}
