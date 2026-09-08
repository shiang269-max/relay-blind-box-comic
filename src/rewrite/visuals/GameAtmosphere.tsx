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
            <linearGradient id="earth-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6f9d91" /><stop offset="1" stopColor="#315c5b" /></linearGradient>
            <linearGradient id="earth-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#527d6d" /><stop offset="1" stopColor="#244b4d" /></linearGradient>
            <linearGradient id="earth-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fa77e" /><stop offset="1" stopColor="#183c3e" /></linearGradient>
            <linearGradient id="earth-water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8e5e2" stopOpacity=".9" /><stop offset="1" stopColor="#3d8790" stopOpacity=".25" /></linearGradient>
            <radialGradient id="earth-sun"><stop offset="0" stopColor="#fffdf0" stopOpacity="1" /><stop offset=".18" stopColor="#ffe9a8" stopOpacity=".86" /><stop offset=".5" stopColor="#ffc978" stopOpacity=".2" /><stop offset="1" stopColor="#ffc978" stopOpacity="0" /></radialGradient>
            <linearGradient id="earth-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b4" stopOpacity=".18" /><stop offset="1" stopColor="#fff0b4" stopOpacity="0" /></linearGradient>
            <filter id="earth-blur"><feGaussianBlur stdDeviation="18" /></filter>
            <filter id="earth-soft"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          <g className="earth-art__sun"><circle cx="930" cy="125" r="120" fill="url(#earth-sun)" /><circle cx="930" cy="125" r="34" fill="#fff8d6" /></g>
          <g className="earth-art__rays"><path d="M895 140 L650 610 L720 630 L950 155Z" fill="url(#earth-ray)" /><path d="M960 150 L820 630 L885 630 L1000 155Z" fill="url(#earth-ray)" /></g>
          <path className="earth-art__far" d="M0 570 C90 530 160 540 245 575 C340 615 430 520 525 565 C635 618 720 535 820 566 C940 602 1050 525 1200 555 V800 H0Z" fill="url(#earth-far)" />
          <path className="earth-art__far-snow" d="M250 575 L330 518 L392 565 L525 565 L585 530 L645 575" fill="none" />
          <path className="earth-art__mid" d="M0 650 L120 565 L205 620 L300 495 L405 620 L505 540 L610 635 L730 505 L850 625 L965 520 L1080 610 L1200 545 V800 H0Z" fill="url(#earth-mid)" />
          <path className="earth-art__mid-light" d="M120 565 L205 620 L300 495 L405 620 M505 540 L610 635 M730 505 L850 625 M965 520 L1080 610" fill="none" />
          <path className="earth-art__front" d="M0 704 C145 660 260 722 390 685 C540 640 655 735 790 690 C930 644 1040 694 1200 660 V800 H0Z" fill="url(#earth-front)" />
          <path className="earth-art__river" d="M735 800 C710 758 760 718 815 690 C855 670 875 640 858 606 C900 642 930 680 898 720 C865 762 855 782 870 800Z" fill="url(#earth-water)" />
          <g className="earth-art__trees">
            <path d="M90 720 l24 -65 l24 65z" /><path d="M125 730 l30 -82 l30 82z" /><path d="M1060 705 l25 -72 l25 72z" /><path d="M1100 720 l32 -88 l32 88z" /><path d="M1150 730 l22 -62 l22 62z" />
          </g>
          <g className="earth-art__mist" filter="url(#earth-blur)"><ellipse cx="180" cy="625" rx="220" ry="34" /><ellipse cx="520" cy="650" rx="300" ry="38" /><ellipse cx="920" cy="625" rx="300" ry="34" /></g>
          <g className="earth-art__birds"><path d="M170 285 q14 -12 28 0 q14 -12 28 0" /><path d="M290 345 q10 -8 20 0 q10 -8 20 0" /><path d="M785 255 q10 -8 20 0 q10 -8 20 0" /></g>
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
