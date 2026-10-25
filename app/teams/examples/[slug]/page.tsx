import { notFound } from "next/navigation";
import { exampleClubs } from "@/lib/community";
import { requirePlatformMode } from "@/lib/teams";
import { ClubProfile } from "@/components/ClubProfile";

export default function ExampleClubPage({ params }: { params: { slug: string } }) {
  requirePlatformMode();
  const club = exampleClubs.find(item => item.slug === params.slug);
  if (!club) notFound();
  return <ClubProfile club={club} />;
}
