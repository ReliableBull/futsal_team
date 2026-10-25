import portraits from "../public/images/player-portraits/20261005/manifest.json";
import cartoons from "../public/images/player-cartoons/20261005/manifest.json";

export type PlayerCardPhotoFit = "cover" | "contain";
export type PlayerCardPhoto = {
  id: "profile" | "arms-crossed" | "cheering" | "cartoon-arms-crossed" | "cartoon-cheering";
  label: string;
  url: string;
  fit: PlayerCardPhotoFit;
};

/** Match by player ID and use the manifest's final, versioned image paths. */
export function getPlayerCardPhotos(playerId: number, profileUrl: string, includeLegacyPhotos = true): PlayerCardPhoto[] {
  const photos: PlayerCardPhoto[] = [{ id: "profile", label: "기존 프로필", url: profileUrl, fit: "cover" }];
  if (!includeLegacyPhotos) return photos;
  const player = portraits.players.find((item) => item.id === playerId);
  if (player) {
    photos.push(
      { id: "arms-crossed", label: "팔짱", url: player.poses["arms-crossed"], fit: "contain" },
      { id: "cheering", label: "화이팅", url: player.poses.cheering, fit: "contain" }
    );
  }
  const cartoon = cartoons.players.find((item) => item.id === playerId);
  if (cartoon) {
    photos.push(
      { id: "cartoon-arms-crossed", label: "카툰 팔짱", url: cartoon.poses["arms-crossed"], fit: "contain" },
      { id: "cartoon-cheering", label: "카툰 화이팅", url: cartoon.poses.cheering, fit: "contain" }
    );
  }
  return photos;
}
