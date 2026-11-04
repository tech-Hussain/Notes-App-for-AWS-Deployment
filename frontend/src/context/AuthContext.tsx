import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiError, authApi, setOnUnauthorizedCallback } from '../services/api';
import { LoginInput, RegisterInput, User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  updateToken?: (token: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>((): string | null => localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  const handleUnauthorized = (): void => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  useEffect((): (() => void) => {
    setOnUnauthorizedCallback(handleUnauthorized);
    return (): void => setOnUnauthorizedCallback(null);
  }, []);

  const refreshUser = async (): Promise<void> => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setUser(null);
      setToken(null);
      return;
    }

    try {
      const response = await authApi.getMe();
      setUser(response.user);
      setToken(storedToken);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
      }
    }
  };

  useEffect((): void => {
    const initializeAuth = async (): Promise<void> => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe();
        setUser(response.user);
        setToken(storedToken);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          handleUnauthorized();
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const updateUser = (updatedUser: User): void => {
    setUser(updatedUser);
  };

  const updateToken = (newToken: string): void => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const login = async (input: LoginInput): Promise<void> => {
    try {
      const response = await authApi.login(input);
      if (response.token) {
        localStorage.setItem('token', response.token);
        setToken(response.token);
      }
      setUser(response.user);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError('Authentication failed. Please try again.', 500);
    }
  };

  const register = async (input: RegisterInput): Promise<void> => {
    try {
      const response = await authApi.register(input);
      if (response.token) {
        localStorage.setItem('token', response.token);
        setToken(response.token);
      }
      setUser(response.user);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError('Registration failed. Please try again.', 500);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout backend errors (e.g. already revoked)
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        login,
        register,
        logout,
        updateUser,
        updateToken,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
