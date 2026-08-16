import { useCallback, useRef } from 'react';
import { sendStoryTurn } from '../api/endpoints';
import { useStoryState } from '../contexts/StoryContext';
import {
  CHILD_INPUT_BLOCK_MESSAGE,
  shouldBlockChildInput,
} from '../utils/childInputGuard';

const MAX_RETRIES = 2;

export function useSSE() {
  const { dispatch } = useStoryState();
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<Record<number, number>>({});

  const skipQuestionRef = useRef(false);  // Set true when writing ending

  const startTurn = useCallback(
    async (storyId: number, childInput: string, skipQuestion: boolean = false): Promise<void> => {
      const isKickoff = childInput === '';
      skipQuestionRef.current = skipQuestion;

      if (!isKickoff && shouldBlockChildInput(childInput)) {
        window.alert(CHILD_INPUT_BLOCK_MESSAGE);
        dispatch({
          type: 'SHOW_SAFETY_NOTICE',
          message: CHILD_INPUT_BLOCK_MESSAGE,
          level: 'moderate',
        });
        return;
      }

      // Don't add child message for kickoff (AI initiates)
      if (!isKickoff) {
        dispatch({ type: 'ADD_CHILD_MESSAGE', content: childInput });
      }

      // Start AI streaming bubble
      dispatch({ type: 'START_AI_STREAMING' });

      // Cancel any previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const doStream = async () => {
        const response = await sendStoryTurn(storyId, childInput, abortRef.current!.signal, skipQuestion);

        if (!response.ok) {
          let errMsg = '故事导演暂时离开了';
          try {
            const err = await response.json();
            errMsg = err.detail || errMsg;
          } catch {}
          throw new Error(errMsg);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            // Skip heartbeat comments (lines starting with ":")
            if (line.startsWith(': ')) continue;

            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                handleEvent(currentEvent, data);
              } catch {
                // Ignore parse errors for individual data lines
              }
              currentEvent = '';
            }
          }
        }

        // Success — reset retry count
        retryCountRef.current[storyId] = 0;
      };

      try {
        await doStream();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        const retries = retryCountRef.current[storyId] || 0;
        if (retries < MAX_RETRIES) {
          retryCountRef.current[storyId] = retries + 1;
          const message = `故事导演掉线了，正在重连...（第${retries + 1}次）`;
          dispatch({
            type: 'SHOW_SAFETY_NOTICE',
            message,
            level: 'mild',
          });

          // Auto-retry after 2 seconds
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Reset the abort controller for retry
          abortRef.current = new AbortController();
          try {
            await doStream();
            return;
          } catch (retryErr: unknown) {
            if (retryErr instanceof Error && retryErr.name === 'AbortError') return;
          }
        }

        const message = err instanceof Error ? err.message : '网络连接出错了，请检查网络后重试';
        handleEvent('error', { message });
      }
    },
    [dispatch],
  );

  function handleEvent(event: string, data: Record<string, unknown>) {
    switch (event) {
      case 'narrative_chunk':
        dispatch({
          type: 'APPEND_NARRATIVE_CHUNK',
          text: data.text as string,
        });
        break;

      case 'praise':
        if (typeof data.text === 'string' && data.text.trim()) {
          dispatch({ type: 'ADD_FAIRY_PRAISE', content: data.text });
        }
        break;

      case 'ending':
        dispatch({
          type: 'APPEND_ENDING',
          text: data.text as string,
        });
        break;

      case 'question':
        if (skipQuestionRef.current) break;  // Skip question when writing ending
        dispatch({ type: 'SET_AI_QUESTION', text: data.text as string });
        break;

      case 'safety_notice':
        dispatch({
          type: 'SHOW_SAFETY_NOTICE',
          message: data.message as string,
          level: (data.level as string) || 'mild',
        });
        // Auto-dismiss after 5 seconds
        setTimeout(() => dispatch({ type: 'DISMISS_SAFETY_NOTICE' }), 5000);
        break;

      case 'input_redacted':
        if (typeof data.text === 'string') {
          dispatch({ type: 'REDACT_LAST_CHILD_MESSAGE', content: data.text });
        }
        break;

      case 'input_blocked':
        dispatch({ type: 'REMOVE_BLOCKED_TURN' });
        break;

      case 'done':
        // If writing ending, auto-complete regardless of server response
        if (skipQuestionRef.current) {
          skipQuestionRef.current = false;
          dispatch({
            type: 'FINISH_TURN',
            turnNumber: data.turn_number as number,
            isEnding: true,
          });
        } else {
          dispatch({
            type: 'FINISH_TURN',
            turnNumber: data.turn_number as number,
            isEnding: (data.is_ending as boolean) || false,
          });
        }
        break;

      case 'error':
        dispatch({ type: 'FAIL_TURN', message: data.message as string });
        break;
    }
  }

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return { startTurn, cancel };
}
