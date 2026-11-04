import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { FiBookOpen } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { ProfileDropdown } from './ProfileDropdown';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <header className="app-header">
        <Link to="/" className="header-brand header-brand-link" aria-label="NoteNest Home">
          <div className="brand-icon">
            <FiBookOpen aria-hidden="true" />
          </div>
          <span className="brand-name">NoteNest</span>
        </Link>

        {user && (
          <div className="header-user-actions">
            <ProfileDropdown user={user} onLogout={logout} />
          </div>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};
