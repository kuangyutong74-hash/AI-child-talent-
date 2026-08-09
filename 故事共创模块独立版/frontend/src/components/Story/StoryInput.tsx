import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import PngIcon from '../Shared/PngIcon';
import './StoryInput.css';

interface StoryInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function StoryInput({
  onSubmit,
  disabled = false,
  placeholder = '写下你的想法吧...',
}: StoryInputProps) {
  const [text, setText] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { startListening, stopListening, listening, interim } = useSpeechInput();

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
    setVoiceError('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }

  async function handleVoiceInput() {
    setVoiceError('');
    if (listening) {
      stopListening();
      return;
    }

    // Check browser support first
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('你的浏览器不支持语音输入，请用 Chrome 浏览器打开~');
      setTimeout(() => setVoiceError(''), 4000);
      return;
    }

    try {
      const transcript = await startListening();
      setText((prev) => prev + transcript);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '语音识别失败，请再试一次~';
      setVoiceError(msg);
      setTimeout(() => setVoiceError(''), 4000);
    }
  }

  return (
    <div className="story-input-wrapper">
      {voiceError && (
        <div className="voice-error">{voiceError}</div>
      )}
      <div className="story-input-row">
        <button
          type="button"
          className={`voice-btn ${listening ? 'voice-btn-active' : ''}`}
          onClick={handleVoiceInput}
          disabled={disabled}
          title={listening ? '点击停止' : '语音输入'}
        >
          {listening ? <span aria-label="正在录音">⏺</span> : <PngIcon name="action-microphone" size={30} />}
        </button>
        <textarea
          ref={inputRef}
          className="story-input-field"
          value={text}
          onChange={(e) => { setText(e.target.value); setVoiceError(''); }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={listening ? (interim || '正在聆听...请说话') : placeholder}
          disabled={disabled || listening}
          rows={1}
        />
        <button
          type="submit"
          className="story-input-send"
          disabled={disabled || !text.trim()}
          onClick={handleSubmit}
          title="发送"
        >
          <PngIcon name="theme-space" size={30} />
        </button>
      </div>
      <p className="story-input-hint">按 Enter 发送，Shift+Enter 换行 · 支持语音输入</p>
    </div>
  );
}
