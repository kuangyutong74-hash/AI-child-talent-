import { useEffect, useRef, useState } from 'react';
import './StoryFairyFloating.css';

interface StoryFairyFloatingProps {
  praise: string;
  isListening: boolean;
}

export default function StoryFairyFloating({ praise, isListening }: StoryFairyFloatingProps) {
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!praise) return;
    setExpanded(true);
    const timer = window.setTimeout(() => setExpanded(false), 8000);
    return () => window.clearTimeout(timer);
  }, [praise]);

  function onPointerDown(e: React.PointerEvent) {
    if (!containerRef.current) return;
    dragging.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = Math.abs(e.clientX - offset.current.x - (pos?.x ?? 0));
    const dy = Math.abs(e.clientY - offset.current.y - (pos?.y ?? 0));
    if (dx < 5 && dy < 5) setExpanded((v) => !v);
  }

  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <aside
      ref={containerRef}
      className={`story-fairy-player ${expanded ? 'fairy-expanded' : ''}`}
      aria-live="polite"
      style={style}
    >
      {expanded && (
        <div className="fairy-player-panel">
          <div className="fairy-player-heading">
            <span>故事精灵</span>
            <button type="button" onClick={() => setExpanded(false)} aria-label="收起故事精灵">x</button>
          </div>
          <p>{praise || (isListening ? '我正在认真听你们一起创作的故事……' : '轮到你创作时，我会发现你的闪光点。')}</p>
          <div className="fairy-sound-wave" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
        </div>
      )}

      <button
        type="button"
        className={`fairy-orb ${isListening ? 'fairy-listening' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label={expanded ? '收起故事精灵' : '故事精灵'}
      >
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <path className="fairy-star-body" d="M36 7c2.2 0 4 1.3 5 3.4l6.1 12.4 13.7 2c4.7.7 6.6 6.5 3.2 9.8l-9.9 9.6 2.3 13.6c.8 4.7-4.1 8.3-8.3 6.1L36 57.5 23.9 64c-4.2 2.2-9.1-1.4-8.3-6.1l2.3-13.6L8 34.6c-3.4-3.3-1.5-9.1 3.2-9.8l13.7-2L31 10.4C32 8.3 33.8 7 36 7z" />
          <ellipse className="fairy-cheek" cx="22.5" cy="39" rx="4.2" ry="2.5" />
          <ellipse className="fairy-cheek" cx="49.5" cy="39" rx="4.2" ry="2.5" />
          <ellipse className="fairy-eye" cx="27" cy="33.5" rx="2.7" ry="3.4" />
          <ellipse className="fairy-eye" cx="45" cy="33.5" rx="2.7" ry="3.4" />
          <circle className="fairy-eye-light" cx="27.8" cy="32.3" r="0.9" />
          <circle className="fairy-eye-light" cx="45.8" cy="32.3" r="0.9" />
          <path className="fairy-orb-smile" d="M31 40c2.8 3 7.2 3 10 0" />
          <path className="fairy-little-arm fairy-arm-left" d="M16.5 43c-4 1-6.5 3.4-7.5 6.5" />
          <path className="fairy-little-arm fairy-arm-right" d="M55.5 43c4-1 6.8-4 7.8-7.2" />
        </svg>
      </button>
    </aside>
  );
}
