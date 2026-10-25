"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useTeamPath } from "@/components/TeamProvider";

export default function TeamLink({ href, ...props }: ComponentProps<typeof Link>) {
  const path = useTeamPath();
  return <Link {...props} href={typeof href === "string" ? path(href) : { ...href, pathname: path(href.pathname || "/") }} />;
}
