import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listStories,
  deleteStory,
  updateStory,
  type Story,
} from "../api/endpoints";
import { apiFetch } from "../api/client";
import StoryCard from "../components/Gallery/StoryCard";
import StoryReader from "../components/Gallery/StoryReader";
import Modal from "../components/Shared/Modal";
import Button from "../components/Shared/Button";
import Loading from "../components/Shared/Loading";
import PngIcon from "../components/Shared/PngIcon";
import "./GalleryPage.css";

export default function GalleryPage({ parentMode = false }: { parentMode?: boolean }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingStory, setReadingStory] = useState<Story | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadStories();
  }, [parentMode]);

  async function loadStories() {
    try {
      const data = parentMode
        ? await apiFetch<Story[]>("/stories/parent/all")
        : await listStories();
      setStories(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(story: Story, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("确定要删除这个故事吗？")) return;
    await deleteStory(story.id);
    setStories((prev) => prev.filter((s) => s.id !== story.id));
    if (readingStory?.id === story.id) setReadingStory(null);
  }

  async function handleRename(story: Story) {
    const newTitle = prompt(
      "给你的故事取个名字吧：",
      story.title || story.theme || "",
    );
    if (newTitle && newTitle.trim()) {
      await updateStory(story.id, { title: newTitle.trim() });
      loadStories();
    }
  }

  function handleContinueStory(story: Story) {
    navigate(`/story-create/play/${story.id}`);
  }

  if (loading) return <Loading text="加载故事画廊..." />;

  const activeStories = parentMode ? [] : stories.filter((s) => s.status === "active");
  const completedStories = stories.filter((s) => s.status === "completed");
  const hasVisibleStories = parentMode ? completedStories.length > 0 : stories.length > 0;

  return (
    <div className="gallery-page page">
      <div className="gallery-header">
        <h1>{parentMode ? "家长故事书架" : "我的故事画廊"}</h1>
        {!parentMode && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={() => navigate("/story-create/characters")}>
              <PngIcon name="celebration" size={26} /> 创作新故事
            </Button>
          </div>
        )}
      </div>

      {!hasVisibleStories ? (
        <div className="gallery-empty">
          <PngIcon name="story-book" size={150} />
          <h2>{parentMode ? '还没有已完成的故事' : '还没有故事'}</h2>
          <p>{parentMode ? '孩子完成故事后，会显示在这里。' : '去创作你的第一个故事吧！'}</p>
          {!parentMode && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate("/story-create/characters")}
            >
              <PngIcon name="theme-space" size={26} /> 开始创作
            </Button>
          )}
        </div>
      ) : (
        <>
          {activeStories.length > 0 && (
            <div className="gallery-section">
              <h2 className="gallery-section-title"> 进行中的故事</h2>
              <div className="gallery-grid">
                {activeStories.map((story) => (
                  <div key={story.id} className="gallery-story-wrapper">
                    <StoryCard story={story} onClick={handleContinueStory} />
                    <div className="gallery-story-actions">
                      <button
                        className="gallery-action-btn continue"
                        onClick={() => handleContinueStory(story)}
                      >
                        ▶ 继续创作
                      </button>
                      <button
                        className="gallery-action-btn delete"
                        onClick={(e) => handleDelete(story, e)}
                      >
                        <PngIcon name="action-delete" size={22} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedStories.length > 0 && (
            <div className="gallery-section">
              <h2 className="gallery-section-title"> 完成的故事</h2>
              <div className="gallery-grid">
                {completedStories.map((story) => (
                  <div key={story.id} className="gallery-story-wrapper">
                    <StoryCard
                      story={story}
                      onClick={() => setReadingStory(story)}
                    />
                    <div className="gallery-story-actions">
                      <button
                        className="gallery-action-btn read"
                        onClick={() => setReadingStory(story)}
                      >
                        <PngIcon name="story-book" size={22} /> 阅读
                      </button>
                      {!parentMode && (
                        <button
                          className="gallery-action-btn rename"
                          onClick={() => handleRename(story)}
                        >
                          <PngIcon name="action-write" size={22} /> 改名
                        </button>
                      )}
                      <button
                        className="gallery-action-btn talent"
                        onClick={() => navigate(parentMode ? `/story-create/parent/talent/${story.id}` : `/story-create/talent/${story.id}`)}
                      >
                        <PngIcon name="talent-brain" size={22} /> {parentMode ? '查看详细分析' : '创作回顾'}
                      </button>
                      <button
                        className="gallery-action-btn delete"
                        onClick={(e) => handleDelete(story, e)}
                      >
                        <PngIcon name="action-delete" size={22} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Story reader modal */}
      <Modal
        open={!!readingStory}
        onClose={() => setReadingStory(null)}
        title={readingStory?.title || readingStory?.theme || "故事"}
      >
        {readingStory && <StoryReader storyId={readingStory.id} />}
      </Modal>
    </div>
  );
}
