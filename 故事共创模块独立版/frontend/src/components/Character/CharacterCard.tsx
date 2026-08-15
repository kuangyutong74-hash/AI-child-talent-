import type { Character } from '../../api/endpoints';
import { AGE_GROUP_LABELS, type AgeGroup } from '../../contexts/ChannelContext';
import PngIcon, { type StoryPngIconName } from '../Shared/PngIcon';
import './CharacterCard.css';

interface CharacterCardProps {
  character: Character;
  onSelect?: (character: Character) => void;
  onDelete?: (character: Character) => void;
  selected?: boolean;
}

const AVATAR_ICONS: Record<string, StoryPngIconName> = {
  astronaut: 'avatar-astronaut',
  dragon: 'avatar-dragon',
  fairy: 'avatar-fairy',
  pirate: 'avatar-pirate',
  robot: 'avatar-robot',
  explorer: 'avatar-explorer',
  wizard: 'avatar-wizard',
  mermaid: 'avatar-mermaid',
};

const AVATAR_LABELS: Record<string, string> = {
  astronaut: '小宇航员',
  dragon: '小龙',
  fairy: '小精灵',
  pirate: '小海盗',
  robot: '机器人',
  explorer: '探险家',
  wizard: '小巫师',
  mermaid: '美人鱼',
};

/** "2026-08-12T11:39:55" → "2026-08-12" */
function formatDate(iso: string | null): string {
  if (!iso) return '未知时间';
  const datePart = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '未知时间';
}

function ageGroupChipClass(ageGroup: string | null): string {
  return ageGroup === '4-7' ? 'age-chip-young' : 'age-chip-older';
}

export default function CharacterCard({ character, onSelect, onDelete, selected }: CharacterCardProps) {
  const icon = AVATAR_ICONS[character.avatar_type] || 'child-explorer';
  const label = AVATAR_LABELS[character.avatar_type] || character.avatar_type;
  const ageGroup = (character.age_group === '4-7' || character.age_group === '8-12')
    ? (character.age_group as AgeGroup)
    : null;
  const storyTitles = character.story_titles ?? [];

  return (
    <div
      className={`character-card ${selected ? 'character-card-selected' : ''}`}
      onClick={() => onSelect?.(character)}
      style={{ borderColor: selected ? character.avatar_color : undefined }}
    >
      <div className="character-avatar" style={{ backgroundColor: character.avatar_color + '33' }}>
        <span className="character-emoji"><PngIcon name={icon} size={72} /></span>
      </div>
      <div className="character-info">
        <h3 className="character-nickname">{character.nickname}</h3>
        <span className="character-type">{label}</span>
        <div className="character-meta">
          {ageGroup ? (
            <span className={`age-chip ${ageGroupChipClass(character.age_group)}`} title="角色所属年龄段通道">
              {AGE_GROUP_LABELS[ageGroup]}
            </span>
          ) : (
            <span className="age-chip age-chip-none">未标注年龄段</span>
          )}
          <span className="time-chip" title="角色创建时间">🕐 {formatDate(character.created_at)}</span>
        </div>
        <div className="character-stories">
          {storyTitles.length === 0 ? (
            <span className="story-chip story-chip-empty">还没有创作故事</span>
          ) : (
            storyTitles.map((title) => (
              <span key={title} className="story-chip" title={`故事：${title}`}>📖 {title}</span>
            ))
          )}
        </div>
      </div>
      {onDelete && (
        <button
          className="character-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(character);
          }}
          title="删除角色"
        >
          <PngIcon name="action-delete" size={23} />
        </button>
      )}
    </div>
  );
}

export { AVATAR_ICONS, AVATAR_LABELS };
