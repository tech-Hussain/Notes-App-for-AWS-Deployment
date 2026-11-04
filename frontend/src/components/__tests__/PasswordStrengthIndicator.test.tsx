import { render, screen } from '@testing-library/react';
import { PasswordStrengthIndicator } from '../PasswordStrengthIndicator';

describe('PasswordStrengthIndicator Component', () => {
  it('returns null when password is empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Weak badge and failed criteria for simple short password', () => {
    render(<PasswordStrengthIndicator password="abc" />);

    expect(screen.getByText(/password strength:/i)).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('renders Fair badge for moderate password', () => {
    render(<PasswordStrengthIndicator password="Password" />);

    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('renders Good badge for password satisfying four criteria', () => {
    render(<PasswordStrengthIndicator password="Password123" />);

    const badge = screen.getByText('Good');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('strength-badge', 'strength-good');
  });

  it('renders Strong badge when all criteria are satisfied', () => {
    render(<PasswordStrengthIndicator password="Password123!" />);

    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Contains uppercase letter (A-Z)')).toBeInTheDocument();
    expect(screen.getByText('Contains lowercase letter (a-z)')).toBeInTheDocument();
    expect(screen.getByText('Contains a number (0-9)')).toBeInTheDocument();
    expect(screen.getByText('Contains a special character (!@#$...)')).toBeInTheDocument();
  });
});
