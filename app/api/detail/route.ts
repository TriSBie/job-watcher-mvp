import { NextRequest, NextResponse } from "next/server";
import { decodeHTML } from "entities";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ALLOWED_HOSTS = new Set([
  "www.linkedin.com",
  "linkedin.com",
  "vn.linkedin.com",
  "itviec.com",
  "topdev.vn",
  "www.topdev.vn",
]);

const ENTITY_RE = /&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#[xX][0-9a-fA-F]+);/;

/** Giải mã HTML entity đầy đủ (bảng HTML5: &ocirc; &aacute; &ndash; &hellip;,
 *  numeric &#...; / &#x...;). Lặp tối đa 3 vòng để xử lý cả trường hợp bị
 *  mã hoá 2 lớp (vd &amp;ocirc; -> &ocirc; -> ô). */
function decodeEntities(s: string): string {
  let out = s;
  for (let i = 0; i < 3; i++) {
    if (!ENTITY_RE.test(out)) break;
    const next = decodeHTML(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function stripTags(html: string): string {
  const noTags = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  // Giải mã entity SAU khi đã gỡ tag để các ký tự như &lt; không hoá thành tag.
  return decodeEntities(noTags)
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

interface JsonLdJob {
  title?: string;
  description?: string;
  datePosted?: string;
}

function extractJsonLd(html: string): JsonLdJob | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && item["@type"] === "JobPosting") {
          return {
            title: item.title,
            description: item.description,
            datePosted: item.datePosted,
          };
        }
      }
    } catch {
      // block không phải JSON sạch — bỏ qua
    }
  }
  return null;
}

/** Cắt 1 khối <div> cân bằng từ vị trí bắt đầu (đếm độ sâu thẻ div lồng nhau). */
function extractDiv(html: string, startIdx: number): string | null {
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = startIdx;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return html.slice(startIdx, re.lastIndex);
    } else if (!m[0].endsWith("/>")) {
      depth++;
    }
  }
  return null;
}

const SECTION_HEADING_RE =
  /(your role|your skills|benefits|trách nhiệm|yêu cầu|quyền lợi|phúc lợi)/i;

/** TopDev: JSON-LD của chính TopDev bị rỗng phần "Your role" / "Your skills"
 *  (chỉ còn tiêu đề mục + Benefits). Nội dung đầy đủ nằm ở HTML SSR: khối intro
 *  (div.text-text-600) + từng mục có heading span và khối nội dung div.mt-2. */
function extractTopDevDescription(html: string): string | null {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const parts: string[] = [];

  const introIdx = noScripts.indexOf("text-text-600");
  if (introIdx >= 0) {
    const divStart = noScripts.lastIndexOf("<div", introIdx);
    const block = divStart >= 0 ? extractDiv(noScripts, divStart) : null;
    if (block) {
      const text = stripTags(block);
      if (text.length > 30) parts.push(text);
    }
  }

  const headingRe =
    /<span[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  const headings: { title: string; start: number; end: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(noScripts))) {
    const title = decodeEntities(stripTags(hm[1]))
      .replace(/^\d+\s*/, "")
      .trim();
    if (title && SECTION_HEADING_RE.test(title)) {
      headings.push({ title, start: hm.index, end: hm.index + hm[0].length });
    }
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const regionEnd = i + 1 < headings.length ? headings[i + 1].start : h.end + 20000;
    const region = noScripts.slice(h.end, Math.min(regionEnd, noScripts.length));
    const mtIdx = region.indexOf('<div class="mt-2"');
    let text = "";
    if (mtIdx >= 0) {
      const block = extractDiv(region, mtIdx);
      if (block) text = stripTags(block);
    }
    if (!text) text = stripTags(region).slice(0, 4000);
    if (text.length > 20) parts.push(`${h.title}\n${text}`);
  }

  const out = parts.join("\n\n").trim();
  // Cần ít nhất intro + 2 mục mới coi là trích xuất thành công.
  return headings.length >= 2 && out.length >= 400 ? out : null;
}

function extractContainer(html: string): string | null {
  const patterns = [
    /<div[^>]*class=["'][^"']*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div[^>]*class=["'][^"']*job-description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<section[^>]*class=["'][^"']*job-description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*id=["']job-description[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1].length > 200) return stripTags(m[1]);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Thiếu tham số url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL không hợp lệ" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Host không được hỗ trợ" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const ld = extractJsonLd(html);
    let description: string | null = null;
    if (parsed.hostname.includes("topdev")) {
      description = extractTopDevDescription(html);
    }
    if (!description) {
      description = ld?.description ? stripTags(ld.description) : null;
      if (!description || description.length < 120) {
        description = extractContainer(html) ?? description;
      }
    }
    if (!description) {
      return NextResponse.json(
        {
          error: "Không trích xuất được mô tả từ trang này.",
          title: ld?.title ? decodeEntities(ld.title) : null,
        },
        { status: 200, headers: { "Cache-Control": "public, s-maxage=3600" } }
      );
    }
    return NextResponse.json(
      {
        title: ld?.title ? decodeEntities(ld.title) : null,
        datePosted: ld?.datePosted ?? null,
        description: description.slice(0, 12000),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Không tải được trang chi tiết: ${String(e)}` },
      { status: 200 }
    );
  }
}
