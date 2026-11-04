export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface DataSuccessApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface NoContentSuccessApiResponse {
  success: true;
  message: string;
  data?: never;
}

export type SuccessApiResponse<T = void> = T extends void
  ? NoContentSuccessApiResponse
  : DataSuccessApiResponse<T>;

export interface ErrorApiResponse {
  success: false;
  message: string;
}

export type ApiResponse<T = void> = SuccessApiResponse<T> | ErrorApiResponse;

export type AuthApiResponse = DataSuccessApiResponse<AuthResult>;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface Note {
  _id: string;
  id?: string;
  title: string;
  content: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesListResult {
  notes: Note[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface NotesListQuery {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
}

export interface SingleNoteResult {
  note: Note;
}

export interface DeleteNoteResult {
  deleted: boolean;
  noteId: string;
}


