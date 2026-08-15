import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AGE_GROUP_LABELS, useChannel } from "../contexts/ChannelContext";
import Button from "../components/Shared/Button";
import Onboarding from "../components/Shared/Onboarding";
import PngIcon from "../components/Shared/PngIcon";
import "./HomePage.css";

const ONBOARDING_DONE_KEY = "story_create_onboarding_done";

export default function HomePage() {
  const { ageGroup } = useChannel();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem(ONBOARDING_DONE_KEY) !== "true"
  );

  function handleOnboardingFinish() {
    localStorage.setItem(ONBOARDING_DONE_KEY, "true");
    setShowOnboarding(false);
  }

  return (
    <main className="home-page">
      {showOnboarding && <Onboarding onFinish={handleOnboardingFinish} />}
      <section className="home-stage">
        <div className="home-copy">
          <span className="home-kicker">每个孩子，都是天生的故事家</span>
          <h1 className="home-title">
            <span className="home-title-lead">把奇思妙想</span>
            <span className="home-title-highlight">写成会<span className="home-title-keyword">发光</span>的故事</span>
          </h1>
          <div className="home-intro">
            <p className="home-subtitle">和故事导演一起创造角色、展开冒险，写出只属于你的奇妙结局。</p>
            <p className="home-welcome">嗨，小作家，今天想从哪里开始冒险？</p>
          </div>
          {ageGroup && (
            <div className="home-channel">
              <button className="home-channel-button" onClick={() => navigate('/story-create/channel')}>
                <span>{AGE_GROUP_LABELS[ageGroup]}</span>
                <small>点击切换年龄段 ›</small>
              </button>
            </div>
          )}
          <div className="home-actions">
            <Button className="home-main-action" variant="primary" size="lg" onClick={() => navigate("/story-create/characters")}><PngIcon name="action-write" size={40} />开始创作</Button>
            <Button className="home-main-action" variant="secondary" size="lg" onClick={() => navigate("/story-create/gallery")}><PngIcon name="story-book" size={40} />我的故事书架</Button>
            <Button className="home-main-action" variant="secondary" size="lg" onClick={() => navigate("/story-create/parent")}><PngIcon name="talent-brain" size={40} />家长故事书架</Button>
          </div>
        </div>
        <div className="home-visual" aria-hidden="true">
          <img src="/story-create/home/story-portal.png" width={432} height={540} className="home-portal-png" alt="" />
          <span className="visual-tag tag-top">想一想</span>
          <span className="visual-tag tag-bottom">说出来</span>
        </div>
      </section>
    </main>
  );
}
