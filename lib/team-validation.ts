import { teamSlugPattern } from "./team-paths";
import { isSport } from "./community";

export type TeamFormState = { error?: string };
export function parseTeamFields(form: FormData) {
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const name = value("name"), slug = value("slug").toLowerCase(), region = value("region"), description = value("description"), color = value("color") || "#e53935";
  if (name.length < 2 || name.length > 60) throw new Error("팀 이름은 2~60자로 입력해주세요.");
  if (slug.length < 3 || slug.length > 48 || !teamSlugPattern.test(slug)) throw new Error("팀 주소는 영문 소문자·숫자·하이픈으로 3~48자 입력해주세요.");
  if (region.length > 60 || description.length > 300) throw new Error("활동 지역은 60자, 소개는 300자 이내로 입력해주세요.");
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("팀 색상을 선택해주세요.");
  const sport = value("sport") || "FUTSAL", schedule = value("schedule"), joinUrl = value("joinUrl");
  const recruiting = value("recruiting") === "on";
  if (!isSport(sport)) throw new Error("축구 또는 풋살 종목을 선택해주세요.");
  if (schedule.length > 100) throw new Error("정기 모임은 100자 이내로 입력해주세요.");
  if (joinUrl) {
    let url: URL;
    try { url = new URL(joinUrl); } catch { throw new Error("가입 문의 링크는 올바른 https 주소로 입력해주세요."); }
    if (joinUrl.length > 300 || url.protocol !== "https:" || url.username || url.password) throw new Error("가입 문의 링크는 300자 이내의 https 주소로 입력해주세요.");
  }
  return { name, slug, region, description, color, sport, schedule, recruiting, joinUrl };
}
