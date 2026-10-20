// Catalog kỹ năng dùng chung cho gợi ý CV, chấm điểm và panel "kỹ năng hot".
export const SKILL_CATALOG: string[] = [
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

// Một số tên kỹ năng hay bị viết khác trong JD/CV.
const SKILL_ALIASES: Record<string, string[]> = {
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Kiểm tra một kỹ năng có xuất hiện trong đoạn text hay không (khớp theo ranh giới từ). */
export function skillInText(skill: string, text: string): boolean {
  const hay = ` ${text.toLowerCase()} `;
  const candidates = [skill.toLowerCase(), ...(SKILL_ALIASES[skill] ?? [])];
  return candidates.some((c) => {
    const re = new RegExp(
      `(^|[^a-z0-9+#.])${escapeRegExp(c)}([^a-z0-9+#]|$)`,
      "i"
    );
    return re.test(hay);
  });
}

/** Tìm các kỹ năng trong catalog xuất hiện trong text (dùng cho trích xuất CV & JD). */
export function extractSkills(text: string, catalog: string[] = SKILL_CATALOG): string[] {
  return catalog.filter((s) => skillInText(s, text));
}

/** Chuẩn hoá để dedupe liên nguồn: bỏ dấu, thường hoá, bỏ ký tự lạ. */
export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function crossSourceKey(title: string, company: string): string {
  return `${normalizeKey(title)}|${normalizeKey(company)}`;
}
