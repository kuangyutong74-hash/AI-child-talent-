// 新手引导的场景与步骤数据（数据驱动：新增/调整引导只需改这里）
// 文案遵循 child-education-design 技能原则：每步一个核心概念、短句、鼓励性、
// 按年龄段（4-7 / 8-12）提供不同文案。首次使用先完成年龄段选择（选择页无引导遮罩），
// 进入主页后才开始引导（欢迎卡 → 开始创作）。

export type GuideSceneId = 'home' | 'characters' | 'play';

/** 页面在动作完成时调用 notify() 的事件名 */
export type GuideEventName =
  | 'character-created'
  | 'story-started'
  | 'first-turn-finished'
  | 'first-turn-sent';

/** 文案：统一字符串，或按年龄段区分 */
export type GuideText = string | { young: string; older: string };

export type StepWait =
  | { type: 'manual' }
  | { type: 'element'; selector: string; hint?: GuideText };

export type StepCompletion =
  | { type: 'event'; name: GuideEventName }
  | { type: 'path'; path: string; clickTarget?: boolean }
  | { type: 'manual' };

export type StepAdvance = { type: 'event'; name: GuideEventName };

export interface GuideStep {
  id: string;
  /** 目标元素 CSS 选择器（data-guide 属性）；缺省 = 居中卡片，无高亮框/箭头 */
  target?: string;
  emoji: string;
  title: GuideText;
  desc: GuideText;
  /** 卡片位置偏好（实际按可用空间自动选择） */
  placement?: 'above' | 'below' | 'left' | 'right';
  /** 步骤激活条件：等待元素出现（轮询）或手动（默认） */
  waitFor?: StepWait;
  /** 事件触发时自动前进到下一步 */
  advanceOn?: StepAdvance;
  /** 场景完成条件（仅在场景最后一步读取；默认手动点按钮完成） */
  completion?: StepCompletion;
  /** 最后一步按钮文案覆盖 */
  nextLabel?: GuideText;
}

export interface GuideScene {
  id: GuideSceneId;
  page: string;
  match: 'exact' | 'prefix';
  steps: GuideStep[];
}

export const SCENES: GuideScene[] = [
  {
    id: 'home',
    page: '/story-create',
    match: 'exact',
    steps: [
      {
        id: 'home-welcome',
        emoji: '🚀',
        title: '欢迎来到故事共创乐园！',
        desc: {
          young: '我们要一起做一件超酷的事：创建角色，写出属于自己的故事！',
          older: '这里是你的故事创作天地：创建专属角色，和故事导演一起写出独一无二的冒险！',
        },
      },
      {
        id: 'home-start',
        target: '[data-guide="home-start"]',
        placement: 'below',
        emoji: '✏️',
        title: '开始创作！',
        desc: {
          young: '点「开始创作」，去创建你的第一个角色伙伴！',
          older: '点这里创建你的专属角色，故事就从这里开始。',
        },
        completion: { type: 'path', path: '/story-create/characters', clickTarget: true },
        nextLabel: '开始创作！',
      },
    ],
  },
  {
    id: 'characters',
    page: '/story-create/characters',
    match: 'exact',
    steps: [
      {
        id: 'char-create',
        target: '[data-guide="character-creator"]',
        placement: 'left',
        emoji: '🧒',
        title: '创建你的角色',
        desc: {
          young: '在这里起个名字、选个形象，然后点「创建角色」！',
          older: '给角色起名、选形象、挑一段人设，点「创建角色」就完成啦。',
        },
        waitFor: {
          type: 'element',
          selector: '[data-guide="character-creator"]',
          hint: '角色工具马上出现啦，稍等一下哦~',
        },
        advanceOn: { type: 'event', name: 'character-created' },
      },
      {
        id: 'char-start',
        target: '[data-guide="start-story-card"]',
        placement: 'left',
        emoji: '📖',
        title: '开始创作故事',
        desc: {
          young: '太棒了，角色建好了！点「开始创作故事」！',
          older: '可以先选一个故事主题（不选也可以），然后点「开始创作故事」。',
        },
        waitFor: {
          type: 'element',
          selector: '[data-guide="start-story-card"]',
          hint: {
            young: '创建好角色（或点一下左边已有的角色），这里就会出现「开始创作故事」卡片哦~',
            older: '创建角色或点选左边已有角色后，这里会出现「开始创作故事」卡片。',
          },
        },
        completion: { type: 'event', name: 'story-started' },
      },
    ],
  },
  {
    id: 'play',
    page: '/story-create/play/',
    match: 'prefix',
    steps: [
      {
        id: 'play-chat',
        target: '[data-guide="story-chat-area"]',
        placement: 'below',
        emoji: '🎬',
        title: '故事开始了！',
        desc: {
          young: '故事导演开始讲开场啦！仔细听，讲完后会自动继续哦~',
          older: '导演会先讲一段开场，讲完后自动带你进入下一步。',
        },
        waitFor: {
          type: 'element',
          selector: '[data-guide="story-chat-area"]',
          hint: '故事马上就好啦，稍等一下哦~',
        },
        advanceOn: { type: 'event', name: 'first-turn-finished' },
      },
      {
        id: 'play-input',
        target: '[data-guide="story-play-bottom"]',
        placement: 'above',
        emoji: '💬',
        title: '轮到你啦！',
        desc: {
          young: '按住下面的大话筒，说出你的想法，故事就会继续！也可以打字哦~',
          older: '写下你的想法，或按话筒语音输入，你的回答会让故事继续向前！',
        },
        advanceOn: { type: 'event', name: 'first-turn-sent' },
      },
      {
        id: 'play-done',
        emoji: '🎉',
        title: '你已经开始创作啦！',
        desc: {
          young: '真棒！继续和故事导演聊下去，故事会越来越精彩。结束后可以去「创作回顾」看看你的闪光点哦！',
          older: '你已经掌握了故事共创的节奏！继续创作，完结后可以查看创作回顾与天赋分析。',
        },
        nextLabel: '完成',
      },
    ],
  },
];

export const SCENES_BY_ID: Record<GuideSceneId, GuideScene> = SCENES.reduce(
  (acc, scene) => {
    acc[scene.id] = scene;
    return acc;
  },
  {} as Record<GuideSceneId, GuideScene>,
);

/** 按当前年龄段取文案；未选择年龄段时取幼儿版（更温和、简短） */
export function resolveText(
  text: GuideText,
  ageGroup: '4-7' | '8-12' | null,
): string {
  if (typeof text === 'string') return text;
  return ageGroup === '8-12' ? text.older : text.young;
}

/** 按路径匹配场景；未命中返回 null */
export function findSceneForPath(pathname: string): GuideScene | null {
  for (const scene of SCENES) {
    if (scene.match === 'exact' && pathname === scene.page) return scene;
    if (scene.match === 'prefix' && pathname.startsWith(scene.page)) return scene;
  }
  return null;
}
