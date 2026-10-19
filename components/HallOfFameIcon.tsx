import type { HallOfFameIconKey } from "@/lib/hall-of-fame";

type HallOfFameIconProps = {
  name: HallOfFameIconKey;
  className?: string;
};

const iconPaths: Record<HallOfFameIconKey, React.ReactNode> = {
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.5M17 6h2.5A2.5 2.5 0 0 1 17 8.5" />
      <path d="M12 14v3m-3.5 3h7M9 20a3 3 0 0 1 3-3 3 3 0 0 1 3 3" />
    </>
  ),
  calendar: (
    <>
      <rect height="15" rx="1.5" width="16" x="4" y="5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c2.5 3 1 5 3.5 7.5C17 12 18 13.6 18 15.3A6 6 0 0 1 6 15.3c0-2.3 1.3-3.6 2.6-5.3" />
      <path d="M12 20a2.6 2.6 0 0 1-2.6-2.6c0-1.6 2.6-3.4 2.6-3.4s2.6 1.8 2.6 3.4A2.6 2.6 0 0 1 12 20Z" />
    </>
  ),
  ballFlame: (
    <>
      <circle cx="10" cy="14" r="6" />
      <path d="m10 10.6 2.6 1.9-1 3h-3.2l-1-3L10 10.6Z" />
      <path d="M17.5 3c1.4 1.8.4 2.9 1.9 4.4.9.9 1.6 1.8 1.6 3a3.5 3.5 0 0 1-7 0c0-1.3.7-2.1 1.5-3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  pass: (
    <>
      <circle cx="8.5" cy="14.5" r="5" />
      <path d="m8.5 11.3 2.9 2.1-1.1 3.4H6.7l-1.1-3.4 2.9-2.1Z" />
      <path d="M13.2 11 19.5 4.7" />
      <path d="M14.8 4.5h4.9v4.9" />
    </>
  ),
  star: (
    <>
      <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z" />
      <path d="M12 9.4v3.3" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 7 3.8 2.8-1.5 4.5H9.7l-1.5-4.5L12 7Z" />
      <path d="M12 3.5V7M4 10.2l4.2-.4M20 10.2l-4.2-.4M7.4 19.3l2.3-4.9M16.6 19.3l-2.3-4.9" />
    </>
  ),
  medal: (
    <>
      <path d="M8.2 3 11 8.6M15.8 3 13 8.6" />
      <circle cx="12" cy="14.8" r="5.6" />
      <path d="m12 11.6 1.05 2.13 2.35.34-1.7 1.66.4 2.34L12 16.7l-2.1 1.37.4-2.34-1.7-1.66 2.35-.34L12 11.6Z" />
    </>
  )
};

export function HallOfFameIcon({ name, className = "h-5 w-5" }: HallOfFameIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  );
}
