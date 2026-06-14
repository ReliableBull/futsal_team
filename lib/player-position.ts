export const playerPositions = [
  "공격수",
  "공격형미드필더",
  "미드필더",
  "수비형미드필더",
  "윙백",
  "풀백",
  "센터백"
] as const;

export const defaultPlayerPosition = "미드필더";

export function parsePlayerPosition(value: string) {
  return playerPositions.includes(value as (typeof playerPositions)[number]) ? value : defaultPlayerPosition;
}
