import { useState } from 'react';
import Button from './Button';
import PngIcon, { type StoryPngIconName } from './PngIcon';
import './Onboarding.css';

interface Step {
  icon: StoryPngIconName;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    icon: 'child-explorer',
    title: '欢迎来到 AI 伯乐！',
    desc: '这里不是普通的讲故事游戏——你将会和一位故事导演一起创作属于你的故事，而我们会在这个过程中发现你的语言天赋！',
  },
  {
    icon: 'story-director',
    title: '选择你的故事通道',
    desc: '创建角色时，先选择「幼儿通道（4-7岁）」或「学龄通道（8-12岁）」。AI 会根据你的年龄调整故事难度和互动方式。',
  },
  {
    icon: 'theme-hero',
    title: '创建你的专属角色',
    desc: '给你的角色取个名字、选个形象、写一段人设（比如"一位善良勇敢的小精灵"），还可以自定义形象和故事主题！',
  },
  {
    icon: 'story-director',
    title: '和故事导演一起创作',
    desc: '故事导演会先讲一段故事，然后问你一个问题。你回答后，导演会根据你的想法继续推进剧情——就这样一来一回，故事就写成了！',
  },
  {
    icon: 'talent-brain',
    title: '收藏你的创作亮点',
    desc: '故事完成后，你会看到精彩瞬间、创作亮点和下一步小建议。详细的成长分析会放在家长端。',
  },
  {
    icon: 'theme-space',
    title: '准备好了吗？',
    desc: '点击「开始冒险」，创建你的第一个角色，让故事开始吧！',
  },
];

interface OnboardingProps {
  onFinish: () => void;
}

export default function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card animate-pop-in">
        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
        </div>

        <span className="onboarding-emoji"><PngIcon name={current.icon} size={96} /></span>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.desc}</p>

        <div className="onboarding-actions">
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              ← 上一步
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={() => isLast ? onFinish() : setStep(step + 1)}>
            {isLast ? '开始冒险' : '下一步 →'}
          </Button>
        </div>

        {!isLast && (
          <button className="onboarding-skip" onClick={onFinish}>
            跳过引导，直接开始
          </button>
        )}
      </div>
    </div>
  );
}

const ONBOARDING_PREFIX = 'ai_bole_onboarding_';

function onboardingKey(userId: number): string {
  return ONBOARDING_PREFIX + userId;
}

export function isOnboardingDone(userId: number): boolean {
  return localStorage.getItem(onboardingKey(userId)) === 'true';
}

export function markOnboardingDone(userId: number): void {
  localStorage.setItem(onboardingKey(userId), 'true');
}
