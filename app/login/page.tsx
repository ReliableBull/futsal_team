import { redirect } from "next/navigation";
import { PlatformLoginForm } from "@/components/PlatformLoginForm";
import { getSignedInAdmin } from "@/lib/auth";
import { requirePlatformMode } from "@/lib/teams";
import { loginReturnPath } from "@/lib/login-return";
export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  requirePlatformMode();
  const next = loginReturnPath(searchParams.next);
  if (await getSignedInAdmin()) redirect(next);
  return <section className="mx-auto my-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8"><p className="text-xs font-black tracking-widest text-red-600">WELCOME BACK</p><h1 className="mb-3 mt-3 text-3xl font-black">다시, 우리 팀으로.</h1><p className="mb-8 text-sm leading-6 text-slate-500">{next.startsWith("/t/") ? "동호회에 등록된 계정으로 로그인하면 공유받은 투표로 바로 돌아갑니다." : "로그인하고 내가 속한 동호회와 나의 역할을 확인하세요. 기존 ARENA FC 계정도 사용할 수 있습니다."}</p><PlatformLoginForm next={next} /><a href="/teams/new" className="mt-6 block text-center text-sm font-bold text-slate-600 underline">새 팀 만들기</a></section>;
}
