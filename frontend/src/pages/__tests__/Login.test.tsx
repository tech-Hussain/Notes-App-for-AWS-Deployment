import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, NavigateFunction } from 'react-router-dom';
import { Login } from '../Login';
import * as AuthContextModule from '../../context/AuthContext';
import { LoginInput, RegisterInput, User } from '../../types';

const mockNavigate = jest.fn<ReturnType<NavigateFunction>, Parameters<NavigateFunction>>();
jest.mock('react-router-dom', () => {
  let actual: typeof import('react-router-dom');
  try {
    actual = jest.requireActual<typeof import('react-router-dom')>('react-router-dom');
  } catch (error) {
    throw new Error(`Failed to import actual react-router-dom module in test setup: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  const mockLogin = jest.fn<Promise<void>, [LoginInput]>();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      login: mockLogin,
      register: jest.fn<Promise<void>, [RegisterInput]>(),
      logout: jest.fn<Promise<void>, []>(),
      updateUser: jest.fn<void, [User]>(),
      updateToken: jest.fn<void, [string]>(),
      refreshUser: jest.fn<Promise<void>, []>(),
    });
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  it('renders login form elements correctly', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
  });

  it('shows validation error messages when submitting empty form', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    try {
      expect(await screen.findByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(mockLogin).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`Login empty form validation test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('shows validation error for invalid email syntax', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    try {
      expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
      expect(mockLogin).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`Login invalid email validation test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('handles successful submission and redirects to dashboard', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderComponent();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    try {
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'user@example.com',
          password: 'password123',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    } catch (error) {
      throw new Error(`Login submission test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('displays server error banner on failed login attempt', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));
    renderComponent();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    try {
      expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`Login server error banner test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});
