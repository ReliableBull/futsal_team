import { DemoBookingList } from "@/components/DemoBookingList";
import { requirePlatformMode } from "@/lib/teams";

export default function BookingsPage() {
  requirePlatformMode();
  return <div className="mx-auto max-w-3xl space-y-7 pb-12 pt-4"><div><p className="community-eyebrow">MY NEXT GAME</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">예시 예약 내역</h1><p className="mt-4 text-sm leading-7 text-slate-500">현재 브라우저에서 체험한 예약을 확인하고 취소할 수 있습니다. 실제 예약이 아니며, 다른 기기나 계정과 공유되지 않습니다.</p></div><DemoBookingList /></div>;
}
