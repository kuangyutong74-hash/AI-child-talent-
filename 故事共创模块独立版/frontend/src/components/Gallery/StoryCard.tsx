import type { Story } from '../../api/endpoints';
import PngIcon, { type StoryPngIconName } from '../Shared/PngIcon';
import './StoryCard.css';

interface StoryCardProps {
  story: Story;
  onClick: (story: Story) => void;
}

const STATUS_MAP: Record<string, { label: string; icon: StoryPngIconName }> = {
  active: { label: '创作中', icon: 'action-write' },
  completed: { label: '已完成', icon: 'story-book' },
  abandoned: { label: '已搁置', icon: 'story-book' },
};

export default function StoryCard({ story, onClick }: StoryCardProps) {
  const statusInfo = STATUS_MAP[story.status] || STATUS_MAP.active;
  const preview = story.full_text
    ? story.full_text.slice(0, 100) + '...'
    : '一个关于' + (story.theme || '冒险') + '的故事...';

  return (
    <div className="story-card animate-fade-in" onClick={() => onClick(story)}>
      <div className="story-card-cover">
        <PngIcon name={story.status === 'completed' ? 'celebration' : 'story-book'} size={62} />
      </div>
      <div className="story-card-body">
        <h4 className="story-card-title">{story.title || story.theme || '未命名故事'}</h4>
        <p className="story-card-preview">{preview}</p>
        <div className="story-card-meta">
          <span className="story-card-status">
            <PngIcon name={statusInfo.icon} size={20} /> {statusInfo.label}
          </span>
          <span className="story-card-turns">共 {story.turn_count} 轮</span>
        </div>
      </div>
    </div>
  );
}
