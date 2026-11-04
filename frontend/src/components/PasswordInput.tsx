import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export interface PasswordInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  'aria-describedby'?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'Enter password',
  disabled = false,
  error,
  autoComplete = 'current-password',
  required = false,
  'aria-describedby': ariaDescribedBy,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = (): void => {
    setShowPassword((prev) => !prev);
  };

  const describedByIds = [
    error ? `${id}-error` : undefined,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="password-input-wrapper">
      <input
        id={id}
        name={name || id}
        type={showPassword ? 'text' : 'password'}
        className={`form-input password-input-field ${error ? 'is-invalid' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={describedByIds || undefined}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={toggleShowPassword}
        disabled={disabled}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={0}
      >
        {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
      </button>
    </div>
  );
};
