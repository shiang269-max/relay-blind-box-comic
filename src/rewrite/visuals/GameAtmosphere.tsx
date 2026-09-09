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
            <linearGradient id="earth-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d9e2df" stopOpacity=".54" />
              <stop offset=".56" stopColor="#c9d5d0" stopOpacity=".34" />
              <stop offset=".78" stopColor="#aebdb6" stopOpacity=".22" />
              <stop offset="1" stopColor="#6c8079" stopOpacity=".18" />
            </linearGradient>
            <linearGradient id="earth-distant" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#81958f" stopOpacity=".58" />
              <stop offset="1" stopColor="#596c68" stopOpacity=".72" />
            </linearGradient>
            <linearGradient id="earth-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#667872" stopOpacity=".22" />
              <stop offset="1" stopColor="#354944" stopOpacity=".5" />
            </linearGradient>
            <radialGradient id="earth-light">
              <stop offset="0" stopColor="#fff8dc" stopOpacity=".72" />
              <stop offset=".28" stopColor="#f5e6bc" stopOpacity=".22" />
              <stop offset="1" stopColor="#f5e6bc" stopOpacity="0" />
            </radialGradient>
            <filter id="earth-soft"><feGaussianBlur stdDeviation="12" /></filter>
          </defs>

          {/* The sky stays visually open; the landscape begins very low on the horizon. */}
          <rect width="1200" height="800" fill="url(#earth-wash)" />
          <circle className="earth-art__sun" cx="930" cy="135" r="118" fill="url(#earth-light)" />

          <path className="earth-art__far" d="M0 602 C90 588 155 600 230 595 C320 588 372 552 445 578 C520 605 588 592 662 580 C744 566 805 586 874 574 C972 557 1056 580 1200 562 V800 H0Z" fill="url(#earth-distant)" />
          <path className="earth-art__mid" d="M0 653 C118 628 205 645 300 630 C400 614 480 635 570 622 C670 607 742 636 835 620 C940 602 1035 624 1200 610 V800 H0Z" fill="url(#earth-ground)" />
          <path className="earth-art__front" d="M0 716 C160 690 278 708 400 696 C555 681 668 709 810 694 C960 678 1070 700 1200 682 V800 H0Z" fill="rgba(45,62,58,.3)" />

          <path className="earth-art__mist" d="M0 610 C180 588 330 626 505 602 C680 578 820 615 1000 592 C1080 582 1140 586 1200 580" fill="none" stroke="rgba(236,241,236,.34)" strokeWidth="24" strokeLinecap="round" filter="url(#earth-soft)" />
          <path className="earth-art__mist" d="M0 648 C180 632 330 660 520 638 C700 617 870 651 1200 625" fill="none" stroke="rgba(231,239,234,.18)" strokeWidth="18" strokeLinecap="round" filter="url(#earth-soft)" />
          <path className="earth-art__horizon-line" d="M0 604 C180 588 340 608 520 596 C700 584 900 602 1200 574" fill="none" stroke="rgba(232,238,234,.26)" strokeWidth="3" />
        </svg>
      ) : (
        <svg className="game-atmosphere__space-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="space-planet" cx="28%" cy="22%"><stop offset="0" stopColor="#f4fdff" /><stop offset=".12" stopColor="#a9e8ff" /><stop offset=".34" stopColor="#4ea8d4" /><stop offset=".62" stopColor="#205a9b" /><stop offset=".84" stopColor="#0b2450" /><stop offset="1" stopColor="#010511" /></radialGradient>
            <radialGradient id="space-glow"><stop offset="0" stopColor="#86d8ff" stopOpacity=".4" /><stop offset="1" stopColor="#86d8ff" stopOpacity="0" /></radialGradient>
            <linearGradient id="space-ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8fc8ff" stopOpacity="0" /><stop offset=".22" stopColor="#b8dcff" stopOpacity=".22" /><stop offset=".5" stopColor="#f0f8ff" stopOpacity=".88" /><stop offset=".76" stopColor="#9bc8ef" stopOpacity=".24" /><stop offset="1" stopColor="#8fc8ff" stopOpacity="0" /></linearGradient>
            <filter id="space-blur"><feGaussianBlur stdDeviation="30" /></filter>
            <filter id="space-soft"><feGaussianBlur stdDeviation="8" /></filter>
          </defs>
          <g className="space-art__nebula-shapes" filter="url(#space-blur)"><ellipse cx="180" cy="440" rx="300" ry="145" /><ellipse cx="520" cy="240" rx="270" ry="130" /><ellipse cx="880" cy="600" rx="330" ry="170" /></g>
          <path className="space-art__nebula-ribbon" d="M-80 610 C180 430 320 610 500 455 S860 250 1280 390" fill="none" stroke="#7c6cff" strokeOpacity=".18" strokeWidth="105" filter="url(#space-blur)" />
          <g className="space-art__starfield">
            <circle cx="78" cy="118" r="2" /><circle cx="140" cy="255" r="1.5" /><circle cx="220" cy="88" r="3" /><circle cx="305" cy="180" r="1.5" /><circle cx="380" cy="105" r="2" /><circle cx="450" cy="300" r="1.5" /><circle cx="545" cy="82" r="2.5" /><circle cx="620" cy="170" r="1.5" /><circle cx="710" cy="95" r="3" /><circle cx="800" cy="330" r="1.5" /><circle cx="930" cy="100" r="2" /><circle cx="1080" cy="205" r="1.5" /><circle cx="1140" cy="410" r="2.5" /><circle cx="620" cy="575" r="2" /><circle cx="330" cy="650" r="1.5" /><circle cx="1040" cy="680" r="2" />
          </g>
          <g className="space-art__star-crosses"><path d="M220 88v28 M206 102h28" /><path d="M710 95v32 M694 111h32" /><path d="M930 100v24 M918 112h24" /></g>
          <g className="space-art__planet-wrap">
            <ellipse className="space-art__planet-glow" cx="930" cy="255" rx="220" ry="220" fill="url(#space-glow)" />
            <ellipse className="space-art__ring-back" cx="930" cy="255" rx="245" ry="67" />
            <circle className="space-art__planet" cx="930" cy="255" r="137" />
            <g className="space-art__planet-bands"><path d="M820 230 Q930 190 1045 225" /><path d="M810 290 Q930 255 1055 292" /><path d="M845 345 Q930 320 1015 340" /></g>
            <g className="space-art__planet-craters"><ellipse cx="860" cy="215" rx="25" ry="14" /><ellipse cx="955" cy="178" rx="18" ry="10" /><ellipse cx="1008" cy="278" rx="31" ry="16" /><ellipse cx="895" cy="320" rx="17" ry="9" /></g>
            <ellipse className="space-art__planet-shine" cx="885" cy="205" rx="58" ry="34" fill="rgba(255,255,255,.14)" filter="url(#space-soft)" />
            <ellipse className="space-art__ring-front" cx="930" cy="255" rx="245" ry="67" />
          </g>
          <g className="space-art__constellation"><path d="M110 190 L200 128 L300 165 L390 100 L480 148" /><circle cx="110" cy="190" r="5" /><circle cx="200" cy="128" r="3" /><circle cx="300" cy="165" r="4" /><circle cx="390" cy="100" r="3" /><circle cx="480" cy="148" r="4" /></g>
          <g className="space-art__debris"><circle cx="585" cy="610" r="5" /><circle cx="640" cy="650" r="3" /><circle cx="700" cy="600" r="4" /><circle cx="760" cy="655" r="2" /><circle cx="815" cy="620" r="3" /></g>
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
