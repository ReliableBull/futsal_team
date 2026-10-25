"use client";
import { useFormState, useFormStatus } from "react-dom";
import { loginPlatform } from "@/lib/team-actions";
function Submit() { const { pending } = useFormStatus(); return <button className="platform-button w-full disabled:opacity-50" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</button>; }
export function PlatformLoginForm({ next = "/teams?mine=1" }: { next?: string }) {
  const [state, action] = useFormState(loginPlatform, {});
  return <form action={action} className="space-y-5"><input type="hidden" name="next" value={next} />{state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}<label className="platform-label">아이디<input className="platform-input" name="username" autoComplete="username" required /></label><label className="platform-label">비밀번호<input className="platform-input" type="password" name="password" autoComplete="current-password" required /></label><Submit /></form>;
}
