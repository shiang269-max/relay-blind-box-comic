import { getTimeOfDay, type MapType } from "../domain";

interface GameAtmosphereProps {
  map: MapType;
  round: number;
}

/**
 * 遊戲世界的純視覺層。
 *
 * 不參與 Canvas、Camera 或繪圖座標計算；
 * 僅根據地圖與目前回合提供背景環境動畫。
 */
export default function GameAtmosphere({
  map,
  round,
}: GameAtmosphereProps) {
  const time = getTimeOfDay(round);

  return (
    <div
      className={`game-atmosphere game-atmosphere--${map} game-atmosphere--${time}`}
      aria-hidden="true"
    >
      <div className="game-atmosphere__sky" />
      <div className="game-atmosphere__haze" />
      <div className="game-atmosphere__stars" />
      <div className="game-atmosphere__body" />
      <div className="game-atmosphere__glow" />
      <div className="game-atmosphere__vignette" />
    </div>
  );
}
