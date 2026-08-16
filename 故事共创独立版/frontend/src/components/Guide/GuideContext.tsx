import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useChannel } from '../../contexts/ChannelContext';
import GuideTour from './GuideTour';
import {
  findSceneForPath,
  SCENES,
  SCENES_BY_ID,
  type GuideEventName,
  type GuideSceneId,
} from './guideSteps';

export const GUIDE_KEY = 'story_create_guide_v2';

interface ScenePersist {
  done: boolean;
  /** 场景内续播步骤下标（中途刷新可续） */
  step: number;
}

interface GuidePersist {
  version: 1;
  done: boolean;
  scenes: Record<GuideSceneId, ScenePersist>;
}

const DEFAULT_PERSIST: GuidePersist = {
  version: 1,
  done: false,
  scenes: {
    home: { done: false, step: 0 },
    characters: { done: false, step: 0 },
    play: { done: false, step: 0 },
  },
};

function readPersist(): GuidePersist {
  try {
    const raw = localStorage.getItem(GUIDE_KEY);
    if (!raw) return DEFAULT_PERSIST;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return DEFAULT_PERSIST;
    }
    const scenes = { ...DEFAULT_PERSIST.scenes };
    (Object.keys(scenes) as GuideSceneId[]).forEach((id) => {
      const s = parsed.scenes?.[id];
      if (s && typeof s === 'object') {
        const maxStep = SCENES_BY_ID[id].steps.length - 1;
        scenes[id] = {
          done: !!s.done,
          step:
            typeof s.step === 'number' && s.step > 0
              ? Math.min(s.step, maxStep)
              : 0,
        };
      }
    });
    return { version: 1, done: !!parsed.done, scenes };
  } catch {
    return DEFAULT_PERSIST;
  }
}

function markSceneDone(p: GuidePersist, id: GuideSceneId): GuidePersist {
  const scenes = {
    ...p.scenes,
    [id]: { done: true, step: p.scenes[id].step },
  };
  const allDone = (Object.keys(scenes) as GuideSceneId[]).every(
    (key) => scenes[key].done,
  );
  return { version: 1, done: allDone, scenes };
}

export interface GuideApi {
  /** 页面在关键动作完成后调用；引导未激活时为空操作 */
  notify: (name: GuideEventName) => void;
  /** 清空全部完成标记，重新开始引导（调用方需跳转到 /story-create/channel） */
  resetAll: () => void;
  /** 当前是否有引导遮罩在展示（用于页面侧避让自动朗读等行为） */
  isGuideActive: boolean;
}

const GuideContext = createContext<GuideApi>({
  notify: () => {},
  resetAll: () => {},
  isGuideActive: false,
});

export function useGuide(): GuideApi {
  return useContext(GuideContext);
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const { ageGroup, clearAgeGroup } = useChannel();
  const { pathname } = useLocation();
  const [persist, setPersist] = useState<GuidePersist>(readPersist);
  const [sceneId, setSceneId] = useState<GuideSceneId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const active = !persist.done;

  // 最新会话快照：notify 由页面事件同步调用（React 批处理 + 导航竞态），
  // 必须从 ref 读取最新状态而不是闭包里的旧值。
  const sessionRef = useRef({ active, sceneId, stepIndex, persist });
  useEffect(() => {
    sessionRef.current = { active, sceneId, stepIndex, persist };
  });

  const completeScene = useCallback((id: GuideSceneId): GuidePersist => {
    const next = markSceneDone(sessionRef.current.persist, id);
    localStorage.setItem(GUIDE_KEY, JSON.stringify(next));
    setPersist(next);
    setSceneId(null);
    setStepIndex(0);
    return next;
  }, []);

  const startScene = useCallback((id: GuideSceneId, step: number) => {
    setSceneId(id);
    setStepIndex(step);
    setPersist((prev) => {
      const next: GuidePersist = {
        ...prev,
        scenes: {
          ...prev.scenes,
          [id]: { done: prev.scenes[id].done, step },
        },
      };
      localStorage.setItem(GUIDE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const advance = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur.sceneId) return;
    const scene = SCENES_BY_ID[cur.sceneId];
    if (cur.stepIndex < scene.steps.length - 1) {
      const nextIdx = cur.stepIndex + 1;
      setStepIndex(nextIdx);
      setPersist((prev) => {
        const next: GuidePersist = {
          ...prev,
          scenes: {
            ...prev.scenes,
            [cur.sceneId!]: { done: prev.scenes[cur.sceneId!].done, step: nextIdx },
          },
        };
        localStorage.setItem(GUIDE_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      completeScene(cur.sceneId);
    }
  }, [completeScene]);

  const back = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur.sceneId || cur.stepIndex === 0) return;
    const prevIdx = cur.stepIndex - 1;
    setStepIndex(prevIdx);
    setPersist((prev) => {
      const next: GuidePersist = {
        ...prev,
        scenes: {
          ...prev.scenes,
          [cur.sceneId!]: { done: prev.scenes[cur.sceneId!].done, step: prevIdx },
        },
      };
      localStorage.setItem(GUIDE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const onEvent = useCallback(
    (name: GuideEventName) => {
      const cur = sessionRef.current;
      if (!cur.active) return;
      if (!cur.sceneId) {
        // 引导空闲时孩子自己完成了某场景的关键动作 → 静默标记该场景完成，之后不再弹出
        const scene = SCENES.find((s) => {
          const last = s.steps[s.steps.length - 1];
          return last.completion?.type === 'event' && last.completion.name === name;
        });
        if (scene && !cur.persist.scenes[scene.id].done) {
          completeScene(scene.id);
        }
        return;
      }
      const scene = SCENES_BY_ID[cur.sceneId];
      const step = scene.steps[cur.stepIndex];
      const isLast = cur.stepIndex === scene.steps.length - 1;
      if (step.advanceOn?.name === name) {
        advance();
        return;
      }
      if (isLast && step.completion?.type === 'event' && step.completion.name === name) {
        completeScene(cur.sceneId);
      }
    },
    [advance, completeScene],
  );

  const skipAll = useCallback(() => {
    const cur = sessionRef.current;
    const scenes = {} as Record<GuideSceneId, ScenePersist>;
    (Object.keys(cur.persist.scenes) as GuideSceneId[]).forEach((id) => {
      scenes[id] = { done: true, step: cur.persist.scenes[id].step };
    });
    const next: GuidePersist = { version: 1, done: true, scenes };
    localStorage.setItem(GUIDE_KEY, JSON.stringify(next));
    setPersist(next);
    setSceneId(null);
    setStepIndex(0);
  }, []);

  const resetAll = useCallback(() => {
    // 连同年龄段一起重置，「重新看引导」才能完整重走选年龄流程
    clearAgeGroup();
    localStorage.setItem(GUIDE_KEY, JSON.stringify(DEFAULT_PERSIST));
    setPersist(DEFAULT_PERSIST);
    setSceneId(null);
    setStepIndex(0);
  }, [clearAgeGroup]);

  // 路径变化：场景完成（跳转类）、离开场景页时暂停（不完成）、到达场景页时启动/续播
  useEffect(() => {
    const cur = sessionRef.current;
    if (!cur.active) return;

    if (cur.sceneId) {
      const scene = SCENES_BY_ID[cur.sceneId];
      const last = scene.steps[scene.steps.length - 1];
      const completedByPath =
        last.completion?.type === 'path' && pathname === last.completion.path;
      if (completedByPath) {
        const next = completeScene(cur.sceneId);
        const here = findSceneForPath(pathname);
        if (!next.done && here && !next.scenes[here.id].done) {
          startScene(here.id, next.scenes[here.id].step);
        }
        return;
      }
      const here = findSceneForPath(pathname);
      if (!here || here.id !== cur.sceneId) {
        if (here && !cur.persist.scenes[here.id].done) {
          // 路径已切到另一个未完成场景（如首访重定向、浏览器后退）：
          // 直接启动新场景，原场景保留进度、回来后续播
          startScene(here.id, cur.persist.scenes[here.id].step);
        } else {
          // 离开场景页（如去书架）：隐藏遮罩但保留进度
          setSceneId(null);
        }
      }
      return;
    }

    const here = findSceneForPath(pathname);

    // 孩子自己走到了角色页（引导未激活）→ 视作已学会「开始创作」，静默完成 home 场景
    const homeScene = SCENES_BY_ID.home;
    const homeLast = homeScene.steps[homeScene.steps.length - 1];
    if (
      !cur.persist.scenes.home.done &&
      homeLast.completion?.type === 'path' &&
      pathname === homeLast.completion.path
    ) {
      const next = completeScene('home');
      if (here && !next.scenes[here.id].done) {
        startScene(here.id, next.scenes[here.id].step);
      }
      return;
    }

    // 到达未完成场景页（如选择年龄后进入主页）→ 启动/续播该场景引导
    if (here && !cur.persist.scenes[here.id].done) {
      startScene(here.id, cur.persist.scenes[here.id].step);
    }
  }, [pathname, completeScene, startScene]);

  const api = useMemo<Omit<GuideApi, 'isGuideActive'>>(
    () => ({ notify: onEvent, resetAll }),
    [onEvent, resetAll],
  );

  // 已完成的场景即使残留 sceneId 也不渲染遮罩（防竞态闪屏的双保险）
  const scene = sceneId && !persist.scenes[sceneId].done ? SCENES_BY_ID[sceneId] : null;
  const step = scene ? scene.steps[stepIndex] : null;

  const apiWithActivity = useMemo<GuideApi>(
    () => ({ ...api, isGuideActive: scene !== null }),
    [api, scene],
  );

  return (
    <GuideContext.Provider value={apiWithActivity}>
      {children}
      {scene && step && (
        <GuideTour
          scene={scene}
          step={step}
          stepIndex={stepIndex}
          ageGroup={ageGroup}
          onNext={advance}
          onBack={back}
          onSkip={skipAll}
        />
      )}
    </GuideContext.Provider>
  );
}
