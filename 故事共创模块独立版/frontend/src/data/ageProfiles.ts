import type { AgeGroup } from '../contexts/ChannelContext';
import type { StoryPngIconName } from '../components/Shared/PngIcon';

/**
 * 年龄段差异化配置。
 *
 * 依据儿童认知发展特点划分：
 * - 4-7 岁（前运算阶段）：以具体形象思维为主，喜欢温暖、熟悉、
 *   充满陪伴感的幻想伙伴，人设侧重情绪与善意。
 * - 8-12 岁（具体运算阶段）：开始喜欢冒险、英雄叙事与逻辑推理，
 *   角色更具目标感与能力设定。
 */

export interface ThemeOption {
  value: string;
  label: string;
  icon: StoryPngIconName;
}

export interface CharacterPreset {
  name: string;
  personality: string;
}

export interface AgeProfile {
  /** 该通道可选的初始形象（头像） */
  avatarTypes: string[];
  /** 形象选择区的说明文案 */
  avatarNote: string;
  /** 一键填入的人设选项 */
  personalityPresets: string[];
  /** 起名灵感（点击后只填入昵称与人设，形象与颜色由孩子自由搭配） */
  characterPresets: CharacterPreset[];
  /** 该通道可选的故事主题 */
  themes: ThemeOption[];
}

/** 角色颜色：6 种明亮基础色，符合儿童认知（去掉暗棕色与相近的琥珀色，保留孩子熟悉且易区分的颜色） */
export const AVATAR_COLORS = [
  '#FF8C42', // 橙色
  '#FF5D8F', // 粉色
  '#5B8DEF', // 蓝色
  '#4FC3F7', // 天蓝色
  '#7C6CF0', // 紫色
  '#34C77B', // 绿色
];

/** 颜色中文名（帮助孩子认识自己选的颜色） */
export const AVATAR_COLOR_NAMES: Record<string, string> = {
  '#FF8C42': '橙色',
  '#FF5D8F': '粉色',
  '#5B8DEF': '蓝色',
  '#4FC3F7': '天蓝色',
  '#7C6CF0': '紫色',
  '#34C77B': '绿色',
};

const COMMON_THEME_OPTIONS: ThemeOption[] = [
  { value: '', label: '让AI导演决定', icon: 'theme-random' },
];

const CUSTOM_THEME_OPTION: ThemeOption = { value: '__custom__', label: '自定义', icon: 'action-write' };

export const AGE_PROFILES: Record<AgeGroup, AgeProfile> = {
  '4-7': {
    avatarTypes: ['fairy', 'dragon', 'astronaut', 'mermaid'],
    avatarNote: '温暖又熟悉的幻想伙伴，会一直陪在你身边',
    personalityPresets: [
      '爱笑又善良，喜欢帮助朋友',
      '有点胆小，但会为了朋友变勇敢',
      '好奇心满满，喜欢问为什么',
      '活泼好动，走到哪里都有笑声',
    ],
    characterPresets: [
      {
        name: '亮亮',
        personality: '爱笑的小精灵，有一对会发光的翅膀，最喜欢帮助森林里的小动物',
      },
      {
        name: '壮壮',
        personality: '勇敢的小火龙，虽然个子小，喷出的火焰却能照亮整个山洞',
      },
      {
        name: '星儿',
        personality: '来自星星的小孩，坐着小火箭来地球找朋友',
      },
      {
        name: '泡泡',
        personality: '住在海底的小美人鱼，歌声能让海浪跳起舞来',
      },
    ],
    themes: [
      ...COMMON_THEME_OPTIONS,
      { value: '童话王国', label: '童话王国', icon: 'theme-castle' },
      { value: '魔法森林', label: '魔法森林', icon: 'theme-forest' },
      { value: '海底世界', label: '海底世界', icon: 'theme-ocean' },
      { value: '恐龙时代', label: '恐龙时代', icon: 'theme-dinosaur' },
      CUSTOM_THEME_OPTION,
    ],
  },
  '8-12': {
    avatarTypes: ['explorer', 'pirate', 'wizard', 'robot', 'astronaut'],
    avatarNote: '冒险与科技并存的伙伴，陪你探索未知世界',
    personalityPresets: [
      '沉着冷静，擅长观察和推理',
      '幽默风趣，总能把伙伴逗笑',
      '知识渊博，遇到难题爱钻研',
      '勇敢果断，越困难越来劲',
      '思维缜密，痴迷宇宙和科技的奥秘',
      '敢想敢试，总能冒出奇妙的科学点子',
    ],
    characterPresets: [
      {
        name: '阿奇',
        personality: '沉着冷静的小探险家，擅长观察和推理，总能从线索中找到出路',
      },
      {
        name: '雷恩',
        personality: '自由的小海盗船长，胆大心细，懂得和伙伴们分享宝藏',
      },
      {
        name: '洛洛',
        personality: '正在魔法学院修行的小巫师，会一点小法术，但最厉害的其实是想象力',
      },
      {
        name: '小Q',
        personality: '来自未来的机器人，知识渊博但有点较真，正在学习人类的幽默感',
      },
      {
        name: '阿星',
        personality: '来自未来星际舰队的小宇航员，驾驶星际飞船探索银河系，梦想和外星朋友成为伙伴',
      },
    ],
    themes: [
      ...COMMON_THEME_OPTIONS,
      { value: '太空冒险', label: '太空冒险', icon: 'theme-space' },
      { value: '超级英雄', label: '超级英雄', icon: 'theme-hero' },
      { value: '机器人时代', label: '机器人时代', icon: 'avatar-robot' },
      { value: '外星探险', label: '外星探险', icon: 'avatar-astronaut' },
      { value: '深海探险', label: '深海探险', icon: 'theme-ocean' },
      { value: '恐龙探险', label: '恐龙探险', icon: 'theme-dinosaur' },
      CUSTOM_THEME_OPTION,
    ],
  },
};
