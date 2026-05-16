import { redirect } from "next/navigation";
import { loginAdmin } from "@/lib/actions";
import { getCurrentAdmin } from "@/lib/auth";

export default async function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect("/abcd");
  }

  return (
    <div className="mx-auto max-w-md">
      <section className="rounded-lg border border-arena-line bg-arena-panel p-6 shadow-2xl shadow-black/30">
        <p className="text-sm font-bold uppercase text-arena-lime">Admin Login</p>
        <h1 className="mt-2 text-3xl font-black text-white">관리자 로그인</h1>
        <p className="mt-2 text-sm text-slate-400">DB에 등록된 관리자 계정만 관리자 페이지에 접근할 수 있습니다.</p>

        {searchParams.error ? (
          <div className="mt-5 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
            아이디 또는 비밀번호가 올바르지 않습니다.
          </div>
        ) : null}

        <form action={loginAdmin} className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            아이디
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="username" autoComplete="username" required />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-200">
            비밀번호
            <input className="w-full rounded-md border border-arena-line bg-black/30 px-3 py-2" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="w-full rounded-md bg-arena-lime px-4 py-3 font-black text-arena-black transition hover:bg-white" type="submit">
            로그인
          </button>
        </form>
      </section>
    </div>
  );
}
