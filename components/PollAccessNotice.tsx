export function PollAccessNotice({ ownerOnly = false, legacy = false }: { ownerOnly?: boolean; legacy?: boolean }) {
  return <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7">
    <h1 className="text-2xl font-black">{legacy ? "관리자만 투표를 만들 수 있어요" : ownerOnly ? "회장(운영자)만 만들 수 있어요" : "동호회 회원 전용 투표입니다"}</h1>
    <p className="mt-4 text-sm leading-7 text-slate-600">{legacy ? "투표 참여는 로그인 없이 이름을 입력하면 됩니다." : ownerOnly ? "회원은 진행 중인 투표에 참여할 수 있습니다." : "현재 계정은 이 동호회에 속해 있지 않습니다. 동호회에 등록된 계정으로 로그인해주세요."}</p>
    <a href={legacy ? "/polls" : "/teams?mine=1"} className="platform-button mt-6 inline-block">{legacy ? "투표 목록으로 이동" : "내 동호회로 이동"}</a>
  </section>;
}
