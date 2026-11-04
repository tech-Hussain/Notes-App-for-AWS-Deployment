import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { User } from '../types';

export interface ProfileDropdownProps {
  user: User;
  onLogout: () => Promise<void>;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : '?';

  const toggleDropdown = (): void => {
    setIsOpen((prev) => !prev);
  };

  const closeDropdown = (): void => {
    setIsOpen(false);
  };

  // Close on Escape key and outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigateProfile = (): void => {
    closeDropdown();
    navigate('/profile');
  };

  const handleLogoutClick = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await onLogout();
      closeDropdown();
      navigate('/login', { replace: true });
    } catch {
      // Handled gracefully
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="profile-dropdown-wrapper" ref={dropdownRef}>
      <button
        ref={triggerButtonRef}
        type="button"
        className="user-profile-badge profile-dropdown-trigger"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`User menu for ${user.name}`}
      >
        <div className="user-avatar" aria-hidden="true">
          {userInitial}
        </div>
        <div className="user-details">
          <span className="user-name">{user.name}</span>
          <span className="user-email">{user.email}</span>
        </div>
        <FiChevronDown className={`dropdown-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="profile-dropdown-menu"
          role="menu"
          aria-label="User account menu"
        >
          <div className="dropdown-user-header">
            <div className="dropdown-user-avatar" aria-hidden="true">
              {userInitial}
            </div>
            <div className="dropdown-user-info">
              <strong className="dropdown-user-name">{user.name}</strong>
              <span className="dropdown-user-email">{user.email}</span>
            </div>
          </div>

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-item"
            role="menuitem"
            onClick={handleNavigateProfile}
          >
            <FiUser className="dropdown-item-icon" aria-hidden="true" />
            <span>View Profile</span>
          </button>

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-item dropdown-item-danger"
            role="menuitem"
            onClick={handleLogoutClick}
            disabled={loggingOut}
          >
            <FiLogOut className="dropdown-item-icon" aria-hidden="true" />
            <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
