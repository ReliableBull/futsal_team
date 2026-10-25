import type { TeamRole } from "./team-roles";

export const sportLabels = { FUTSAL: "풋살", FOOTBALL: "축구", BOTH: "축구 · 풋살" } as const;
export type Sport = keyof typeof sportLabels;
export const regions = ["서울", "경기", "인천", "대구", "부산", "대전", "광주", "울산", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "세종"];
export function isSport(value: string): value is Sport { return Object.hasOwn(sportLabels, value); }
export function matchesSport(sport: string, filter: string) { return !isSport(filter) || sport === filter || sport === "BOTH"; }
export function sportLabel(sport: string) { return isSport(sport) ? sportLabels[sport] : "풋살"; }
export type ClubSummary = {
  slug: string; name: string; description: string; region: string; color: string;
  sport: string; recruiting: boolean; schedule: string; joinUrl: string;
  playerCount: number; matchCount: number; role: TeamRole | null; managed: boolean; example: boolean;
};
export const exampleClubs: ClubSummary[] = [
  { slug: "hangang-united", name: "한강 유나이티드", description: "주말 아침, 공 하나로 시작하는 하루. 기본기부터 천천히 함께하는 축구 동호회입니다.", region: "서울 마포구", color: "#315d49", sport: "FOOTBALL", recruiting: true, schedule: "매주 토요일 오전 8시", joinUrl: "", playerCount: 24, matchCount: 18, role: null, managed: false, example: true },
  { slug: "suseong-kickoff", name: "수성 킥오프", description: "퇴근 후 두 시간은 온전히 우리 시간. 처음 시작하는 분도 함께 즐기는 풋살 모임이에요.", region: "대구 수성구", color: "#d47935", sport: "FUTSAL", recruiting: true, schedule: "매주 수요일 오후 8시", joinUrl: "", playerCount: 16, matchCount: 32, role: null, managed: false, example: true },
  { slug: "busan-wave", name: "부산 웨이브 FC", description: "승부도 좋지만 함께 뛰는 재미가 먼저. 축구와 풋살을 번갈아 즐기는 주말 동호회입니다.", region: "부산 수영구", color: "#4269a3", sport: "BOTH", recruiting: false, schedule: "매주 일요일 오전 10시", joinUrl: "", playerCount: 22, matchCount: 25, role: null, managed: false, example: true }
];
export const clubHref = (club: ClubSummary) => `/teams/${club.example ? "examples/" : ""}${club.slug}`;
