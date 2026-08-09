// Dev: Vite proxy handles /api → localhost:8000
// Prod: set VITE_API_URL to your backend URL, e.g. https://your-backend.onrender.com
const BASE_URL = (import.meta.env.VITE_API_URL || '') + '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  // Safe JSON parse — backend may return plain text on unhandled errors
  let data: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new ApiError(text.slice(0, 200) || `服务器错误 (HTTP ${response.status})`, response.status);
  }

  if (!response.ok) {
    throw new ApiError(data?.detail || `请求失败 (HTTP ${response.status})`, response.status);
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export { BASE_URL, getToken };
