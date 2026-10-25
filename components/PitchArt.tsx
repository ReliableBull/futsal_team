import type { DemoVenue } from "@/lib/demo-venues";

export function PitchArt({ theme = "park", large = false }: { theme?: DemoVenue["theme"]; large?: boolean }) {
  return <div aria-hidden="true" className={`pitch-art pitch-art-${theme} ${large ? "pitch-art-large" : ""}`}><div className="pitch-surround"><div className="pitch-field"><div className="pitch-touchline"><div className="pitch-half" /><div className="pitch-circle" /><div className="pitch-box pitch-box-left" /><div className="pitch-box pitch-box-right" /><i className="pitch-dot pitch-dot-one" /><i className="pitch-dot pitch-dot-two" /><i className="pitch-dot pitch-dot-three" /><i className="pitch-dot pitch-dot-four" /></div></div></div><span className="pitch-art-caption">ARENA FIELD COLLECTION / ILLUSTRATION</span></div>;
}
