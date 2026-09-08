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
    <div className={`game-atmosphere game-atmosphere--${map} game-atmosphere--${time} ${progressed ? "game-atmosphere--progressed" : ""} ${overlay ? "game-atmosphere--overlay" : ""}`} aria-hidden="true">
      <div className="game-atmosphere__sky" />
      <div className="game-atmosphere__horizon" />
      {map === "earth" ? (
        <svg className="game-atmosphere__earth-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="earth-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9ad7c9" /><stop offset=".45" stopColor="#4f8f84" /><stop offset="1" stopColor="#173b47" /></linearGradient>
            <linearGradient id="earth-mountain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#718f86" /><stop offset=".5" stopColor="#385f60" /><stop offset="1" stopColor="#173844" /></linearGradient>
            <linearGradient id="earth-ridge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8e1d2" stopOpacity=".75" /><stop offset=".55" stopColor="#6aa99b" stopOpacity=".3" /><stop offset="1" stopColor="#214d55" stopOpacity="0" /></linearGradient>
            <radialGradient id="earth-light"><stop offset="0" stopColor="#fff8d7" stopOpacity=".95" /><stop offset=".42" stopColor="#ffd78b" stopOpacity=".22" /><stop offset="1" stopColor="#ffd78b" stopOpacity="0" /></radialGradient>
            <filter id="earth-soft"><feGaussianBlur stdDeviation="14" /></filter>
            <filter id="earth-wide"><feGaussianBlur stdDeviation="30" /></filter>
          </defs>
          <ellipse className="earth-art__light" cx="940" cy="135" rx="290" ry="230" fill="url(#earth-light)" />
          <path className="earth-art__far" d="M0 585 C120 530 220 540 330 580 C450 622 565 548 690 576 C830 607 970 525 1200 565 V800 H0Z" />
          <path className="earth-art__mountain" d="M0 650 L128 548 L220 616 L356 448 L520 622 L642 510 L790 630 L928 472 L1088 604 L1200 532 V800 H0Z" />
          <path className="earth-art__ridge" d="M356 448 L520 622 L642 510 L790 630 L928 472 L1088 604" fill="none" />
          <path className="earth-art__ground" d="M0 700 C155 658 298 714 450 672 C608 628 748 718 900 676 C1045 636 1130 664 1200 650 V800 H0Z" />
          <g className="earth-art__terrain-lines" fill="none"><path d="M90 720 C230 685 310 728 420 696" /><path d="M720 704 C835 670 930 694 1055 662" /><path d="M850 760 C960 720 1080 744 1170 710" /></g>
          <g className="earth-art__mist" filter="url(#earth-soft)"><ellipse cx="170" cy="610" rx="230" ry="38" /><ellipse cx="500" cy="650" rx="280" ry="46" /><ellipse cx="820" cy="620" rx="270" ry="42" /><ellipse cx="1080" cy="600" rx="180" ry="34" /></g>
          <g className="earth-art__sun-rays" filter="url(#earth-wide)"><path d="M870 60 L1030 60 L820 500 L760 500 Z" /><path d="M1040 90 L1120 140 L920 500 L850 480 Z" /></g>
          <g className="earth-art__birds"><path d="M155 285 q13 -11 26 0 q13 -11 26 0" /><path d="M250 350 q10 -8 20 0 q10 -8 20 0" /><path d="M835 265 q10 -8 20 0 q10 -8 20 0" /><path d="M945 330 q8 -7 16 0 q8 -7 16 0" /></g>
        </svg>
      ) : (
        <svg className="game-atmosphere__space-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="space-planet" cx="30%" cy="25%"><stop offset="0" stopColor="#f4fdff" /><stop offset=".12" stopColor="#a5e7f7" /><stop offset=".34" stopColor="#4ca9d1" /><stop offset=".58" stopColor="#215c9a" /><stop offset=".82" stopColor="#0c254f" /><stop offset="1" stopColor="#010511" /></radialGradient>
            <linearGradient id="space-ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8fc8ff" stopOpacity="0" /><stop offset=".2" stopColor="#b8dcff" stopOpacity=".18" /><stop offset=".48" stopColor="#f0f8ff" stopOpacity=".82" /><stop offset=".72" stopColor="#9bc8ef" stopOpacity=".3" /><stop offset="1" stopColor="#8fc8ff" stopOpacity="0" /></linearGradient>
            <radialGradient id="space-star-glow"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".35" stopColor="#9ed9ff" stopOpacity=".55" /><stop offset="1" stopColor="#9ed9ff" stopOpacity="0" /></radialGradient>
            <filter id="space-blur"><feGaussianBlur stdDeviation="24" /></filter>
            <filter id="space-soft"><feGaussianBlur stdDeviation="9" /></filter>
          </defs>
          <ellipse className="space-art__nebula-a" cx="240" cy="430" rx="300" ry="170" filter="url(#space-blur)" />
          <ellipse className="space-art__nebula-b" cx="770" cy="185" rx="330" ry="180" filter="url(#space-blur)" />
          <path className="space-art__nebula-ribbon" d="M-60 575 C190 430 330 590 505 445 S860 250 1260 380" fill="none" stroke="rgba(120,105,255,.18)" strokeWidth="110" filter="url(#space-blur)" />
          <g className="space-art__starscape"><circle cx="110" cy="105" r="3" /><circle cx="175" cy="225" r="2" /><circle cx="315" cy="92" r="4" /><circle cx="470" cy="180" r="2" /><circle cx="560" cy="95" r="3" /><circle cx="680" cy="300" r="2" /><circle cx="760" cy="105" r="4" /><circle cx="875" cy="365" r="2" /><circle cx="1060" cy="115" r="3" /><circle cx="1140" cy="290" r="2" /><circle cx="520" cy="560" r="3" /><circle cx="300" cy="680" r="2" /></g>
          <g className="space-art__star-glows"><circle cx="315" cy="92" r="22" fill="url(#space-star-glow)" /><circle cx="760" cy="105" r="25" fill="url(#space-star-glow)" /><circle cx="1060" cy="115" r="20" fill="url(#space-star-glow)" /></g>
          <g className="space-art__planet-wrap">
            <ellipse className="space-art__planet-glow" cx="930" cy="245" rx="190" ry="190" />
            <ellipse className="space-art__ring-back" cx="930" cy="245" rx="230" ry="64" />
            <circle className="space-art__planet" cx="930" cy="245" r="132" />
            <g className="space-art__planet-craters"><ellipse cx="870" cy="210" rx="24" ry="14" /><ellipse cx="950" cy="175" rx="18" ry="10" /><ellipse cx="1000" cy="270" rx="30" ry="16" /><ellipse cx="900" cy="315" rx="17" ry="9" /></g>
            <ellipse className="space-art__planet-shine" cx="895" cy="200" rx="58" ry="34" fill="rgba(255,255,255,.12)" filter="url(#space-soft)" />
            <ellipse className="space-art__ring-front" cx="930" cy="245" rx="230" ry="64" />
          </g>
          <g className="space-art__constellation"><path d="M115 180 L210 118 L300 160 L380 92 L470 140" /><circle cx="115" cy="180" r="5" /><circle cx="210" cy="118" r="3" /><circle cx="300" cy="160" r="4" /><circle cx="380" cy="92" r="3" /><circle cx="470" cy="140" r="4" /></g>
          <g className="space-art__debris"><circle cx="610" cy="590" r="5" /><circle cx="650" cy="625" r="3" /><circle cx="700" cy="575" r="4" /><circle cx="742" cy="620" r="2" /><circle cx="785" cy="595" r="3" /></g>
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
