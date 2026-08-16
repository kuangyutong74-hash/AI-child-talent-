import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AgeGroup } from '../../contexts/ChannelContext';
import { useTTS } from '../../hooks/useTTS';
import Button from '../Shared/Button';
import { resolveText, type GuideScene, type GuideStep } from './guideSteps';
import './GuideTour.css';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CardPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ArrowPos {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GuideTourProps {
  scene: GuideScene;
  step: GuideStep;
  stepIndex: number;
  ageGroup: AgeGroup | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function queryTarget(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

/** 目标矩形外扩 8px 并限制在视口内。
 *  元素高于视口时不裁剪（取整个可见区域）：保证「洞口」内目标的任何可见部分都可点击，
 *  避免高表单（如角色创建表单）底部的提交按钮被阻挡层盖住。 */
function inflateClamp(r: DOMRect): Rect {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(r.left - pad, pad);
  const right = Math.min(r.right + pad, vw - pad);
  const top = Math.max(r.top - pad, pad);
  const bottom = Math.min(r.bottom + pad, vh - pad);
  return { left, top, width: right - left, height: bottom - top };
}

/** 按偏好 + 可用空间自动选择卡片位置（下方/上方/右侧/左侧） */
function computeCardPos(
  hole: Rect,
  cardW: number,
  cardH: number,
  pref?: GuideStep['placement'],
): { x: number; y: number } {
  const gap = 8;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = hole.left + hole.width / 2;
  const cy = hole.top + hole.height / 2;
  const order: Array<GuideStep['placement']> = [pref, 'below', 'above', 'right', 'left'].filter(
    (s): s is GuideStep['placement'] => !!s,
  );
  for (const side of order) {
    if (side === 'below') {
      const y = hole.top + hole.height + gap;
      if (y + cardH <= vh - pad) return { x: clamp(cx - cardW / 2, pad, vw - cardW - pad), y };
    } else if (side === 'above') {
      const y = hole.top - gap - cardH;
      if (y >= pad) return { x: clamp(cx - cardW / 2, pad, vw - cardW - pad), y };
    } else if (side === 'right') {
      const x = hole.left + hole.width + gap;
      if (x + cardW <= vw - pad) return { x, y: clamp(cy - cardH / 2, pad, vh - cardH - pad) };
    } else {
      const x = hole.left - gap - cardW;
      if (x >= pad) return { x, y: clamp(cy - cardH / 2, pad, vh - cardH - pad) };
    }
  }
  return {
    x: clamp(cx - cardW / 2, pad, vw - cardW - pad),
    y: clamp(hole.top + hole.height + gap, pad, vh - cardH - pad),
  };
}

/** 箭头线段：卡片边缘 → 目标边缘 */
function computeArrow(card: CardPos, hole: Rect): ArrowPos {
  const cardCx = card.x + card.w / 2;
  const cardCy = card.y + card.h / 2;
  const holeCx = hole.left + hole.width / 2;
  const holeCy = hole.top + hole.height / 2;
  const dx = holeCx - cardCx;
  const dy = holeCy - cardCy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x1: dx > 0 ? card.x + card.w : card.x,
      y1: cardCy,
      x2: dx > 0 ? hole.left : hole.left + hole.width,
      y2: holeCy,
    };
  }
  return {
    x1: cardCx,
    y1: dy > 0 ? card.y + card.h : card.y,
    x2: holeCx,
    y2: dy > 0 ? hole.top : hole.top + hole.height,
  };
}

function arrowHead(a: ArrowPos): string {
  const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const len = 14;
  const spread = 0.45;
  const p1 = `${a.x2},${a.y2}`;
  const p2 = `${a.x2 - len * Math.cos(angle - spread)},${a.y2 - len * Math.sin(angle - spread)}`;
  const p3 = `${a.x2 - len * Math.cos(angle + spread)},${a.y2 - len * Math.sin(angle + spread)}`;
  return `${p1} ${p2} ${p3}`;
}

function sameHole(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return (
    round1(a.left) === round1(b.left) &&
    round1(a.top) === round1(b.top) &&
    round1(a.width) === round1(b.width) &&
    round1(a.height) === round1(b.height)
  );
}

function sameCard(a: CardPos | null, b: CardPos | null) {
  if (!a || !b) return a === b;
  return (
    round1(a.x) === round1(b.x) &&
    round1(a.y) === round1(b.y) &&
    round1(a.w) === round1(b.w) &&
    round1(a.h) === round1(b.h)
  );
}

function sameArrow(a: ArrowPos | null, b: ArrowPos | null) {
  if (!a || !b) return a === b;
  return (
    round1(a.x1) === round1(b.x1) &&
    round1(a.y1) === round1(b.y1) &&
    round1(a.x2) === round1(b.x2) &&
    round1(a.y2) === round1(b.y2)
  );
}

export default function GuideTour({
  scene,
  step,
  stepIndex,
  ageGroup,
  onNext,
  onBack,
  onSkip,
}: GuideTourProps) {
  const [pos, setPos] = useState<{
    hole: Rect | null;
    card: CardPos | null;
    arrow: ArrowPos | null;
  }>({ hole: null, card: null, arrow: null });
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 640px)').matches,
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const cardSizeRef = useRef({ w: 360, h: 200 });

  const waitFor = step.waitFor;
  const hasTarget = !!step.target;

  const title = resolveText(step.title, ageGroup);
  const desc = resolveText(step.desc, ageGroup);

  // 幼儿通道：自动朗读引导文案（4-7 岁识字有限，听引导才能独立完成）
  const { speak: speakGuide, stop: stopGuide } = useTTS();
  useEffect(() => {
    if (ageGroup !== '4-7' || waiting) return;
    speakGuide(`${title}。${desc}`);
    return () => stopGuide();
  }, [step.id, waiting, ageGroup, title, desc, speakGuide, stopGuide]);

  // 移动端布局监听
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 引导期间锁定页面滚动，防止误滚；但目标元素比视口高时放行滚动，
  // 否则孩子滚不到表单底部的「创建角色」按钮（rAF 循环会实时跟随目标位置）。
  // 目标元素可能是异步渲染出来的，滚动锁状态放在 rAF 每帧复核。
  const scrollLockRef = useRef(false);
  const setScrollLock = (locked: boolean) => {
    if (scrollLockRef.current === locked) return;
    scrollLockRef.current = locked;
    document.body.style.overflow = locked ? 'hidden' : '';
  };
  useEffect(() => {
    setScrollLock(true);
    return () => {
      // 复位 ref，兼容 StrictMode 双调用（否则第二次挂载会被 ref 守卫跳过）
      scrollLockRef.current = false;
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 等待目标元素出现（每 250ms 轮询；超过 1.5s 显示等待提示）
  useEffect(() => {
    if (!waitFor || waitFor.type !== 'element') {
      setWaiting(false);
      return;
    }
    const { selector } = waitFor;
    const startedAt = Date.now();
    const iv = window.setInterval(() => {
      if (queryTarget(selector)) {
        setWaiting(false);
        window.clearInterval(iv);
        return;
      }
      if (Date.now() - startedAt > 1500 && waitFor.hint) setWaiting(true);
    }, 250);
    return () => window.clearInterval(iv);
  }, [waitFor]);

  // 步骤切换/等待状态变化：滚动目标入视口、测量卡片、计算初始位置
  useLayoutEffect(() => {
    if (!hasTarget) {
      // 无目标步骤（欢迎卡）：清掉上一帧可能残留的高亮框/箭头，并恢复滚动锁
      setPos({ hole: null, card: null, arrow: null });
      setReady(true);
      setScrollLock(true);
      return;
    }
    setReady(false);
    const el = queryTarget(step.target!);
    if (el) {
      // 目标已在视口内就不滚动，避免页面无谓跳动；
      // 需要滚动时瞬间定位（平滑滚动会让卡片跟着满屏滑行，体验卡手）
      const r = el.getBoundingClientRect();
      const fullyVisible = r.top >= 16 && r.bottom <= window.innerHeight - 16;
      if (!fullyVisible) {
        // 目标高于视口时从顶部开始展示（表单按从上到下填写，底部按钮靠滚动到达）
        const tooTall = r.height > window.innerHeight - 32;
        el.scrollIntoView({ block: isMobile ? 'start' : tooTall ? 'start' : 'center', behavior: 'auto' });
      }
    }
    if (cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      cardSizeRef.current = { w: r.width, h: r.height };
    }
    const hole = el ? inflateClamp(el.getBoundingClientRect()) : null;
    let card: CardPos | null = null;
    let arrow: ArrowPos | null = null;
    if (hole && !isMobile) {
      const { w, h } = cardSizeRef.current;
      const cp = computeCardPos(hole, w, h, step.placement);
      card = { ...cp, w, h };
      arrow = computeArrow(card, hole);
    }
    setPos({ hole, card, arrow });
    setReady(true);
  }, [step, waiting, isMobile, hasTarget]);

  // rAF 循环：持续追踪目标位置（chat 区滚动、入场动画等都会移动元素）
  useEffect(() => {
    if (!hasTarget) return;
    let raf = 0;
    const tick = () => {
      const el = queryTarget(step.target!);
      let hole: Rect | null = null;
      let card: CardPos | null = null;
      let arrow: ArrowPos | null = null;
      if (el) {
        const r = el.getBoundingClientRect();
        hole = inflateClamp(r);
        // 目标高于视口 → 放行滚动（元素异步渲染/窗口变化后每帧自动修正）
        setScrollLock(r.height <= window.innerHeight - 32);
        if (!isMobile) {
          const { w, h } = cardSizeRef.current;
          const cp = computeCardPos(hole, w, h, step.placement);
          card = { ...cp, w, h };
          arrow = computeArrow(card, hole);
        }
      }
      setPos((prev) =>
        sameHole(prev.hole, hole) && sameCard(prev.card, card) && sameArrow(prev.arrow, arrow)
          ? prev
          : { hole, card, arrow },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, isMobile, hasTarget]);

  const total = scene.steps.length;
  const isLast = stepIndex === total - 1;
  const hint =
    waitFor?.type === 'element' && waitFor.hint ? resolveText(waitFor.hint, ageGroup) : '';
  const nextLabel = isLast ? resolveText(step.nextLabel ?? '完成', ageGroup) : '下一步';

  function handleNext() {
    // 跳转类完成：最后一步按钮直接点击真实按钮，由路径效应完成场景
    if (
      isLast &&
      step.completion?.type === 'path' &&
      step.completion.clickTarget &&
      step.target
    ) {
      const el = queryTarget(step.target);
      if (el) {
        el.click();
        return;
      }
    }
    onNext();
  }

  const { hole, card, arrow } = pos;
  const showHole = hole !== null;
  // 移动端：目标位于屏幕下半区（如底部输入框）时，弹层移到顶部，避免盖住目标
  const cardAtTop = isMobile && hole !== null && hole.top >= window.innerHeight * 0.5;
  const cardCls = [
    'guide-card',
    !hasTarget || waiting ? 'guide-card-center' : '',
    cardAtTop ? 'guide-card-top' : '',
    ready || !hasTarget ? '' : 'guide-card-hidden',
    ageGroup === '4-7' ? 'guide-card-young' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div className="guide-overlay" role="dialog" aria-label="新手引导">
      {showHole && hole ? (
        <>
          <div
            className="guide-blocker"
            style={{ left: 0, top: 0, width: '100vw', height: hole.top }}
            aria-hidden="true"
          />
          <div
            className="guide-blocker"
            style={{
              left: 0,
              top: hole.top + hole.height,
              width: '100vw',
              height: `calc(100vh - ${hole.top + hole.height}px)`,
            }}
            aria-hidden="true"
          />
          <div
            className="guide-blocker"
            style={{ left: 0, top: hole.top, width: hole.left, height: hole.height }}
            aria-hidden="true"
          />
          <div
            className="guide-blocker"
            style={{
              left: hole.left + hole.width,
              top: hole.top,
              width: `calc(100vw - ${hole.left + hole.width}px)`,
              height: hole.height,
            }}
            aria-hidden="true"
          />
          <div
            className="guide-ring"
            style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }}
            aria-hidden="true"
          />
          {arrow && (
            <svg className="guide-arrow" aria-hidden="true">
              <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} />
              <polygon points={arrowHead(arrow)} />
            </svg>
          )}
        </>
      ) : (
        <div className="guide-blocker guide-blocker-full" aria-hidden="true" />
      )}

      <div
        key={step.id}
        ref={cardRef}
        className={cardCls}
        style={!isMobile && card ? { left: card.x, top: card.y, width: card.w } : undefined}
      >
        {/* 弹入动画放在内层：popIn 会改写 transform，若加在外层会覆盖
            guide-card-center 的 translate(-50%,-50%)，导致居中卡片整体偏移 */}
        <div className="guide-card-body animate-pop-in">
          {waiting ? (
            <div className="guide-waiting-wrap">
              <span className="guide-emoji">⏳</span>
              <p className="guide-waiting">{hint || '稍等一下哦~'}</p>
            </div>
          ) : (
            <>
              <span className="guide-emoji">{step.emoji}</span>
              <h2 className="guide-title">{title}</h2>
              <p className="guide-desc">{desc}</p>
            </>
          )}

          <div className="guide-progress" aria-hidden="true">
            {scene.steps.map((s, i) => (
              <span
                key={s.id}
                className={`guide-dot ${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}`}
              />
            ))}
          </div>

          <div className="guide-actions">
            {stepIndex > 0 ? (
              <Button variant="ghost" size="md" onClick={onBack}>
                ← 上一步
              </Button>
            ) : (
              <span />
            )}
            <div className="guide-actions-right">
              <button className="guide-skip" onClick={onSkip}>
                跳过引导
              </button>
              {!waiting && (
                <Button variant="primary" size="md" onClick={handleNext}>
                  {isLast ? nextLabel : '下一步 →'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
