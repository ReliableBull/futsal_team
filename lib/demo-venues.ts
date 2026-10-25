import type { Sport } from "./community";

export type DemoVenue = {
  slug: string; name: string; region: string; sport: Sport; setting: "실내" | "야외";
  format: string; size: string; price: number; theme: "rooftop" | "park" | "indoor" | "night";
  description: string; facilities: string[]; hours: number[];
};

// Fictional catalogue. Never send these requests to a real venue or payment provider.
export const demoVenues: DemoVenue[] = [
  { slug: "seongsu-rooftop", name: "성수 루프탑 풋살파크", region: "서울 성동구", sport: "FUTSAL", setting: "야외", format: "6 vs 6", size: "40 × 20m", price: 100000, theme: "rooftop", description: "도심 위에서 즐기는 우리만의 두 시간. 탁 트인 루프탑과 야간 조명을 갖춘 풋살 구장입니다.", facilities: ["주차", "야간 조명", "탈의실", "공 대여"], hours: [8, 10, 14, 16, 18, 20, 22] },
  { slug: "hangang-green", name: "한강 그린 축구장", region: "경기 고양시", sport: "FOOTBALL", setting: "야외", format: "11 vs 11", size: "100 × 64m", price: 180000, theme: "park", description: "넓은 잔디 위에서 제대로 한 경기. 주말 정기전과 동호회 친선전을 위한 축구장입니다.", facilities: ["주차", "샤워실", "관람석", "야간 조명"], hours: [8, 10, 12, 14, 16, 18, 20] },
  { slug: "suseong-indoor", name: "수성 인도어 아레나", region: "대구 수성구", sport: "FUTSAL", setting: "실내", format: "5 vs 5", size: "32 × 18m", price: 80000, theme: "indoor", description: "비가 와도 약속은 그대로. 날씨 걱정 없이 모일 수 있는 쾌적한 실내 풋살 구장입니다.", facilities: ["실내", "주차", "냉난방", "공 대여"], hours: [8, 10, 12, 14, 16, 18, 20, 22] },
  { slug: "gwangan-night", name: "광안 나이트 풋살장", region: "부산 수영구", sport: "FUTSAL", setting: "야외", format: "6 vs 6", size: "38 × 20m", price: 90000, theme: "night", description: "하루를 마무리하는 가장 즐거운 방법. 퇴근 후 동료들과 가볍게 모이기 좋은 야외 구장입니다.", facilities: ["야간 조명", "탈의실", "휴게 공간"], hours: [10, 12, 14, 16, 18, 20, 22] }
];
export const getDemoVenue = (slug: string) => demoVenues.find(venue => venue.slug === slug);
export const won = (price: number) => `${price.toLocaleString("ko-KR")}원`;
export const slotLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00 – ${String(hour + 2).padStart(2, "0")}:00`;

export function bookingDates(now = new Date()) {
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = new Date(`${kstDate}T00:00:00Z`).getTime();
  return Array.from({ length: 7 }, (_, day) => new Date(start + day * 86400000).toISOString().slice(0, 10));
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(`${date}T12:00:00+09:00`));
}
export function isFutureSlot(date: string, hour: number, now = new Date()) {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+09:00`).getTime() > now.getTime();
}

export type DemoBooking = { id: string; venueSlug: string; date: string; hour: number; teamName: string; price: number; status: "REQUESTED" | "CANCELLED"; createdAt: string };
export const demoBookingsKey = "arena.demo-bookings.v1";

export function readDemoBookings(raw: string | null): DemoBooking[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((value): value is DemoBooking => {
      if (!value || typeof value !== "object") return false;
      const b = value as Partial<DemoBooking>, venue = typeof b.venueSlug === "string" && getDemoVenue(b.venueSlug);
      return Boolean(venue && typeof b.id === "string" && b.id.length <= 100 && typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && Number.isFinite(Date.parse(`${b.date}T00:00:00Z`)) && typeof b.hour === "number" && venue.hours.includes(b.hour) && typeof b.teamName === "string" && b.teamName.length >= 2 && b.teamName.length <= 60 && b.price === venue.price && ["REQUESTED", "CANCELLED"].includes(b.status || "") && typeof b.createdAt === "string" && Number.isFinite(Date.parse(b.createdAt)));
    }).slice(0, 100);
  } catch { return []; }
}

export function addDemoBooking(bookings: DemoBooking[], input: { venueSlug: string; date: string; hour: number; teamName: string }, id: string, now = new Date()): DemoBooking[] {
  const venue = getDemoVenue(input.venueSlug), name = input.teamName.trim();
  if (!venue || !venue.hours.includes(input.hour) || !bookingDates(now).includes(input.date) || !isFutureSlot(input.date, input.hour, now)) throw new Error("예약할 수 있는 날짜와 시간을 다시 선택해주세요.");
  if (name.length < 2 || name.length > 60) throw new Error("동호회 이름은 2~60자로 입력해주세요.");
  if (bookings.some(b => b.status === "REQUESTED" && b.venueSlug === input.venueSlug && b.date === input.date && b.hour === input.hour)) throw new Error("이미 예시 예약을 요청한 시간입니다. 예약 내역을 확인해주세요.");
  if (bookings.length >= 100) throw new Error("예시 예약 내역이 가득 찼습니다. 내역을 초기화한 뒤 다시 체험해주세요.");
  return [{ id, ...input, teamName: name, price: venue.price, status: "REQUESTED", createdAt: now.toISOString() }, ...bookings];
}
