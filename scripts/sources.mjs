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
    elasticsearch: "Elasticsearch",
    mongodb: "MongoDB",
    mysql: "MySQL",
    redis: "Redis",
    kafka: "Kafka",
    docker: "Docker",
    python: "Python",
    java: "Java",
    php: "PHP",
    ruby: "Ruby",
    rails: "Rails",
    django: "Django",
    flask: "Flask",
    laravel: "Laravel",
    graphql: "GraphQL",
    grpc: "gRPC",
    terraform: "Terraform",
    jenkins: "Jenkins",
    firebase: "Firebase",
    supabase: "Supabase",
    rabbitmq: "RabbitMQ",
    nginx: "Nginx",
    html: "HTML",
    css: "CSS",
    tailwind: "Tailwind",
    flutter: "Flutter",
    swift: "Swift",
    kotlin: "Kotlin",
    android: "Android",
    ios: "iOS",
    sql: "SQL",
    nosql: "NoSQL",
    jest: "Jest",
    cypress: "Cypress",
    selenium: "Selenium",
    figma: "Figma",
    azure: "Azure",
    gcp: "GCP",
    aws: "AWS",
    prisma: "Prisma",
    typeorm: "TypeORM",
    bullmq: "BullMQ",
    svelte: "Svelte",
    express: "Express",
    fastapi: "FastAPI",
    git: "Git",
    linux: "Linux",
  })
);

export function canonSkill(s) {
  return SKILL_CANON.get(s.trim().toLowerCase()) ?? s.trim();
}

// --- Catalog kỹ năng (bản sao của lib/skills.ts — giữ đồng bộ khi sửa catalog) ---
// Dùng để: lọc tag rác của TopDev theo whitelist và trích skill từ JD LinkedIn.
const SKILL_CATALOG_JS = [
  "Java", "Spring Boot", "TypeScript", "JavaScript", "Node.js", "NestJS",
  "Express", "Next.js", "React", "PostgreSQL", "MySQL", "Redis", "Kafka",
  "BullMQ", "Prisma", "TypeORM", "Docker", "AWS", "Microservices",
  "REST APIs", "Python", "Django", "Flask", "FastAPI", "Go", "PHP",
  "Laravel", "C#", ".NET", "Ruby", "Rails", "Angular", "Vue.js", "Nuxt.js",
  "Svelte", "MongoDB", "SQLite", "GraphQL", "gRPC", "Kubernetes", "CI/CD",
  "Git", "Linux", "Firebase", "Supabase", "Elasticsearch", "RabbitMQ",
  "Nginx", "HTML", "CSS", "Tailwind", "Flutter", "React Native", "Swift",
  "Kotlin", "Android", "iOS", "TensorFlow", "PyTorch", "SQL", "NoSQL",
  "Terraform", "Jenkins", "GitHub Actions", "Jest", "Cypress", "Selenium",
  "Figma", "Azure", "GCP",
];
const SKILL_ALIASES_JS = {
  "Node.js": ["nodejs", "node js"],
  "REST APIs": ["rest api", "restful", "rest apis"],
  "Spring Boot": ["springboot"],
  "Next.js": ["nextjs"],
  "Vue.js": ["vuejs", "vue"],
  "Nuxt.js": ["nuxtjs", "nuxt"],
  "React Native": ["react-native"],
  "CI/CD": ["cicd", "ci cd"],
  ".NET": ["dotnet", ".net core", "asp.net"],
  "C#": ["csharp", "c sharp"],
  "GitHub Actions": ["github action"],
};

function escapeRegExpJs(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function skillInTextJs(skill, text) {
  const hay = ` ${text.toLowerCase()} `;
  const candidates = [skill.toLowerCase(), ...(SKILL_ALIASES_JS[skill] ?? [])];
  return candidates.some((c) =>
    new RegExp(`(^|[^a-z0-9+#.])${escapeRegExpJs(c)}([^a-z0-9+#]|$)`, "i").test(hay)
  );
}

/** Trích các kỹ năng trong catalog xuất hiện trong text (JD, mô tả...). */
export function extractSkillsFromText(text) {
  return SKILL_CATALOG_JS.filter((s) => skillInTextJs(s, text));
}

/** Giải mã các chuỗi escape unicode còn sót dạng \uXXXX (hay gặp ở payload TopDev). */
export function decodeUnicodeEscapes(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );
}

// Kỹ thuật hợp lệ nhưng không nằm trong catalog — vẫn giữ khi lọc tag TopDev.
const TECH_EXTRA = new Set(
  [
    "c++", "c", "c/c++", "oop", "data structures", "data structure & algorithm",
    "algorithms", "embedded", "rtos", "kernel", "cobol", "sap", "unity",
    "ai", "machine learning", "deep learning", "agile", "scrum", "jira",
    "postgis", "gis", "automation test", "manual test", "testing", "spring",
    "hibernate", "maven", "gradle", "oracle", "sql server", "mariadb",
    "cassandra", "hadoop", "spark", "airflow", "dbt", "snowflake",
  ].map((s) => s.toLowerCase())
);
const CATALOG_KEYS = new Set(SKILL_CATALOG_JS.map((s) => s.toLowerCase()));

/** Lọc tag TopDev: sàn này trả cả tag toàn công ty (Sales, Kế toán...) — chỉ giữ tag kỹ thuật. */
export function filterTechTags(tags) {
  const out = [];
  for (const raw of tags) {
    const tag = canonSkill(decodeUnicodeEscapes(raw));
    const key = tag.toLowerCase();
    if (CATALOG_KEYS.has(key) || TECH_EXTRA.has(key)) out.push(tag);
  }
  return [...new Set(out)];
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

/** Lấy JD đầy đủ của 1 job LinkedIn qua guest API (dùng để trích skill —
 *  trang search không trả skills). Trả text thuần, tối đa ~6000 ký tự. */
export async function fetchLinkedInDetail(extId) {
  const html = await fetchText(
    `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${extId}`
  );
  const m = html.match(
    /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i
  );
  const raw = m ? m[1] : html;
  return stripTags(raw).slice(0, 6000);
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
    // Giới hạn đoạn quét trong object của chính job này — nếu kéo dài sang object
    // của job kế tiếp sẽ bị rò tag/kỹ năng của job khác vào.
    const rest = flat.slice(m.index + 10);
    const nextJob = rest.search(/\{"id":\d{5,},"title":"/);
    const segEnd = nextJob >= 0 ? m.index + 10 + nextJob : m.index + 12000;
    const seg = flat.slice(m.index, Math.min(segEnd, m.index + 12000));
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
      title: decodeUnicodeEscapes(title),
      company: companyM ? decodeUnicodeEscapes(companyM[1]) : "",
      location: locM ? decodeUnicodeEscapes(locM[1]) : "Vietnam",
      url: `https://topdev.vn/detail-jobs/${slugM ? slugM[1] : ""}-${id}`,
      source: "topdev",
      postedAt: publishedM ? parseDMY(publishedM[1]) : null,
      snippet: "",
      skills: filterTechTags([...skills]),
    });
    re.lastIndex = m.index + 100;
  }
  return dedupeById(jobs);
}
