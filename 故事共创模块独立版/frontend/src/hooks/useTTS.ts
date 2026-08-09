import { useCallback, useEffect, useRef, useState } from 'react';
import { synthesizeSpeech } from '../api/endpoints';

function cleanSpeechText(text: string): string {
  return text
    .replace(/\{.*?\}/g, '')
    .replace(/[\p{Emoji}]/gu, '')
    .replace(/[★☆✨🌟💫⭐]/g, '')
    .trim();
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const releaseAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    releaseAudio();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [releaseAudio]);

  const speakWithBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    const voices = synth.getVoices();
    const voice = voices.find((item) =>
      item.lang.startsWith('zh') || item.name.includes('Chinese') ||
      item.name.includes('TingTing') || item.name.includes('Yaoyao'),
    );
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.onstart = () => { setSpeaking(true); setPaused(false); };
    utterance.onend = () => { setSpeaking(false); setPaused(false); };
    utterance.onerror = () => { setSpeaking(false); setPaused(false); };
    synth.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string) => {
    const cleanText = cleanSpeechText(text);
    if (!cleanText) return;
    stop();
    const controller = new AbortController();
    requestRef.current = controller;
    setSpeaking(true);

    try {
      const blob = await synthesizeSpeech(cleanText, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => { setSpeaking(true); setPaused(false); };
      audio.onpause = () => { if (!audio.ended) setPaused(true); };
      audio.onended = () => { releaseAudio(); setSpeaking(false); setPaused(false); };
      audio.onerror = () => { releaseAudio(); setSpeaking(false); setPaused(false); };
      await audio.play();
    } catch (error) {
      if (controller.signal.aborted) return;
      releaseAudio();
      setSpeaking(false);
      speakWithBrowser(cleanText);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [releaseAudio, speakWithBrowser, stop]);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    else window.speechSynthesis?.pause();
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) void audioRef.current.play();
    else window.speechSynthesis?.resume();
    setPaused(false);
  }, []);

  useEffect(() => stop, [stop]);

  return { speak, pause, resume, stop, speaking, paused };
}
