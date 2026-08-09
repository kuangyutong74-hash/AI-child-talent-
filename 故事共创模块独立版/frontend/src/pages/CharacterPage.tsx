import { useEffect, useState } from "react";
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
import PngIcon, { type StoryPngIconName } from "../components/Shared/PngIcon";
import "./CharacterPage.css";

const THEMES = [
  { value: "", label: "让AI导演决定", icon: "theme-random" },
  { value: "太空冒险", label: "太空冒险", icon: "theme-space" },
  { value: "魔法森林", label: "魔法森林", icon: "theme-forest" },
  { value: "海底世界", label: "海底世界", icon: "theme-ocean" },
  { value: "恐龙时代", label: "恐龙时代", icon: "theme-dinosaur" },
  { value: "童话王国", label: "童话王国", icon: "theme-castle" },
  { value: "超级英雄", label: "超级英雄", icon: "theme-hero" },
  { value: "__custom__", label: "自定义", icon: "action-write" },
] satisfies Array<{ value: string; label: string; icon: StoryPngIconName }>;

export default function CharacterPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [theme, setTheme] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadCharacters();
  }, []);

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
    age_group: "4-7" | "8-12";
  }) {
    const newChar = await createCharacter(data);
    setCharacters((prev) => [...prev, newChar]);
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
    if (selectedChar.age_group !== "4-7" && selectedChar.age_group !== "8-12") {
      setError("请先选择年龄创作通道");
      return;
    }
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

  if (loading) return <Loading text="加载角色中..." />;

  return (
    <div className="character-page page">
      <div className="character-layout">
        {/* Left: Character list */}
        <div className="character-section">
          <h2 className="section-title"> 我的角色</h2>
          {characters.length === 0 ? (
            <div className="character-empty">
              <PngIcon name="avatar-explorer" size={150} />
              <p>
                还没有角色哦，
                <br />
                在右边创建一个吧！
              </p>
            </div>
          ) : (
            <div className="character-list">
              {characters.map((char) => (
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
                      {THEMES.map((t) => (
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
