import { useCallback, useRef, useState } from 'react';

/**
 * Browser Speech-to-Text hook using the Web Speech API.
 * Works in Chrome/Edge. Shows interim results for live feedback.
 */
export function useSpeechInput() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        reject(new Error('请用 Chrome 浏览器打开才能语音输入'));
        return;
      }

      // Clean up previous instance
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;   // Show live feedback
      recognition.maxAlternatives = 1;
      recognition.continuous = false;      // Auto-stop after one utterance

      let finalTranscript = '';
      let resolved = false;

      recognition.onstart = () => {
        setListening(true);
        setInterim('');
      };

      recognition.onresult = (e: any) => {
        let interimTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        setInterim(interimTranscript);

        // If continuous=false, the first final result means we're done
        if (finalTranscript && !resolved) {
          resolved = true;
          resolve(finalTranscript);
        }
      };

      recognition.onend = () => {
        setListening(false);
        setInterim('');
        // If no result was captured, treat as no-speech
        if (!resolved) {
          resolved = true;
          if (finalTranscript) {
            resolve(finalTranscript);
          } else {
            reject(new Error('没有听到声音，请再试一次~'));
          }
        }
      };

      recognition.onerror = (e: any) => {
        setListening(false);
        setInterim('');
        if (!resolved) {
          resolved = true;
          if (e.error === 'not-allowed') {
            reject(new Error('需要麦克风权限~请在浏览器弹窗中点「允许」'));
          } else if (e.error === 'aborted') {
            reject(new Error('已取消'));
          } else if (e.error === 'no-speech') {
            reject(new Error('没有听到声音，请再试一次~'));
          } else if (e.error === 'network') {
            reject(new Error('语音识别需要联网，请检查网络~'));
          } else {
            reject(new Error('语音识别出错，请再试一次~'));
          }
        }
      };

      recognition.start();
    });
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    setListening(false);
    setInterim('');
  }, []);

  return { startListening, stopListening, listening, interim };
}
