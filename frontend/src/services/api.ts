import {
  ApiResponse,
  AuthResult,
  ChangePasswordInput,
  CreateNoteInput,
  DeleteNoteResult,
  LoginInput,
  NotesListQuery,
  NotesListResult,
  RegisterInput,
  SingleNoteResult,
  UpdateNoteInput,
  UpdateProfileInput,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorizedCallback = (callback: (() => void) | null): void => {
  onUnauthorizedCallback = callback;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your internet connection or server availability.', 0);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new ApiError('An unexpected server response was received.', response.status);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError('An unexpected server response was received.', response.status);
  }

  const data = parsed as ApiResponse<T>;

  if (!response.ok || !data.success) {
    const errorMessage = data.message || `Request failed with status ${response.status}`;

    if (response.status === 401 && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }

    throw new ApiError(errorMessage, response.status);
  }

  return (data.data !== undefined ? data.data : (data as unknown)) as T;
}

export const authApi = {
  register: async (input: RegisterInput): Promise<AuthResult> => {
    return request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login: async (input: LoginInput): Promise<AuthResult> => {
    return request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getMe: async (): Promise<{ user: User }> => {
    return request<{ user: User }>('/auth/me', {
      method: 'GET',
    });
  },

  updateProfile: async (input: UpdateProfileInput): Promise<{ user: User }> => {
    return request<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  changePassword: async (input: ChangePasswordInput): Promise<{ token: string }> => {
    return request<{ token: string }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  logout: async (): Promise<{ userId: string }> => {
    return request<{ userId: string }>('/auth/logout', {
      method: 'POST',
    });
  },
};

export const notesApi = {
  list: (query?: NotesListQuery): Promise<NotesListResult> => {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', query.page.toString());
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const queryString = params.toString();
    const endpoint = queryString ? `/notes?${queryString}` : '/notes';

    return request<NotesListResult>(endpoint, {
      method: 'GET',
    });
  },

  getById: (id: string): Promise<SingleNoteResult> => {
    return request<SingleNoteResult>(`/notes/${id}`, {
      method: 'GET',
    });
  },

  create: (input: CreateNoteInput): Promise<SingleNoteResult> => {
    return request<SingleNoteResult>('/notes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: (id: string, input: UpdateNoteInput): Promise<SingleNoteResult> => {
    return request<SingleNoteResult>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  delete: (id: string): Promise<DeleteNoteResult> => {
    return request<DeleteNoteResult>(`/notes/${id}`, {
      method: 'DELETE',
    });
  },
};

