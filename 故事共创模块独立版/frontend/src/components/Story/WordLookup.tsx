import { useState, useEffect, useRef } from 'react';
import { getToken } from '../../api/client';
import './WordLookup.css';
import PngIcon from '../Shared/PngIcon';

interface WordLookupProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
}

async function lookupWord(word: string): Promise<string> {
  const key = word.trim();
  if (!key) return '';

  // Call backend DeepSeek-powered dictionary API
  try {
    const token = getToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(
      `/api/v1/dictionary/lookup?word=${encodeURIComponent(key)}`,
      {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      return data.definition || '';
    }
  } catch {
    // Network error — show fallback
  }

  return `网络出了点小问题，稍后再查「${key}」吧~`;
}

export default function WordLookup({ selectedText, position, onClose }: WordLookupProps) {
  const [definition, setDefinition] = useState('正在问故事导演...');
  const popupRef = useRef<HTMLDivElement>(null);
  const word = selectedText.trim();

  useEffect(() => {
    let cancelled = false;
    lookupWord(word).then((def) => {
      if (!cancelled) {
        setDefinition(def || `暂时没有找到「${word}」的释义~`);
      }
    });
    return () => { cancelled = true; };
  }, [word]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const x = Math.min(position.x, window.innerWidth - 260);
  const y = Math.min(position.y - 80, window.innerHeight - 200);

  return (
    <div className="word-lookup-popup" ref={popupRef} style={{ left: x, top: Math.max(y, 10) }}>
      <div className="word-lookup-header">
        <span className="word-lookup-title"><PngIcon name="story-book" size={28} /> {word}</span>
        <button className="word-lookup-close" onClick={onClose}>✕</button>
      </div>
      <p className="word-lookup-def">{definition}</p>
    </div>
  );
}
