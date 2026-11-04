import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiShield, FiCheckCircle, FiAlertCircle, FiSave, FiKey, FiArrowLeft } from 'react-icons/fi';
import { ApiError, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrengthIndicator } from '../components/PasswordStrengthIndicator';

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export const Profile: React.FC = () => {
  const { user, updateUser, updateToken } = useAuth();

  // Personal Info Form State
  const [name, setName] = useState<string>(user?.name || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [infoErrors, setInfoErrors] = useState<{ name?: string; email?: string }>({});
  const [infoServerError, setInfoServerError] = useState<string | null>(null);
  const [infoSuccessMessage, setInfoSuccessMessage] = useState<string | null>(null);
  const [isSavingInfo, setIsSavingInfo] = useState<boolean>(false);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // Validate Personal Info Form
  const validateInfoForm = (): boolean => {
    const errors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    setInfoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Personal Info Update
  const handleInfoSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setInfoServerError(null);
    setInfoSuccessMessage(null);

    if (!validateInfoForm()) {
      return;
    }

    setIsSavingInfo(true);

    try {
      const response = await authApi.updateProfile({
        name: name.trim(),
        email: email.trim(),
      });
      updateUser(response.user);
      setInfoSuccessMessage('Profile updated successfully!');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setInfoServerError(err.message);
      } else {
        setInfoServerError('An unexpected error occurred while updating profile.');
      }
    } finally {
      setIsSavingInfo(false);
    }
  };

  // Validate Change Password Form
  const validatePasswordForm = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long';
    } else if (newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirmation password is required';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Change Password
  const handlePasswordSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPasswordServerError(null);
    setPasswordSuccessMessage(null);

    if (!validatePasswordForm()) {
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      if (response?.token) {
        updateToken?.(response.token);
      }

      setPasswordSuccessMessage('Password changed successfully! Keep your account credentials safe.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPasswordServerError(err.message);
      } else {
        setPasswordServerError('An unexpected error occurred while changing password.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="profile-page-container">
      {/* Top Header Row with Back Button */}
      <div className="profile-top-bar">
        <Link to="/" className="btn btn-secondary profile-back-btn" aria-label="Back to Dashboard">
          <FiArrowLeft style={{ marginRight: '0.4rem' }} /> Back to Dashboard
        </Link>
      </div>

      {/* Profile Header Card */}
      <div className="profile-card profile-hero-card">
        <div className="profile-hero-avatar">{userInitial}</div>
        <div className="profile-hero-info">
          <h1 className="profile-hero-name">{user?.name || 'User Profile'}</h1>
          <p className="profile-hero-email">{user?.email}</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Personal Information Card */}
        <div className="profile-card">
          <div className="profile-section-header">
            <h2 className="profile-section-title">
              <FiUser style={{ marginRight: '0.5rem' }} /> Personal Information
            </h2>
            <p className="profile-section-subtitle">
              Update your account name and email address.
            </p>
          </div>

          {infoSuccessMessage && (
            <div className="alert-banner alert-banner-success" role="status">
              <FiCheckCircle aria-hidden="true" />
              <span>{infoSuccessMessage}</span>
            </div>
          )}

          {infoServerError && (
            <div className="alert-banner alert-banner-danger" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{infoServerError}</span>
            </div>
          )}

          <form onSubmit={handleInfoSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                className={`form-input ${infoErrors.name ? 'is-invalid' : ''}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (infoErrors.name) {
                    setInfoErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                disabled={isSavingInfo}
                aria-invalid={!!infoErrors.name}
                aria-describedby={infoErrors.name ? 'profile-name-error' : undefined}
                required
              />
              {infoErrors.name && (
                <div id="profile-name-error" className="field-error" role="alert">
                  {infoErrors.name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-email">
                Email Address
              </label>
              <input
                id="profile-email"
                type="email"
                className={`form-input ${infoErrors.email ? 'is-invalid' : ''}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (infoErrors.email) {
                    setInfoErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                disabled={isSavingInfo}
                aria-invalid={!!infoErrors.email}
                aria-describedby={infoErrors.email ? 'profile-email-error' : undefined}
                required
              />
              {infoErrors.email && (
                <div id="profile-email-error" className="field-error" role="alert">
                  {infoErrors.email}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingInfo}
            >
              {isSavingInfo ? (
                <>
                  <span className="spinner spinner-sm"></span>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <FiSave style={{ marginRight: '0.35rem' }} /> Save Changes
                </>
              )}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="profile-card">
          <div className="profile-section-header">
            <h2 className="profile-section-title">
              <FiShield style={{ marginRight: '0.5rem' }} /> Security & Password
            </h2>
            <p className="profile-section-subtitle">
              Keep your account secure by using a strong, unique password.
            </p>
          </div>

          {passwordSuccessMessage && (
            <div className="alert-banner alert-banner-success" role="status">
              <FiCheckCircle aria-hidden="true" />
              <span>{passwordSuccessMessage}</span>
            </div>
          )}

          {passwordServerError && (
            <div className="alert-banner alert-banner-danger" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{passwordServerError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="current-password">
                Current Password
              </label>
              <PasswordInput
                id="current-password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (passwordErrors.currentPassword) {
                    setPasswordErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
                disabled={isChangingPassword}
                error={passwordErrors.currentPassword}
                autoComplete="current-password"
                required
              />
              {passwordErrors.currentPassword && (
                <div id="current-password-error" className="field-error" role="alert">
                  {passwordErrors.currentPassword}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                New Password
              </label>
              <PasswordInput
                id="new-password"
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordErrors.newPassword) {
                    setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                }}
                disabled={isChangingPassword}
                error={passwordErrors.newPassword}
                autoComplete="new-password"
                required
              />
              {passwordErrors.newPassword && (
                <div id="new-password-error" className="field-error" role="alert">
                  {passwordErrors.newPassword}
                </div>
              )}

              {/* Reusable Password Strength Indicator */}
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <PasswordInput
                id="confirm-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordErrors.confirmPassword) {
                    setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                disabled={isChangingPassword}
                error={passwordErrors.confirmPassword}
                autoComplete="new-password"
                required
              />
              {passwordErrors.confirmPassword && (
                <div id="confirm-password-error" className="field-error" role="alert">
                  {passwordErrors.confirmPassword}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <span className="spinner spinner-sm"></span>
                  <span>Changing Password...</span>
                </>
              ) : (
                <>
                  <FiKey style={{ marginRight: '0.35rem' }} /> Change Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
