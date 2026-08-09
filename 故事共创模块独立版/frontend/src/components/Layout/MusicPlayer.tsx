import { useCallback, useEffect, useRef, useState } from 'react';
import './MusicPlayer.css';

const MUSIC_URL = '/story-create/audio/childrens-march-theme.ogg';
const SOURCE_URL = 'https://opengameart.org/content/childrens-march-theme';

export default function MusicPlayer() {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draggable position
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(MUSIC_URL);
      audio.loop = true;
      audio.preload = 'none';
      audio.volume = volume;
      audio.onerror = () => {
        setPlaying(false);
        setError('音乐加载失败，请检查网络');
      };
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [volume]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function openControls() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setExpanded(true);
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setExpanded(false);
      closeTimer.current = null;
    }, 300);
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function toggle() {
    if (dragging.current) return;
    const audio = getAudio();
    setError('');
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setError('浏览器未能播放音乐，请再点一次');
      }
    }
  }

  // ── Drag handlers ──
  function onPointerDown(e: React.PointerEvent) {
    openControls();
    dragging.current = true;
    const rect = containerRef.current!.getBoundingClientRect();
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
    // If barely moved, treat as click
    const dx = Math.abs(e.clientX - offset.current.x - pos.x);
    const dy = Math.abs(e.clientY - offset.current.y - pos.y);
    if (dx < 5 && dy < 5) toggle();
  }

  const volPct = Math.round(volume * 100);

  return (
    <div
      ref={containerRef}
      className={`music-player`}
      style={{ left: pos.x || undefined, top: pos.y || undefined, right: pos.x ? undefined : 24, bottom: pos.y ? undefined : 24 }}
      onPointerEnter={openControls}
      onPointerLeave={scheduleClose}
      onFocus={openControls}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      {error && <span className="music-error" role="status">{error}</span>}
      <button
        className={`music-btn ${playing ? 'music-playing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title={playing ? '点击暂停 · 拖动移动' : '点击播放 · 拖动移动'}
      >
        <span className="music-face">
          <span className="music-eye left" />
          <span className="music-eye right" />
          <span className={`music-mouth ${playing ? 'singing' : ''}`} />
        </span>
        <span className="music-note">{playing ? '♫' : '♪'}</span>
      </button>

      <div
        className={`music-controls ${expanded ? 'music-controls-show' : ''}`}
        onPointerEnter={openControls}
        onPointerLeave={scheduleClose}
      >
        <span className="music-vol-label">音量 {volPct}%</span>
        <input
          type="range" className="music-slider"
          min="0" max="1" step="0.05"
          value={volume}
          aria-label="背景音乐音量"
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
        <a className="music-source" href={SOURCE_URL} target="_blank" rel="noreferrer">
          音乐来源
        </a>
      </div>
    </div>
  );
}
