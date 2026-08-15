import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listCharacters,
  createCharacter,
  deleteCharacter,
  createStory,
  type Character,
} from "../api/endpoints";
import CharacterCard from "../components/Character/CharacterCard";
import CharacterCreator from "../components/Character/CharacterCreator";
import Button from "../components/Shared/Button";
import Loading from "../components/Shared/Loading";
import PngIcon from "../components/Shared/PngIcon";
import { AGE_GROUP_LABELS, useChannel, type AgeGroup } from "../contexts/ChannelContext";
import { AGE_PROFILES } from "../data/ageProfiles";
import "./CharacterPage.css";

type AgeFilter = "all" | AgeGroup;

export default function CharacterPage() {
  const { ageGroup: channelAgeGroup } = useChannel();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [theme, setTheme] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadCharacters();
  }, []);

  // 选中角色切换时，重置故事主题选择
  useEffect(() => {
    setTheme("");
    setCustomTheme("");
    setError("");
  }, [selectedChar?.id]);

  async function loadCharacters() {
    try {
      const chars = await listCharacters();
      setCharacters(chars);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: {
    nickname: string;
    avatar_type: string;
    avatar_color: string;
    personality?: string;
    age_group: AgeGroup;
  }) {
    const newChar = await createCharacter(data);
    setCharacters((prev) => [...prev, newChar]);
    // 创建后自动选中新角色，右侧立刻出现「开始故事」卡片，无需再手动点击
    setSelectedChar(newChar);
    // 若当前筛选的是其他年龄段，切到新角色所属年龄段，保证左侧列表可见
    if (
      ageFilter !== "all" &&
      (newChar.age_group === "4-7" || newChar.age_group === "8-12") &&
      ageFilter !== newChar.age_group
    ) {
      setAgeFilter(newChar.age_group);
    }
  }

  async function handleDelete(character: Character) {
    if (
      !confirm(
        `确定要删除角色"${character.nickname}"吗？相关的故事也会被删除哦！`,
      )
    )
      return;
    await deleteCharacter(character.id);
    setCharacters((prev) => prev.filter((c) => c.id !== character.id));
    if (selectedChar?.id === character.id) {
      setSelectedChar(null);
    }
  }

  async function handleStartStory() {
    if (!selectedChar) return;
    const isCustomTheme = theme === "__custom__";
    if (isCustomTheme && !customTheme.trim()) {
      setError("请填写自定义主题哦~");
      return;
    }
    setStarting(true);
    setError("");
    try {
      const effectiveTheme = isCustomTheme
        ? customTheme.trim()
        : theme || undefined;
      const story = await createStory({
        character_id: selectedChar.id,
        theme: effectiveTheme,
        title: storyTitle.trim() || undefined,
      });
      navigate(`/story-create/play/${story.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建故事失败");
    } finally {
      setStarting(false);
    }
  }

  // 选中角色所属年龄段 → 对应主题选项；未标注年龄段时回退到当前通道
  const selectedAgeGroup: AgeGroup | null =
    selectedChar?.age_group === "4-7" || selectedChar?.age_group === "8-12"
      ? (selectedChar.age_group as AgeGroup)
      : channelAgeGroup;
  const themes = useMemo(
    () => (selectedAgeGroup ? AGE_PROFILES[selectedAgeGroup].themes : []),
    [selectedAgeGroup],
  );

  const filteredCharacters = useMemo(() => {
    if (ageFilter === "all") return characters;
    return characters.filter((c) => c.age_group === ageFilter);
  }, [characters, ageFilter]);

  if (loading) return <Loading text="加载角色中..." />;

  return (
    <div className="character-page page">
      <div className="character-layout">
        {/* Left: Character list */}
        <div className="character-section">
          <h2 className="section-title"> 我的角色</h2>

          {/* 年龄段筛选 */}
          <div className="age-filter-row">
            <button
              className={`age-filter-btn ${ageFilter === "all" ? "age-filter-btn-active" : ""}`}
              onClick={() => setAgeFilter("all")}
            >
              全部（{characters.length}）
            </button>
            {(["4-7", "8-12"] as const).map((group) => (
              <button
                key={group}
                className={`age-filter-btn age-filter-btn-${group} ${ageFilter === group ? "age-filter-btn-active" : ""}`}
                onClick={() => setAgeFilter(group)}
              >
                {AGE_GROUP_LABELS[group]}
              </button>
            ))}
          </div>

          {filteredCharacters.length === 0 ? (
            <div className="character-empty">
              <PngIcon name="avatar-explorer" size={150} />
              <p>
                {ageFilter === "all" ? (
                  <>
                    还没有角色哦，
                    <br />
                    在右边创建一个吧！
                  </>
                ) : (
                  <>
                    这个年龄段还没有角色哦，
                    <br />
                    在右边创建一个吧！
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="character-list">
              {filteredCharacters.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  selected={selectedChar?.id === char.id}
                  onSelect={setSelectedChar}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Creator + Start side by side */}
        <div className="character-section character-section-right">
          <div className="creator-start-row">
            <div className="creator-start-col">
              <CharacterCreator onCreate={handleCreate} />
            </div>
            {selectedChar && (
              <div className="creator-start-col">
                <div className="start-story-card animate-slide-up">
                  <h3 className="section-title"><PngIcon name="theme-space" size={34} /> 开始故事</h3>
                  <p className="start-story-char">
                    角色：<strong>{selectedChar.nickname}</strong>
                  </p>
                  {selectedAgeGroup && (
                    <p className="start-story-channel">
                      {selectedChar.age_group
                        ? `故事主题按「${AGE_GROUP_LABELS[selectedAgeGroup]}」推荐`
                        : `该角色未标注年龄段，按当前通道「${AGE_GROUP_LABELS[selectedAgeGroup]}」推荐主题`}
                    </p>
                  )}

                  <div className="start-field">
                    <label><PngIcon name="action-write" size={24} /> 故事名字（可选）</label>
                    <input
                      type="text"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      placeholder="给你的故事取个名字吧"
                      maxLength={50}
                    />
                  </div>

                  <div className="theme-selector">
                    <label>选择故事主题</label>
                    <div className="theme-grid">
                      {themes.map((t) => (
                        <button
                          key={t.value}
                          className={`theme-option ${theme === t.value ? "theme-option-selected" : ""}`}
                          onClick={() => setTheme(t.value)}
                        >
                          <PngIcon name={t.icon} size={42} />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                    {theme === "__custom__" && (
                      <input
                        type="text"
                        className="custom-theme-input"
                        value={customTheme}
                        onChange={(e) => setCustomTheme(e.target.value)}
                        placeholder="输入你想创作的故事主题，例如：草原上的动物运动会"
                        maxLength={50}
                        autoFocus
                      />
                    )}
                  </div>

                  {error && <p className="start-error">{error}</p>}

                  <Button
                    variant="accent"
                    size="lg"
                    onClick={handleStartStory}
                    disabled={starting}
                  >
                    {starting ? "准备中..." : "开始创作故事"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
