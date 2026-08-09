import { apiFetch, BASE_URL, getToken } from './client';

// ── Types ──

export interface User {
  id: number;
  username: string;
  display_name: string | null;
  age_group: string | null;
  created_at: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  show_onboarding: boolean;
}

export interface Character {
  id: number;
  user_id: number;
  nickname: string;
  avatar_type: string;
  avatar_color: string;
  personality: string | null;
  age_group: string | null;
  created_at: string | null;
}

export interface Story {
  id: number;
  character_id: number;
  title: string | null;
  theme: string | null;
  status: string;
  turn_count: number;
  full_text: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoryMessage {
  id: number;
  story_id: number;
  turn_number: number;
  role: 'ai' | 'child';
  content: string;
  ai_raw_response?: string | null;
  created_at: string | null;
}

export interface Observation {
  id: number;
  story_id: number;
  message_id: number;
  turn_number: number;
  vocabulary_richness: number | null;
  vocabulary_examples: string | null;
  descriptive_ability: number | null;
  descriptive_examples: string | null;
  story_structure: number | null;
  structure_note: string | null;
  creativity_flags: string | null;
  created_at: string | null;
}

export interface ObservationSummary {
  story_id: number;
  total_turns: number;
  avg_vocabulary_richness: number | null;
  avg_descriptive_ability: number | null;
  avg_story_structure: number | null;
  all_creativity_flags: string[];
  highlights: string[];
}

// ── Auth ──

export function register(username: string, password: string, displayName?: string) {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, display_name: displayName }),
  });
}

export function login(username: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getMe() {
  return apiFetch<User>('/auth/me');
}

// ── Characters ──

export function listCharacters() {
  return apiFetch<Character[]>('/characters');
}

export function createCharacter(data: { nickname: string; avatar_type: string; avatar_color: string; personality?: string; age_group: '4-7' | '8-12' }) {
  return apiFetch<Character>('/characters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCharacter(id: number, data: { age_group: '4-7' | '8-12' }) {
  return apiFetch<Character>(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCharacter(id: number) {
  return apiFetch<void>(`/characters/${id}`, { method: 'DELETE' });
}

// ── Stories ──

export function listStories(params?: { character_id?: number; status?: string }) {
  const search = new URLSearchParams();
  if (params?.character_id) search.set('character_id', String(params.character_id));
  if (params?.status) search.set('status', params.status);
  const qs = search.toString();
  return apiFetch<Story[]>(`/stories${qs ? '?' + qs : ''}`);
}

export function createStory(data: { character_id: number; theme?: string; title?: string }) {
  return apiFetch<Story>('/stories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getStory(id: number) {
  return apiFetch<Story>(`/stories/${id}`);
}

export function updateStory(id: number, data: { title?: string; status?: string }) {
  return apiFetch<Story>(`/stories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteStory(id: number) {
  return apiFetch<void>(`/stories/${id}`, { method: 'DELETE' });
}

export function getStoryMessages(id: number) {
  return apiFetch<StoryMessage[]>(`/stories/${id}/messages`);
}

// ── Story Turn (SSE) ──

export function sendStoryTurn(
  storyId: number,
  childInput: string,
  signal?: AbortSignal,
  forceEnding = false,
): Promise<Response> {
  const token = getToken();
  return fetch(`${BASE_URL}/stories/${storyId}/turn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ child_input: childInput, force_ending: forceEnding }),
    signal,
  });
}

// ── Observations ──

export function getObservations(storyId: number) {
  return apiFetch<Observation[]>(`/observations?story_id=${storyId}`);
}

export function getObservationSummary(storyId: number) {
  return apiFetch<ObservationSummary>(`/observations/summary/${storyId}`);
}

export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new Error(`Cloud TTS failed (${response.status})`);
  return response.blob();
}
