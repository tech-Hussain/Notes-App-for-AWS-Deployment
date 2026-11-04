import { ApiError, authApi, notesApi, setOnUnauthorizedCallback } from '../api';

type MockResponseInit =
  | { ok?: boolean; status?: number; json: () => Promise<unknown> }
  | unknown;

function createMockResponse(payloadOrInit: MockResponseInit, status = 200, ok = true): Response {
  let isOk = ok;
  let responseStatus = status;
  let jsonFn: () => Promise<unknown>;

  if (
    payloadOrInit !== null &&
    typeof payloadOrInit === 'object' &&
    ('json' in payloadOrInit || 'ok' in payloadOrInit || 'status' in payloadOrInit)
  ) {
    const init = payloadOrInit as { ok?: boolean; status?: number; json: () => Promise<unknown> };
    isOk = init.ok ?? ok;
    responseStatus = init.status ?? status;
    jsonFn = init.json;
  } else {
    jsonFn = async () => payloadOrInit;
  }

  return {
    ok: isOk,
    status: responseStatus,
    json: jsonFn,
    headers: new Headers(),
    redirected: false,
    statusText: isOk ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    text: jest.fn(),
  } as unknown as Response;
}

function createFetchMock(): jest.MockedFunction<typeof globalThis.fetch> {
  return jest.fn() as jest.MockedFunction<typeof globalThis.fetch>;
}

describe('api.ts service layer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    setOnUnauthorizedCallback(null);
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('ApiError', () => {
    it('creates an instance of ApiError with message and status', () => {
      const err = new ApiError('Not found', 404);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.name).toBe('ApiError');
      expect(err.message).toBe('Not found');
      expect(err.status).toBe(404);
    });
  });

  describe('request helper via authApi', () => {
    it('includes Authorization header when token is stored in localStorage', async () => {
      localStorage.setItem('token', 'fake-jwt-token');

      const fetchMock = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          message: 'Success',
          data: { user: { id: '1', name: 'Test', email: 'test@example.com' } },
        })
      );
      globalThis.fetch = fetchMock;

      try {
        const res = await authApi.getMe();
        expect(res.user.name).toBe('Test');
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/auth/me'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer fake-jwt-token',
              'Content-Type': 'application/json',
            }),
          })
        );
      } catch (err: unknown) {
        throw new Error(`getMe authorization header test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('throws Network ApiError when fetch rejects', async () => {
      globalThis.fetch = createFetchMock().mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await expect(authApi.getMe()).rejects.toThrow(ApiError);
        await expect(authApi.getMe()).rejects.toThrow('Network error');
      } catch (err: unknown) {
        throw new Error(`Network ApiError fetch rejection test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('re-throws ApiError intact if fetch throws ApiError instance', async () => {
      const apiErr = new ApiError('Custom error', 500);
      globalThis.fetch = createFetchMock().mockRejectedValue(apiErr);

      try {
        await expect(authApi.getMe()).rejects.toThrow(apiErr);
      } catch (err: unknown) {
        throw new Error(`Re-throw ApiError test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('throws ApiError when response JSON parsing fails', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 502,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        })
      );

      try {
        await expect(authApi.getMe()).rejects.toThrow('An unexpected server response was received.');
      } catch (err: unknown) {
        throw new Error(`JSON parsing failure test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('throws ApiError when parsed json is not an object', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => 'string response',
        })
      );

      try {
        await expect(authApi.getMe()).rejects.toThrow('An unexpected server response was received.');
      } catch (err: unknown) {
        throw new Error(`Non-object JSON response test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('triggers onUnauthorizedCallback on 401 response status', async () => {
      const mockCallback = jest.fn<
        ReturnType<NonNullable<Parameters<typeof setOnUnauthorizedCallback>[0]>>,
        Parameters<NonNullable<Parameters<typeof setOnUnauthorizedCallback>[0]>>
      >();
      setOnUnauthorizedCallback(mockCallback);

      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            message: 'Unauthorized access token',
          }),
        })
      );

      try {
        await expect(authApi.getMe()).rejects.toThrow('Unauthorized access token');
        expect(mockCallback).toHaveBeenCalledTimes(1);
      } catch (err: unknown) {
        throw new Error(`401 unauthorized callback test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('uses fallback error message when success is false without custom message', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
          }),
        })
      );

      try {
        await expect(authApi.getMe()).rejects.toThrow('Request failed with status 400');
      } catch (err: unknown) {
        throw new Error(`Fallback error message test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  });

  describe('authApi methods', () => {
    it('register calls POST /auth/register', async () => {
      const fetchMock = createFetchMock().mockResolvedValue(
        createMockResponse(
          {
            success: true,
            data: { token: 't1', user: { id: '1', name: 'N', email: 'e@test.com' } },
          },
          201
        )
      );
      globalThis.fetch = fetchMock;

      try {
        const res = await authApi.register({ name: 'N', email: 'e@test.com', password: 'password123' });
        expect(res.token).toBe('t1');
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/auth/register'),
          expect.objectContaining({ method: 'POST' })
        );
      } catch (err: unknown) {
        throw new Error(`register method test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('login calls POST /auth/login', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { token: 't1', user: { id: '1', name: 'N', email: 'e@test.com' } },
        })
      );

      try {
        const res = await authApi.login({ email: 'e@test.com', password: 'password123' });
        expect(res.token).toBe('t1');
      } catch (err: unknown) {
        throw new Error(`login method test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('updateProfile calls PUT /auth/profile', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { user: { id: '1', name: 'New Name', email: 'e@test.com' } },
        })
      );

      try {
        const res = await authApi.updateProfile({ name: 'New Name', email: 'e@test.com' });
        expect(res.user.name).toBe('New Name');
      } catch (err: unknown) {
        throw new Error(`updateProfile method test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('changePassword calls PUT /auth/change-password', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { token: 'new-token' },
        })
      );

      try {
        const res = await authApi.changePassword({ currentPassword: 'p1', newPassword: 'p2' });
        expect(res.token).toBe('new-token');
      } catch (err: unknown) {
        throw new Error(`changePassword method test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('logout calls POST /auth/logout', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { userId: '1' },
        })
      );

      try {
        const res = await authApi.logout();
        expect(res.userId).toBe('1');
      } catch (err: unknown) {
        throw new Error(`logout method test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  });

  describe('notesApi methods', () => {
    it('list appends query params when provided', async () => {
      const fetchMock = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { notes: [], total: 0, page: 1, limit: 10, totalPages: 0 },
        })
      );
      globalThis.fetch = fetchMock;

      try {
        await notesApi.list({ search: 'query', page: 2, limit: 5, sortBy: 'title', sortOrder: 'asc' });

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/notes?search=query&page=2&limit=5&sortBy=title&sortOrder=asc'),
          expect.objectContaining({ method: 'GET' })
        );
      } catch (err: unknown) {
        throw new Error(`notesApi.list with query params test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('list calls /notes without params when query is empty', async () => {
      const fetchMock = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { notes: [], total: 0, page: 1, limit: 10, totalPages: 0 },
        })
      );
      globalThis.fetch = fetchMock;

      try {
        await notesApi.list();

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringMatching(/\/notes$/),
          expect.objectContaining({ method: 'GET' })
        );
      } catch (err: unknown) {
        throw new Error(`notesApi.list without params test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('getById calls GET /notes/:id', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { note: { id: 'n1', title: 'Note 1', content: 'Content', userId: 'u1', createdAt: '', updatedAt: '' } },
        })
      );

      try {
        const res = await notesApi.getById('n1');
        expect(res.note.id).toBe('n1');
      } catch (err: unknown) {
        throw new Error(`notesApi.getById test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('create calls POST /notes', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse(
          {
            success: true,
            data: { note: { id: 'n1', title: 'Title', content: 'Content', userId: 'u1', createdAt: '', updatedAt: '' } },
          },
          201
        )
      );

      try {
        const res = await notesApi.create({ title: 'Title', content: 'Content' });
        expect(res.note.title).toBe('Title');
      } catch (err: unknown) {
        throw new Error(`notesApi.create test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('update calls PUT /notes/:id', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { note: { id: 'n1', title: 'Updated Title', content: 'Content', userId: 'u1', createdAt: '', updatedAt: '' } },
        })
      );

      try {
        const res = await notesApi.update('n1', { title: 'Updated Title' });
        expect(res.note.title).toBe('Updated Title');
      } catch (err: unknown) {
        throw new Error(`notesApi.update test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    it('delete calls DELETE /notes/:id', async () => {
      globalThis.fetch = createFetchMock().mockResolvedValue(
        createMockResponse({
          success: true,
          data: { message: 'Note deleted', noteId: 'n1' },
        })
      );

      try {
        const res = await notesApi.delete('n1');
        expect(res.noteId).toBe('n1');
      } catch (err: unknown) {
        throw new Error(`notesApi.delete test failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  });
});
