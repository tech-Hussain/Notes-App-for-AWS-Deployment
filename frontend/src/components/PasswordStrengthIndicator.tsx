import React from 'react';
import { FiCheck, FiX } from 'react-icons/fi';

export interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export interface PasswordCriterion {
  id: string;
  label: string;
  met: boolean;
}

export const getPasswordCriteria = (password: string): PasswordCriterion[] => {
  return [
    { id: 'min-length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'uppercase', label: 'Contains uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'Contains lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { id: 'number', label: 'Contains a number (0-9)', met: /[0-9]/.test(password) },
    { id: 'special', label: 'Contains a special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ];
};

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export const getStrengthLevel = (criteria: PasswordCriterion[], passwordLength: number): { level: StrengthLevel; label: string; score: number } => {
  if (passwordLength === 0) {
    return { level: 'empty', label: '', score: 0 };
  }

  const passedCount = criteria.filter((c) => c.met).length;

  if (passedCount <= 2) {
    return { level: 'weak', label: 'Weak', score: 1 };
  }
  if (passedCount === 3) {
    return { level: 'fair', label: 'Fair', score: 2 };
  }
  if (passedCount === 4) {
    return { level: 'good', label: 'Good', score: 3 };
  }
  return { level: 'strong', label: 'Strong', score: 4 };
};

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showRequirements = true,
}) => {
  const criteria = getPasswordCriteria(password);
  const { level, label, score } = getStrengthLevel(criteria, password.length);

  if (!password) {
    return null;
  }

  return (
    <div className="password-strength-container" aria-live="polite">
      <div className="password-strength-header">
        <span className="strength-text-label">
          Password strength:{' '}
          <strong className={`strength-badge strength-${level}`}>
            {label}
          </strong>
        </span>
      </div>

      <div className="strength-meter" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4} aria-label={`Password strength is ${label}`}>
        <div className={`meter-bar ${score >= 1 ? `filled fill-${level}` : ''}`} />
        <div className={`meter-bar ${score >= 2 ? `filled fill-${level}` : ''}`} />
        <div className={`meter-bar ${score >= 3 ? `filled fill-${level}` : ''}`} />
        <div className={`meter-bar ${score >= 4 ? `filled fill-${level}` : ''}`} />
      </div>

      {showRequirements && (
        <ul className="password-criteria-list" aria-label="Password requirements">
          {criteria.map((c) => (
            <li
              key={c.id}
              className={`criterion-item ${c.met ? 'criterion-met' : 'criterion-unmet'}`}
            >
              <span className="criterion-icon" aria-hidden="true">
                {c.met ? <FiCheck /> : <FiX />}
              </span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
