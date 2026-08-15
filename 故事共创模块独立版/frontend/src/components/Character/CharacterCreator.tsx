import { useEffect, useState } from 'react';
import Button from '../Shared/Button';
import PngIcon from '../Shared/PngIcon';
import { AGE_GROUP_LABELS, useChannel, type AgeGroup } from '../../contexts/ChannelContext';
import { AVATAR_ICONS, AVATAR_LABELS } from './CharacterCard';
import { AGE_PROFILES, AVATAR_COLORS, AVATAR_COLOR_NAMES, type CharacterPreset } from '../../data/ageProfiles';
import './CharacterCreator.css';

const ALL_AVATAR_TYPES = Object.keys(AVATAR_ICONS);

interface CharacterCreatorProps {
  onCreate: (data: { nickname: string; avatar_type: string; avatar_color: string; personality?: string; age_group: AgeGroup }) => Promise<void>;
}

export default function CharacterCreator({ onCreate }: CharacterCreatorProps) {
  const { ageGroup } = useChannel();
  const [nickname, setNickname] = useState('');
  const [avatarType, setAvatarType] = useState(ALL_AVATAR_TYPES[0]);
  const [customAvatarType, setCustomAvatarType] = useState('');
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [personality, setPersonality] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [presetName, setPresetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const profile = ageGroup ? AGE_PROFILES[ageGroup] : null;
  const avatarTypes = profile ? profile.avatarTypes : ALL_AVATAR_TYPES;

  // 切换年龄段通道时，重置为当前通道的默认形象
  useEffect(() => {
    if (profile && !profile.avatarTypes.includes(avatarType) && !isCustomAvatar) {
      setAvatarType(profile.avatarTypes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup]);

  function getEffectiveAvatarType(): string {
    return isCustomAvatar ? customAvatarType.trim() : avatarType;
  }

  function getPreviewLabel(): string {
    if (isCustomAvatar) return customAvatarType.trim() || '自定义形象';
    return AVATAR_LABELS[avatarType] || avatarType;
  }

  // 起名灵感只填入「昵称 + 人设」，不触碰形象与颜色 —— 名字和形象自由搭配
  function applyPreset(preset: CharacterPreset) {
    setPresetName(preset.name);
    setNickname(preset.name);
    setPersonality(preset.personality);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!nickname.trim()) {
      setError('给你的角色取个名字吧！');
      return;
    }
    if (!ageGroup) {
      setError('请先选择 4-7 岁或 8-12 岁创作通道');
      return;
    }
    if (isCustomAvatar && !customAvatarType.trim()) {
      setError('请填写自定义形象哦~');
      return;
    }
    setLoading(true);
    try {
      await onCreate({
        nickname: nickname.trim(),
        avatar_type: getEffectiveAvatarType(),
        avatar_color: color,
        personality: personality.trim() || undefined,
        age_group: ageGroup,
      });
      setNickname('');
      setPersonality('');
      setPresetName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  }

  if (!ageGroup || !profile) {
    return (
      <form className="character-creator" onSubmit={handleSubmit}>
        <h3 className="creator-title">创建一个新角色</h3>
        <p className="creator-error">请先选择 4-7 岁或 8-12 岁创作通道</p>
      </form>
    );
  }

  return (
    <form className="character-creator" onSubmit={handleSubmit}>
      <h3 className="creator-title">创建一个新角色</h3>

      <div className="creator-channel-note">
        <PngIcon name="child-explorer" size={24} />
        <span>当前通道：{AGE_GROUP_LABELS[ageGroup]}</span>
      </div>

      {/* 起名灵感（纯文字标签，只填名字和人设，形象自由搭配） */}
      <div className="creator-field">
        <label>起名灵感（点击填入名字和人设）</label>
        <div className="preset-grid">
          {profile.characterPresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={`preset-option ${presetName === preset.name ? 'preset-option-selected' : ''}`}
              onClick={() => applyPreset(preset)}
              title={preset.personality}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <label>角色昵称</label>
        <input
          type="text" value={nickname}
          onChange={(e) => { setNickname(e.target.value); setPresetName(''); }}
          placeholder="给你的角色取个名字" maxLength={20}
        />
      </div>

      <div className="creator-field">
        <label>选择形象</label>
        <p className="avatar-note">{profile.avatarNote}</p>
        <div className="avatar-grid">
          {avatarTypes.map((type) => (
            <button key={type} type="button"
              className={`avatar-option ${!isCustomAvatar && avatarType === type ? 'avatar-option-selected' : ''}`}
              onClick={() => { setIsCustomAvatar(false); setAvatarType(type); }}
              title={AVATAR_LABELS[type]}
            >
              <span className="avatar-option-emoji"><PngIcon name={AVATAR_ICONS[type]} size={54} /></span>
              <span className="avatar-option-label">{AVATAR_LABELS[type]}</span>
            </button>
          ))}
          <button type="button"
            className={`avatar-option avatar-option-custom ${isCustomAvatar ? 'avatar-option-selected' : ''}`}
            onClick={() => setIsCustomAvatar(true)} title="自定义形象"
          >
            <span className="avatar-option-emoji">?</span>
            <span className="avatar-option-label">自定义</span>
          </button>
        </div>
        {isCustomAvatar && (
          <input type="text" className="custom-avatar-input"
            value={customAvatarType} onChange={(e) => setCustomAvatarType(e.target.value)}
            placeholder="输入你的角色形象，例如：一只会飞的小海豚" maxLength={30} autoFocus
          />
        )}
      </div>

      <div className="creator-field">
        <label>角色人设（可选）</label>
        <input type="text" value={personality}
          onChange={(e) => { setPersonality(e.target.value); setPresetName(''); }}
          placeholder="例如：一位善良勇敢的小精灵、一只来自未来的机器猫" maxLength={100}
        />
        <div className="personality-presets">
          {profile.personalityPresets.map((text) => (
            <button
              key={text}
              type="button"
              className={`personality-chip ${personality === text ? 'personality-chip-selected' : ''}`}
              onClick={() => setPersonality(text)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <label>角色颜色（当前：{AVATAR_COLOR_NAMES[color] ?? color}）</label>
        <div className="color-row">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-dot ${color === c ? 'color-dot-selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`颜色 ${AVATAR_COLOR_NAMES[c] ?? c}`}
            />
          ))}
        </div>
      </div>

      <div className="creator-preview">
        <span className="preview-emoji" style={{ backgroundColor: color + '2E', borderColor: color }}>
          <PngIcon name={isCustomAvatar ? 'theme-hero' : (AVATAR_ICONS[avatarType] || 'child-explorer')} size={74} />
        </span>
        <div className="preview-info">
          <span className="preview-name">{nickname || '你的角色'}</span>
          <span className="preview-type">{getPreviewLabel()}</span>
          <span className="preview-color">颜色：{AVATAR_COLOR_NAMES[color] ?? color}</span>
        </div>
      </div>

      {error && <p className="creator-error">{error}</p>}

      <Button type="submit" variant="primary" size="lg" disabled={loading}>
        {loading ? '创建中...' : '创建角色'}
      </Button>
    </form>
  );
}
