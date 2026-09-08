import { getTimeOfDay, type MapType } from "../domain";

interface GameAtmosphereProps {
  map: MapType;
  round: number;
  overlay?: boolean;
}

/** Decorative atmosphere only. It never participates in canvas input or drawing coordinates. */
export default function GameAtmosphere({ map, round, overlay = false }: GameAtmosphereProps) {
  const time = getTimeOfDay(round);
  const progressed = round >= 2;

  return (
    <div
      className={`game-atmosphere game-atmosphere--${map} game-atmosphere--${time} ${progressed ? "game-atmosphere--progressed" : ""} ${overlay ? "game-atmosphere--overlay" : ""}`}
      aria-hidden="true"
    >
      <div className="game-atmosphere__sky" />
      <div className="game-atmosphere__horizon" />

      {map === "earth" ? (
        <svg className="game-atmosphere__earth-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="earth-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fd8d1" />
              <stop offset="1" stopColor="#2c6970" />
            </linearGradient>
            <linearGradient id="earth-mountain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#557f78" />
              <stop offset="1" stopColor="#193d48" />
            </linearGradient>
            <filter id="earth-blur"><feGaussianBlur stdDeviation="18" /></filter>
          </defs>
          <path className="earth-art__far" d="M0 570 C150 500 260 535 370 570 C510 615 625 535 760 560 C920 590 1040 515 1200 555 V800 H0Z" />
          <path className="earth-art__mountain" d="M0 640 L150 530 L245 620 L370 475 L520 625 L650 505 L790 625 L935 495 L1080 610 L1200 535 V800 H0Z" />
          <path className="earth-art__ground" d="M0 690 C180 645 310 700 450 665 C610 625 760 710 900 670 C1040 630 1120 665 1200 645 V800 H0Z" />
          <g className="earth-art__mist" filter="url(#earth-blur)">
            <ellipse cx="180" cy="600" rx="210" ry="42" />
            <ellipse cx="760" cy="635" rx="260" ry="48" />
            <ellipse cx="1060" cy="580" rx="180" ry="36" />
          </g>
          <g className="earth-art__birds">
            <path d="M170 300 q12 -10 24 0 q12 -10 24 0" />
            <path d="M820 260 q10 -8 20 0 q10 -8 20 0" />
            <path d="M930 345 q8 -7 16 0 q8 -7 16 0" />
          </g>
        </svg>
      ) : (
        <svg className="game-atmosphere__space-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="space-planet" cx="32%" cy="28%">
              <stop offset="0" stopColor="#dff8ff" />
              <stop offset=".16" stopColor="#71d1ef" />
              <stop offset=".48" stopColor="#287db4" />
              <stop offset=".78" stopColor="#102f5b" />
              <stop offset="1" stopColor="#020815" />
            </radialGradient>
            <linearGradient id="space-ring" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="transparent" />
              <stop offset=".2" stopColor="#b8dcff" stopOpacity=".18" />
              <stop offset=".5" stopColor="#e5f3ff" stopOpacity=".75" />
              <stop offset=".8" stopColor="#9bc8ef" stopOpacity=".24" />
              <stop offset="1" stopColor="transparent" />
            </linearGradient>
            <filter id="space-glow"><feGaussianBlur stdDeviation="26" /></filter>
          </defs>
          <ellipse className="space-art__nebula-a" cx="250" cy="420" rx="260" ry="145" filter="url(#space-glow)" />
          <ellipse className="space-art__nebula-b" cx="870" cy="220" rx="300" ry="180" filter="url(#space-glow)" />
          <ellipse className="space-art__planet-glow" cx="950" cy="250" rx="185" ry="185" filter="url(#space-glow)" />
          <g className="space-art__planet-wrap">
            <ellipse className="space-art__ring-back" cx="950" cy="250" rx="210" ry="58" />
            <circle className="space-art__planet" cx="950" cy="250" r="128" />
            <ellipse className="space-art__ring-front" cx="950" cy="250" rx="210" ry="58" />
          </g>
          <g className="space-art__constellation">
            <path d="M130 160 L220 105 L315 150 L390 82" />
            <circle cx="130" cy="160" r="4" /><circle cx="220" cy="105" r="3" /><circle cx="315" cy="150" r="4" /><circle cx="390" cy="82" r="3" />
          </g>
        </svg>
      )}

      <div className="game-atmosphere__clouds"><i /><i /><i /></div>
      <div className="game-atmosphere__stars" />
      <div className="game-atmosphere__moon" />
      <div className="game-atmosphere__sun" />
      <div className="game-atmosphere__nebula" />
      <div className="game-atmosphere__glow" />
      <div className="game-atmosphere__vignette" />
      <div className="game-atmosphere__rain" />
      <div className="game-atmosphere__meteors"><i /><i /><i /></div>
    </div>
  );
}
