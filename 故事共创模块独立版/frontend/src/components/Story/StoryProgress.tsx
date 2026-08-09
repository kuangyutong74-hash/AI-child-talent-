import './StoryProgress.css';
import PngIcon from '../Shared/PngIcon';

interface StoryProgressProps {
  turn: number;
  maxTurns: number;
  isEnding?: boolean;
}

export default function StoryProgress({ turn, maxTurns, isEnding }: StoryProgressProps) {
  const percent = Math.min((turn / maxTurns) * 100, 100);

  return (
    <div className="story-progress">
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${isEnding ? 'progress-bar-ending' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="progress-label">
        {isEnding ? <><PngIcon name="celebration" size={24} /> 故事即将结尾！</> : `第 ${turn} / ${maxTurns} 回合`}
      </span>
    </div>
  );
}
