import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';

// ── Types ──

export interface ChatMessage {
  id: string;
  role: 'ai' | 'child' | 'fairy';
  content: string;
  isStreaming?: boolean;
  isQuestion?: boolean;
  isEnding?: boolean;
}

export interface SafetyNotice {
  message: string;
  level: string;
}

export interface TurnState {
  storyId: number | null;
  messages: ChatMessage[];
  turnNumber: number;
  isStreaming: boolean;
  isEnding: boolean;
  safetyNotice: SafetyNotice | null;
  fairyPraise: string;
}

// ── Actions ──

type TurnAction =
  | { type: 'START_STORY'; storyId: number }
  | { type: 'ADD_CHILD_MESSAGE'; content: string }
  | { type: 'START_AI_STREAMING' }
  | { type: 'ADD_FAIRY_PRAISE'; content: string }
  | { type: 'APPEND_NARRATIVE_CHUNK'; text: string }
  | { type: 'APPEND_ENDING'; text: string }
  | { type: 'SET_AI_QUESTION'; text: string }
  | { type: 'FINISH_TURN'; turnNumber: number; isEnding: boolean }
  | { type: 'FAIL_TURN'; message: string }
  | { type: 'RESTORE_MESSAGES'; messages: ChatMessage[]; turnNumber: number; isEnding: boolean; fairyPraise?: string }
  | { type: 'SHOW_SAFETY_NOTICE'; message: string; level: string }
  | { type: 'REDACT_LAST_CHILD_MESSAGE'; content: string }
  | { type: 'REMOVE_BLOCKED_TURN' }
  | { type: 'DISMISS_SAFETY_NOTICE' }
  | { type: 'RESET' };

// ── Reducer ──

function turnReducer(state: TurnState, action: TurnAction): TurnState {
  switch (action.type) {
    case 'START_STORY':
      return {
        storyId: action.storyId,
        messages: [],
        turnNumber: 0,
        isStreaming: false,
        isEnding: false,
        safetyNotice: null,
        fairyPraise: '',
      };

    case 'ADD_CHILD_MESSAGE': {
      const childMsg: ChatMessage = {
        id: `child-${Date.now()}`,
        role: 'child',
        content: action.content,
      };
      return { ...state, messages: [...state.messages, childMsg] };
    }

    case 'START_AI_STREAMING': {
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: '',
        isStreaming: true,
      };
      return { ...state, messages: [...state.messages, aiMsg], isStreaming: true };
    }

    case 'ADD_FAIRY_PRAISE': {
      return { ...state, fairyPraise: action.content };
    }

    case 'APPEND_NARRATIVE_CHUNK': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'ai' && last.isStreaming) {
        msgs[msgs.length - 1] = {
          ...last,
          content: last.content + (action.text || ''),
        };
      }
      return { ...state, messages: msgs };
    }

    case 'APPEND_ENDING': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'ai') {
        msgs[msgs.length - 1] = {
          ...last,
          content: last.content + (action.text || ''),
          isStreaming: false,
          isEnding: true,
        };
      }
      // Add ending as highlight message
      const endMsg: ChatMessage = {
        id: `ai-ending-${Date.now()}`,
        role: 'ai',
        content: action.text || '',
        isEnding: true,
      };
      return { ...state, messages: [...msgs, endMsg], isStreaming: false };
    }

    case 'SET_AI_QUESTION': {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === 'ai') {
        msgs[lastIdx] = { ...msgs[lastIdx], isStreaming: false };
      }
      // Add question as a separate highlighted message
      const qMsg: ChatMessage = {
        id: `ai-q-${Date.now()}`,
        role: 'ai',
        content: action.text,
        isQuestion: true,
      };
      return { ...state, messages: [...msgs, qMsg] };
    }

    case 'FINISH_TURN':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.role === 'ai' && message.isStreaming
            ? { ...message, isStreaming: false }
            : message,
        ),
        isStreaming: false,
        turnNumber: action.turnNumber,
        isEnding: action.isEnding,
      };

    case 'FAIL_TURN':
      return {
        ...state,
        messages: state.messages.filter(
          (message) => !(message.role === 'ai' && message.isStreaming && !message.content),
        ),
        isStreaming: false,
        safetyNotice: { message: action.message, level: 'moderate' },
      };

    case 'SHOW_SAFETY_NOTICE':
      return {
        ...state,
        safetyNotice: { message: action.message, level: action.level },
      };

    case 'REDACT_LAST_CHILD_MESSAGE': {
      const messages = [...state.messages];
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'child') {
          messages[index] = {
            ...messages[index],
            content: action.content,
          };
          break;
        }
      }
      return { ...state, messages };
    }

    case 'REMOVE_BLOCKED_TURN': {
      const messages = [...state.messages];
      if (
        messages.length > 0
        && messages[messages.length - 1].role === 'ai'
        && messages[messages.length - 1].isStreaming
      ) {
        messages.pop();
      }
      if (messages.length > 0 && messages[messages.length - 1].role === 'child') {
        messages.pop();
      }
      return { ...state, messages, isStreaming: false };
    }

    case 'DISMISS_SAFETY_NOTICE':
      return {
        ...state,
        safetyNotice: null,
      };

    case 'RESTORE_MESSAGES':
      return {
        ...state,
        messages: action.messages,
        turnNumber: action.turnNumber,
        isEnding: action.isEnding,
        fairyPraise: action.fairyPraise ?? '',
      };

    case 'RESET':
      return {
        storyId: null,
        messages: [],
        turnNumber: 0,
        isStreaming: false,
        isEnding: false,
        safetyNotice: null,
        fairyPraise: '',
      };

    default:
      return state;
  }
}

// ── Context ──

const StoryContext = createContext<{
  state: TurnState;
  dispatch: Dispatch<TurnAction>;
}>({
  state: { storyId: null, messages: [], turnNumber: 0, isStreaming: false, isEnding: false, safetyNotice: null, fairyPraise: '' },
  dispatch: () => {},
});

export function StoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(turnReducer, {
    storyId: null,
    messages: [],
    turnNumber: 0,
    isStreaming: false,
    isEnding: false,
    safetyNotice: null,
    fairyPraise: '',
  });

  return (
    <StoryContext.Provider value={{ state, dispatch }}>
      {children}
    </StoryContext.Provider>
  );
}

export function useStoryState() {
  return useContext(StoryContext);
}
