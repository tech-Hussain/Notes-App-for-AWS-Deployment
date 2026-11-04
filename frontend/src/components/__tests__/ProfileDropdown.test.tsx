import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, NavigateFunction } from 'react-router-dom';
import { ProfileDropdown } from '../ProfileDropdown';

const mockNavigate = jest.fn<ReturnType<NavigateFunction>, Parameters<NavigateFunction>>();
jest.mock('react-router-dom', () => {
  try {
    const actual = jest.requireActual<typeof import('react-router-dom')>('react-router-dom');
    return {
      ...actual,
      useNavigate: () => mockNavigate,
    };
  } catch (error: unknown) {
    throw new Error(`react-router-dom mock setup failed in ProfileDropdown.test.tsx: ${error instanceof Error ? error.message : String(error)}`);
  }
});

describe('ProfileDropdown Component', () => {
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
  };
  const mockLogout = jest.fn<Promise<void>, []>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <ProfileDropdown user={mockUser} onLogout={mockLogout} />
      </BrowserRouter>
    );
  };

  it('renders avatar trigger button with user name and initial', () => {
    renderComponent();

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('opens dropdown menu when trigger is clicked', () => {
    renderComponent();

    const trigger = screen.getByRole('button', { name: /user menu for john doe/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: /user account menu/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /view profile/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
  });

  it('navigates to /profile when View Profile is clicked', () => {
    renderComponent();

    const trigger = screen.getByRole('button', { name: /user menu for john doe/i });
    fireEvent.click(trigger);

    const viewProfileBtn = screen.getByRole('menuitem', { name: /view profile/i });
    fireEvent.click(viewProfileBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('calls onLogout and navigates to /login on logout', async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    renderComponent();

    const trigger = screen.getByRole('button', { name: /user menu for john doe/i });
    fireEvent.click(trigger);

    const logoutBtn = screen.getByRole('menuitem', { name: /logout/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('closes dropdown when Escape key is pressed', () => {
    renderComponent();

    const trigger = screen.getByRole('button', { name: /user menu for john doe/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
