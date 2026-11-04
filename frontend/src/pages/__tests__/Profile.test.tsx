import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Profile } from '../Profile';
import * as AuthContextModule from '../../context/AuthContext';
import { authApi } from '../../services/api';
import { LoginInput, RegisterInput, User } from '../../types';

jest.mock('../../services/api', () => ({
  authApi: {
    updateProfile: jest.fn<ReturnType<typeof authApi.updateProfile>, Parameters<typeof authApi.updateProfile>>(),
    changePassword: jest.fn<ReturnType<typeof authApi.changePassword>, Parameters<typeof authApi.changePassword>>(),
  },
  ApiError: class ApiError extends Error {
    constructor(public message: string, public statusCode: number = 400) {
      super(message);
    }
  },
}));

describe('Profile Page Component', () => {
  const mockUser: User = {
    id: 'user-123',
    name: 'Jane Doe',
    email: 'jane@example.com',
  };
  const mockUpdateUser = jest.fn<void, [User]>();
  const mockUpdateToken = jest.fn<void, [string]>();
  const mockRefreshUser = jest.fn<Promise<void>, []>();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
      loading: false,
      login: jest.fn<Promise<void>, [LoginInput]>(),
      register: jest.fn<Promise<void>, [RegisterInput]>(),
      logout: jest.fn<Promise<void>, []>(),
      updateUser: mockUpdateUser,
      updateToken: mockUpdateToken,
      refreshUser: mockRefreshUser,
    });
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <Profile />
      </BrowserRouter>
    );
  };

  it('renders profile hero, personal information form, and change password form', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personal Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Security & Password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Doe');
    expect(screen.getByLabelText(/email address/i)).toHaveValue('jane@example.com');
  });

  it('updates personal information and calls updateUser context', async () => {
    const updatedUser: User = { id: 'user-123', name: 'Jane Smith', email: 'jane.smith@example.com' };
    jest.mocked(authApi.updateProfile).mockResolvedValueOnce({ user: updatedUser });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane.smith@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    try {
      await waitFor(() => {
        expect(authApi.updateProfile).toHaveBeenCalledWith({
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
        });
        expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });
    } catch (error) {
      throw new Error(
        `Profile personal-info update test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  it('validates change password form fields', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    try {
      expect(await screen.findByText('Current password is required')).toBeInTheDocument();
      expect(screen.getByText('New password is required')).toBeInTheDocument();
      expect(screen.getByText('Confirmation password is required')).toBeInTheDocument();
      expect(authApi.changePassword).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(
        `Profile password-validation test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  it('validates password mismatch when new password and confirmation password differ', async () => {
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/enter current password/i), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter new strong password/i), {
      target: { value: 'NewPassword456!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm new password/i), {
      target: { value: 'DifferentPassword789!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    try {
      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
      expect(authApi.changePassword).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(
        `Profile password-mismatch test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  it('submits change password successfully, updates token session, and clears input fields', async () => {
    const newToken = 'replacement-jwt-token';
    jest.mocked(authApi.changePassword).mockResolvedValueOnce({ token: newToken });

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/enter current password/i), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter new strong password/i), {
      target: { value: 'NewPassword456!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm new password/i), {
      target: { value: 'NewPassword456!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^change password$/i }));

    try {
      await waitFor(() => {
        expect(authApi.changePassword).toHaveBeenCalledWith({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        });
        expect(mockUpdateToken).toHaveBeenCalledWith(newToken);
        expect(screen.getByText(/password changed successfully!/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/enter current password/i)).toHaveValue('');
        expect(screen.getByPlaceholderText(/enter new strong password/i)).toHaveValue('');
        expect(screen.getByPlaceholderText(/confirm new password/i)).toHaveValue('');
      });
    } catch (error) {
      throw new Error(
        `Profile password-change success test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  it('renders elegant back to dashboard link', () => {
    renderComponent();

    const backLink = screen.getByRole('link', { name: /back to dashboard/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/');
  });
});
