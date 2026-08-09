import { useState } from 'react';
import Button from '../Shared/Button';
import PngIcon from '../Shared/PngIcon';
import { useAuth } from '../../contexts/AuthContext';
import { AVATAR_ICONS, AVATAR_LABELS } from './CharacterCard';
import './CharacterCreator.css';

const AVATAR_TYPES = Object.keys(AVATAR_ICONS);

interface CharacterCreatorProps {
  onCreate: (data: { nickname: string; avatar_type: string; avatar_color: string; personality?: string; age_group: '4-7' | '8-12' }) => Promise<void>;
}

export default function CharacterCreator({ onCreate }: CharacterCreatorProps) {
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [avatarType, setAvatarType] = useState(AVATAR_TYPES[0]);
  const [customAvatarType, setCustomAvatarType] = useState('');
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [personality, setPersonality] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getEffectiveAvatarType(): string {
    return isCustomAvatar ? customAvatarType.trim() : avatarType;
  }

  function getPreviewLabel(): string {
    if (isCustomAvatar) return customAvatarType.trim() || '自定义形象';
    return AVATAR_LABELS[avatarType] || avatarType;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!nickname.trim()) {
      setError('给你的角色取个名字吧！');
      return;
    }
    if (user?.age_group !== '4-7' && user?.age_group !== '8-12') {
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
        avatar_color: '#FF8C42',
        personality: personality.trim() || undefined,
        age_group: user.age_group,
      });
      setNickname('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="character-creator" onSubmit={handleSubmit}>
      <h3 className="creator-title">创建一个新角色</h3>

      <div className="creator-field">
        <label>角色昵称</label>
        <input
          type="text" value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="给你的角色取个名字" maxLength={20}
        />
      </div>

      <div className="creator-field">
        <label>选择形象</label>
        <div className="avatar-grid">
          {AVATAR_TYPES.map((type) => (
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
          onChange={(e) => setPersonality(e.target.value)}
          placeholder="例如：一位善良勇敢的小精灵、一只来自未来的机器猫" maxLength={100}
        />
      </div>

      <div className="creator-preview">
        <span className="preview-emoji"><PngIcon name={isCustomAvatar ? 'theme-hero' : AVATAR_ICONS[avatarType]} size={74} /></span>
        <div className="preview-info">
          <span className="preview-name">{nickname || '你的角色'}</span>
          <span className="preview-type">{getPreviewLabel()}</span>
        </div>
      </div>

      {error && <p className="creator-error">{error}</p>}

      <Button type="submit" variant="primary" size="lg" disabled={loading}>
        {loading ? '创建中...' : '创建角色'}
      </Button>
    </form>
  );
}
