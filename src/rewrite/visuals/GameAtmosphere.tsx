import { getTimeOfDay, type MapType } from "../domain";

interface GameAtmosphereProps {
  map: MapType;
  round: number;
  overlay?: boolean;
}

/** Pure visual layer; never participates in Canvas drawing coordinates. */
export default function GameAtmosphere({ map, round, overlay = false }: GameAtmosphereProps) {
  const time = getTimeOfDay(round);
  const progressed = round >= 2;

  return (
    <div className={`game-atmosphere game-atmosphere--${map} game-atmosphere--${time} ${progressed ? "game-atmosphere--progressed" : ""} ${overlay ? "game-atmosphere--overlay" : ""}`} aria-hidden="true">
      <div className="game-atmosphere__sky" />
      <div className="game-atmosphere__haze" />
      <div className="game-atmosphere__stars" />
      <div className="game-atmosphere__body" />
      <div className="game-atmosphere__glow" />
      <div className="game-atmosphere__vignette" />
      <div className="game-atmosphere__rain" />
      <div className="game-atmosphere__meteors"><i /><i /><i /><i /></div>
    </div>
  );
}
