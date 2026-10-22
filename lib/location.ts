import { normalizeKey } from "./skills";

export type Region = "Hồ Chí Minh" | "Hà Nội" | "Đà Nẵng" | "Remote" | "Khác";

const REGION_ORDER: Region[] = ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Remote", "Khác"];

// Quận/huyện đặc trưng — giúp nhận diện thành phố khi chuỗi location chỉ ghi quận
// (vd LinkedIn hay trả "Quận 7" thay vì tên thành phố).
const HCMC_DISTRICTS = [
  "thu duc", "binh thanh", "go vap", "tan binh", "tan phu", "binh tan",
  "phu nhuan", "cu chi", "hoc mon", "nha be", "binh chanh", "can gio",
];
const HANOI_DISTRICTS = [
  "cau giay", "dong da", "thanh xuan", "ba dinh", "hoan kiem", "nam tu liem",
  "bac tu liem", "ha dong", "long bien", "tay ho", "hoang mai", "hai ba trung",
];
const DANANG_DISTRICTS = ["hai chau", "thanh khe", "son tra", "ngu hanh son", "lien chieu"];

/** Tất cả khu vực được nhắc tới trong chuỗi location của job (đã chuẩn hoá). */
export function locationRegions(location: string): Region[] {
  const t = ` ${normalizeKey(location)} `;
  const found = new Set<Region>();
  if (/\bremote\b/.test(t)) found.add("Remote");
  if (
    /ho chi minh|hcmc|tphcm|tp hcm|saigon|sai gon/.test(t) ||
    /(^|\s)quan\s*\d+/.test(t) ||
    HCMC_DISTRICTS.some((d) => t.includes(` ${d} `) || t.includes(` ${d},`))
  ) {
    found.add("Hồ Chí Minh");
  }
  if (/ha noi|hanoi/.test(t) || HANOI_DISTRICTS.some((d) => t.includes(` ${d} `))) {
    found.add("Hà Nội");
  }
  if (/da nang|danang/.test(t) || DANANG_DISTRICTS.some((d) => t.includes(` ${d} `))) {
    found.add("Đà Nẵng");
  }
  return REGION_ORDER.filter((r) => found.has(r));
}

/** Khu vực chính (ưu tiên theo thứ tự Hồ Chí Minh → Hà Nội → Đà Nẵng → Remote). */
export function primaryRegion(location: string): Region {
  return locationRegions(location)[0] ?? "Khác";
}

/** Khu vực suy ra từ location của hồ sơ ("Ho Chi Minh City, Vietnam" → Hồ Chí Minh).
 *  Trả null khi hồ sơ chọn cả nước ("Vietnam") — nghĩa là không lọc. */
export function profileRegion(profileLocation: string): Region | null {
  const regions = locationRegions(profileLocation);
  return regions[0] ?? null;
}

/** Job có thuộc khu vực đang lọc không. Job không ghi rõ thành phố (vd chỉ "Vietnam")
 *  được coi là toàn quốc → vẫn hiển thị; job Remote hiển thị cho mọi khu vực. */
export function jobMatchesRegion(jobLocation: string, region: Region): boolean {
  if (region === "Khác") return primaryRegion(jobLocation) === "Khác";
  const regions = locationRegions(jobLocation);
  if (regions.length === 0) return true;
  return regions.includes(region) || regions.includes("Remote");
}
