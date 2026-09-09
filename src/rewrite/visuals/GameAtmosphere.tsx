import { getTimeOfDay, getWorldTimeProgress, type MapType } from "../domain";

interface GameAtmosphereProps {
  map: MapType;
  round: number;
  overlay?: boolean;
}

const EARTH_TIME_STOPS = [
  { at: 0, top: "#9cc9d2", mid: "#c8d9d2", bottom: "#718a82" },
  { at: 0.2, top: "#9fcfdf", mid: "#d4dfd8", bottom: "#7f958b" },
  { at: 0.4, top: "#a7d1d2", mid: "#d7ddd2", bottom: "#83958a" },
  { at: 0.58, top: "#d6b6a1", mid: "#d8b2a0", bottom: "#706776" },
  { at: 0.76, top: "#5b7294", mid: "#394e6b", bottom: "#1b293d" },
  { at: 1, top: "#172844", mid: "#0d182b", bottom: "#050a12" },
];

const RAIN_PARTICLES = Array.from({ length: 34 }, (_, index) => ({
  left: `${(index * 37) % 109 - 4}%`,
  top: `${-18 - ((index * 23) % 72)}%`,
  height: `${16 + ((index * 11) % 15)}px`,
  duration: `${1.55 + ((index * 17) % 90) / 100}s`,
  delay: `${-((index * 29) % 170) / 100}s`,
  opacity: `${0.12 + ((index * 13) % 18) / 100}`,
  drift: `${12 + ((index * 7) % 18)}px`,
}));

function mixColor(from: string, to: string, amount: number): string {
  const a = from.match(/[\da-f]{2}/gi);
  const b = to.match(/[\da-f]{2}/gi);
  if (!a || !b) return from;
  const channels = a.map((value, index) => Math.round(parseInt(value, 16) + (parseInt(b[index], 16) - parseInt(value, 16)) * amount));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function getEarthSky(progress: number): { top: string; mid: string; bottom: string } {
  const clamped = Math.max(0, Math.min(1, progress));
  for (let index = 1; index < EARTH_TIME_STOPS.length; index += 1) {
    const next = EARTH_TIME_STOPS[index];
    const previous = EARTH_TIME_STOPS[index - 1];
    if (clamped <= next.at) {
      const span = next.at - previous.at || 1;
      const amount = (clamped - previous.at) / span;
      return {
        top: mixColor(previous.top, next.top, amount),
        mid: mixColor(previous.mid, next.mid, amount),
        bottom: mixColor(previous.bottom, next.bottom, amount),
      };
    }
  }
  return EARTH_TIME_STOPS[EARTH_TIME_STOPS.length - 1];
}

/** Decorative atmosphere only. It never participates in canvas input or drawing coordinates. */
export default function GameAtmosphere({ map, round, overlay = false }: GameAtmosphereProps) {
  const time = getTimeOfDay(round);
  const worldTime = getWorldTimeProgress(round);
  const progressed = round >= 2;
  const earthSky = getEarthSky(worldTime);
  const rainStrength = map === "earth" ? Math.max(0, Math.min(1, (worldTime - 0.2) / 0.35)) : 0;
  const earthFilter = worldTime > 0.62 ? `brightness(${1 - (worldTime - 0.62) * 0.48}) saturate(${1 - (worldTime - 0.62) * 0.22})` : undefined;

  return (
    <div className={`game-atmosphere game-atmosphere--${map} game-atmosphere--${time} ${progressed ? "game-atmosphere--progressed" : ""} ${overlay ? "game-atmosphere--overlay" : ""}`} aria-hidden="true">
      <style>{`
        .game-atmosphere__rain-particle {
          position: absolute;
          display: block;
          width: 1px;
          border-radius: 999px;
          background: linear-gradient(180deg, transparent, rgba(232,247,255,.72) 38%, rgba(196,229,241,.2));
          transform: translate3d(0, 0, 0) rotate(11deg);
          animation: real-rain-fall var(--rain-duration) linear var(--rain-delay) infinite;
          opacity: var(--rain-opacity);
          filter: blur(.15px);
          will-change: transform;
        }
        @keyframes real-rain-fall {
          0% { transform: translate3d(0, -12vh, 0) rotate(11deg); }
          100% { transform: translate3d(var(--rain-drift), 125vh, 0) rotate(11deg); }
        }
      `}</style>
      <div className="game-atmosphere__sky" style={map === "earth" ? { background: `linear-gradient(180deg, ${earthSky.top} 0%, ${earthSky.mid} 48%, ${earthSky.bottom} 100%)`, transition: "background 5s ease" } : undefined} />
      <div className="game-atmosphere__horizon" />
      {map === "earth" ? (
        <svg className="game-atmosphere__earth-art" style={{ filter: earthFilter }} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
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
      {map === "earth" && rainStrength > 0 ? (
        <div className="game-atmosphere__rain" style={{ opacity: 0.12 * rainStrength }}>
          {RAIN_PARTICLES.map((particle, index) => (
            <i
              key={index}
              className="game-atmosphere__rain-particle"
              style={{
                left: particle.left,
                top: particle.top,
                height: particle.height,
                ["--rain-duration" as string]: particle.duration,
                ["--rain-delay" as string]: particle.delay,
                ["--rain-opacity" as string]: particle.opacity,
                ["--rain-drift" as string]: particle.drift,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="game-atmosphere__meteors"><i /><i /><i /></div>
    </div>
  );
}
