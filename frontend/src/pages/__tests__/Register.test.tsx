import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, NavigateFunction } from 'react-router-dom';
import { Register } from '../Register';
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

describe('Register (Signup) Component', () => {
  const mockRegister = jest.fn<Promise<void>, [RegisterInput]>();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      login: jest.fn<Promise<void>, [LoginInput]>(),
      register: mockRegister,
      logout: jest.fn<Promise<void>, []>(),
      updateUser: jest.fn<void, [User]>(),
      refreshUser: jest.fn<Promise<void>, []>(),
    });
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    );
  };

  it('renders registration form elements correctly', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('validates missing name, invalid email, password under 8 characters, and missing confirm password', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bad-email' } });
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    try {
      expect(await screen.findByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
      expect(screen.getByText('Confirm Password is required')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`Register form validation test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('validates mismatched confirm password', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice Smith' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'securepassword123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'mismatched123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    try {
      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`Register mismatched password test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('submits valid registration details and navigates to home', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    renderComponent();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice Smith' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'securepassword123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'securepassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    try {
      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          name: 'Alice Smith',
          email: 'alice@example.com',
          password: 'securepassword123',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    } catch (error) {
      throw new Error(`Register submission test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('displays server error banner on duplicate registration error', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email is already registered'));
    renderComponent();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice Smith' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'securepassword123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'securepassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    try {
      expect(await screen.findByText('Email is already registered')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`Register server error banner test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('displays password strength indicator and updates as user types', () => {
    renderComponent();

    const passwordInput = screen.getByPlaceholderText('At least 8 characters');
    fireEvent.change(passwordInput, { target: { value: 'Pass123!' } });

    expect(screen.getByText(/password strength:/i)).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});
