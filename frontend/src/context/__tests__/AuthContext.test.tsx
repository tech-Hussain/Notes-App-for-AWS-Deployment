import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '../../services/api';

import { ApiError } from '../../services/api';

jest.mock('../../services/api', () => {
  const originalModule = jest.requireActual<typeof import('../../services/api')>('../../services/api');
  return {
    ...originalModule,
    ApiError: originalModule.ApiError,
    authApi: {
      register: jest.fn<ReturnType<typeof originalModule.authApi.register>, Parameters<typeof originalModule.authApi.register>>(),
      login: jest.fn<ReturnType<typeof originalModule.authApi.login>, Parameters<typeof originalModule.authApi.login>>(),
      getMe: jest.fn<ReturnType<typeof originalModule.authApi.getMe>, Parameters<typeof originalModule.authApi.getMe>>(),
      updateProfile: jest.fn<ReturnType<typeof originalModule.authApi.updateProfile>, Parameters<typeof originalModule.authApi.updateProfile>>(),
      changePassword: jest.fn<ReturnType<typeof originalModule.authApi.changePassword>, Parameters<typeof originalModule.authApi.changePassword>>(),
      logout: jest.fn<ReturnType<typeof originalModule.authApi.logout>, Parameters<typeof originalModule.authApi.logout>>(),
    },
    setOnUnauthorizedCallback: jest.fn<ReturnType<typeof originalModule.setOnUnauthorizedCallback>, Parameters<typeof originalModule.setOnUnauthorizedCallback>>(),
  };
});

// Helper component to consume useAuth hook in tests
const TestConsumer: React.FC = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="auth-state">
        {auth.loading ? 'loading' : auth.isAuthenticated ? 'authenticated' : 'unauthenticated'}
      </div>
      <div data-testid="user-name">{auth.user?.name || 'no-user'}</div>
      <div data-testid="token">{auth.token || 'no-token'}</div>

      <button
        type="button"
        onClick={async () => {
          try {
            await auth.login({ email: 'test@example.com', password: 'password123' });
          } catch {
            // handle error in test if needed
          }
        }}
      >
        LoginBtn
      </button>

      <button
        type="button"
        onClick={async () => {
          try {
            await auth.register({ name: 'Reg User', email: 'reg@example.com', password: 'password123' });
          } catch {
            // handle error in test
          }
        }}
      >
        RegisterBtn
      </button>

      <button
        type="button"
        onClick={async () => {
          try {
            await auth.logout();
          } catch {
            // handle error in test
          }
        }}
      >
        LogoutBtn
      </button>

      <button
        type="button"
        onClick={() => {
          auth.updateUser({ id: '1', name: 'Updated Name', email: 'updated@example.com' });
        }}
      >
        UpdateUserBtn
      </button>

      <button
        type="button"
        onClick={() => {
          auth.updateToken?.('new-manually-updated-token');
        }}
      >
        UpdateTokenBtn
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  const validTokenPayload = { exp: Math.floor(Date.now() / 1000) + 3600 };
  const expiredTokenPayload = { exp: Math.floor(Date.now() / 1000) - 3600 };

  const createJwtToken = (payload: Record<string, unknown>): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    return `${header}.${body}.signature`;
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('throws error when useAuth is used outside of AuthProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    consoleErrorSpy.mockRestore();
  });

  it('initializes as unauthenticated when no token exists in localStorage', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });
      expect(screen.getByTestId('user-name')).toHaveTextContent('no-user');
    } catch (error) {
      throw new Error(`AuthContext no token initialization test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('initializes as unauthenticated when token in localStorage is expired', async () => {
    const expiredToken = createJwtToken(expiredTokenPayload);
    localStorage.setItem('token', expiredToken);
    jest.mocked(authApi.getMe).mockRejectedValue(new ApiError('Token expired', 401));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });
      expect(localStorage.getItem('token')).toBeNull();
    } catch (error) {
      throw new Error(`AuthContext expired token initialization test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('fetches authenticated user when valid token exists in localStorage', async () => {
    const validToken = createJwtToken(validTokenPayload);
    localStorage.setItem('token', validToken);

    jest.mocked(authApi.getMe).mockResolvedValue({
      user: { id: 'u1', name: 'Existing User', email: 'exist@example.com' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });
      expect(screen.getByTestId('user-name')).toHaveTextContent('Existing User');
    } catch (error) {
      throw new Error(`AuthContext valid token fetch test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('clears token when getMe fails during initialization with 401', async () => {
    const validToken = createJwtToken(validTokenPayload);
    localStorage.setItem('token', validToken);

    jest.mocked(authApi.getMe).mockRejectedValue(new ApiError('Unauthorized', 401));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });
      expect(localStorage.getItem('token')).toBeNull();
    } catch (error) {
      throw new Error(`AuthContext 401 initialization failure test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('handles login successfully', async () => {
    jest.mocked(authApi.login).mockResolvedValue({
      token: 'new-token-123',
      user: { id: 'u2', name: 'Logged User', email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      await act(async () => {
        screen.getByText('LoginBtn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });
      expect(screen.getByTestId('user-name')).toHaveTextContent('Logged User');
      expect(localStorage.getItem('token')).toBe('new-token-123');
    } catch (error) {
      throw new Error(`AuthContext login success test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('handles register successfully', async () => {
    jest.mocked(authApi.register).mockResolvedValue({
      token: 'reg-token-456',
      user: { id: 'u3', name: 'Reg User', email: 'reg@example.com' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      await act(async () => {
        screen.getByText('RegisterBtn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });
      expect(screen.getByTestId('user-name')).toHaveTextContent('Reg User');
      expect(localStorage.getItem('token')).toBe('reg-token-456');
    } catch (error) {
      throw new Error(`AuthContext register success test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('handles logout successfully', async () => {
    const validToken = createJwtToken(validTokenPayload);
    localStorage.setItem('token', validToken);

    jest.mocked(authApi.getMe).mockResolvedValue({
      user: { id: 'u1', name: 'User 1', email: 'u1@example.com' },
    });
    jest.mocked(authApi.logout).mockResolvedValue({ userId: 'u1' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });

      await act(async () => {
        screen.getByText('LogoutBtn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });
      expect(localStorage.getItem('token')).toBeNull();
    } catch (error) {
      throw new Error(`AuthContext logout success test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('allows updating user profile in state', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      act(() => {
        screen.getByText('UpdateUserBtn').click();
      });

      expect(screen.getByTestId('user-name')).toHaveTextContent('Updated Name');
    } catch (error) {
      throw new Error(`AuthContext update user profile test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('allows updating token in state and localStorage', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    try {
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      act(() => {
        screen.getByText('UpdateTokenBtn').click();
      });

      expect(screen.getByTestId('token')).toHaveTextContent('new-manually-updated-token');
      expect(localStorage.getItem('token')).toBe('new-manually-updated-token');
    } catch (error) {
      throw new Error(`AuthContext update token test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});
