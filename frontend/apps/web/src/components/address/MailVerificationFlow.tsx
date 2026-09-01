'use client';

/**
 * MailVerificationFlow — Three-screen mail-based address verification.
 *
 * Screens:
 *   MailVerifyStart   → shows address, "Send verification code" CTA
 *   MailVerifyPending → code sent, countdown timer, "Enter code" CTA
 *   MailVerifyConfirm → 6-digit code input with error states + success celebration
 *
 * Integrates with useMailVerification hook for state management and
 * POST /api/v1/address/verify/mail/{start,confirm} API calls.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { NormalizedAddress, AddressClaim } from '@pantopus/api';
import { useMailVerification } from '@/hooks/useMailVerification';

// ── Props ──────────────────────────────────────────────────

type Props = {
  addressId: string;
  unit?: string;
  normalized?: NormalizedAddress;
  /** Called when verification succeeds */
  onVerified: (claim: AddressClaim | null) => void;
  /** Called when user wants to use landlord invite instead */
  onSwitchToLandlord?: () => void;
  /** Called when user wants to use a different verification method */
  onSwitchMethod?: () => void;
  /** Called when user wants to go back to address entry */
  onBack: () => void;
};

// ── Shared helpers ─────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

// ── Icons ──────────────────────────────────────────────────

const MailIcon = (
  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  </div>
);

const CheckIcon = (
  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  </div>
);

const LockIcon = (
  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  </div>
);

// ── Address card (shared between screens) ──────────────────

function AddressCard({ normalized, unit }: { normalized: NormalizedAddress; unit?: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-app-surface-raised border border-app-border">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-app-text-muted flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
      <div className="min-w-0">
        <p className="font-medium text-app-text">
          {normalized.line1}
          {unit && <span className="text-app-text-secondary">, {unit}</span>}
          {!unit && normalized.line2 && <span className="text-app-text-secondary">, {normalized.line2}</span>}
        </p>
        <p className="text-sm text-app-text-secondary mt-0.5">
          {normalized.city}, {normalized.state} {normalized.zip}
          {normalized.plus4 && `-${normalized.plus4}`}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 1: MailVerifyStart
// ═══════════════════════════════════════════════════════════

function MailVerifyStart({
  normalized,
  unit,
  loading,
  error,
  onSend,
  onSwitchToLandlord,
  onBack,
}: {
  normalized?: NormalizedAddress;
  unit?: string;
  loading: boolean;
  error: string | null;
  onSend: () => void;
  onSwitchToLandlord?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {MailIcon}
          <div>
            <h3 className="text-lg font-semibold text-app-text">Verify this home by mail</h3>
            <p className="text-sm text-app-text-secondary mt-1">
              We&apos;ll send a code to this address. Enter it to confirm you receive mail here.
            </p>
          </div>
        </div>

        {/* Address card */}
        {normalized && <AddressCard normalized={normalized} unit={unit} />}

        {/* Disclaimer */}
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-amber-700">
            This confirms you can receive mail at this address. It does not prove ownership.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onSend}
          disabled={loading}
          className="mt-4 w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            'Send verification code'
          )}
        </button>

        {/* Secondary: landlord invite */}
        {onSwitchToLandlord && (
          <button
            type="button"
            onClick={onSwitchToLandlord}
            className="mt-2 w-full text-center text-sm text-app-text-secondary hover:text-app-text-strong transition-colors py-1"
          >
            Invite landlord instead
          </button>
        )}
      </div>

      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        &larr; Use a different address
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 2: MailVerifyPending
// ═══════════════════════════════════════════════════════════

function MailVerifyPending({
  normalized,
  unit,
  expiresAt,
  cooldownSeconds,
  resendsRemaining,
  maxResends,
  error,
  onEnterCode,
  onResend,
  onSwitchMethod,
  onBack,
}: {
  normalized?: NormalizedAddress;
  unit?: string;
  expiresAt: string | null;
  cooldownSeconds: number;
  resendsRemaining: number;
  maxResends: number;
  error: string | null;
  onEnterCode: () => void;
  onResend: () => void;
  onSwitchMethod?: () => void;
  onBack: () => void;
}) {
  const canResend = cooldownSeconds <= 0 && resendsRemaining > 0;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        {/* Status card */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-app-text">Code sent!</h3>
            <p className="text-sm text-app-text-secondary mt-1">
              A verification code is on its way
              {normalized ? ` to ${normalized.line1}` : ''}.
            </p>
          </div>
        </div>

        {/* Address card */}
        {normalized && <AddressCard normalized={normalized} unit={unit} />}

        {/* Rules */}
        <div className="mt-4 space-y-2">
          {expiresAt && (
            <div className="flex items-center gap-2 text-sm text-app-text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-text-muted flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Code expires on {formatDate(expiresAt)}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-app-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-text-muted flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            {resendsRemaining} of {maxResends} resend{maxResends === 1 ? '' : 's'} remaining
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        {/* Primary CTA: Enter code */}
        <button
          type="button"
          onClick={onEnterCode}
          className="mt-4 w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
        >
          Enter code
        </button>

        {/* Secondary: Resend */}
        <button
          type="button"
          onClick={onResend}
          disabled={!canResend}
          className="mt-2 w-full px-4 py-3 border border-app-border text-app-text-strong rounded-xl font-medium hover:bg-app-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {cooldownSeconds > 0
            ? `Resend code (${formatCountdown(cooldownSeconds)})`
            : resendsRemaining > 0
              ? 'Resend code'
              : 'No resends remaining'}
        </button>

        {/* Tertiary: Switch method */}
        {onSwitchMethod && (
          <button
            type="button"
            onClick={onSwitchMethod}
            className="mt-2 w-full text-center text-sm text-app-text-secondary hover:text-app-text-strong transition-colors py-1"
          >
            Use a different method
          </button>
        )}
      </div>

      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        &larr; Use a different address
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCREEN 3: MailVerifyConfirm
// ═══════════════════════════════════════════════════════════

const CODE_LENGTH = 6;

function MailVerifyConfirm({
  loading,
  error,
  errorType,
  attemptsRemaining: _attemptsRemaining,
  onSubmit,
  onResend,
  onBack,
}: {
  loading: boolean;
  error: string | null;
  errorType: 'wrong_code' | 'expired' | 'locked' | 'network' | null;
  attemptsRemaining: number | null;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const focusInput = (index: number) => {
    if (index >= 0 && index < CODE_LENGTH) {
      inputRefs.current[index]?.focus();
    }
  };

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      focusInput(index + 1);
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === CODE_LENGTH - 1) {
      const code = newDigits.join('');
      if (code.length === CODE_LENGTH) {
        onSubmit(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        focusInput(index - 1);
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft') {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight') {
      focusInput(index + 1);
    } else if (e.key === 'Enter') {
      const code = digits.join('');
      if (code.length === CODE_LENGTH) {
        onSubmit(code);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    // Focus the next empty or the last input
    const nextEmpty = newDigits.findIndex((d) => !d);
    focusInput(nextEmpty >= 0 ? nextEmpty : CODE_LENGTH - 1);

    // Auto-submit if all filled
    if (pasted.length === CODE_LENGTH) {
      onSubmit(pasted);
    }
  };

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH;

  const handleManualSubmit = () => {
    if (isComplete) onSubmit(code);
  };

  // Clear digits on error so user can re-enter
  useEffect(() => {
    if (errorType === 'wrong_code') {
      setDigits(Array(CODE_LENGTH).fill(''));
      // Refocus first input after a brief delay for the error to render
      const t = setTimeout(() => focusInput(0), 100);
      return () => clearTimeout(t);
    }
  }, [errorType, error]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-app-text">Enter your verification code</h3>
          <p className="text-sm text-app-text-secondary mt-1">
            Enter the 6-digit code from the letter we sent.
          </p>
        </div>

        {/* Code input */}
        <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              aria-label={`Digit ${i + 1}`}
              className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-semibold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                errorType === 'wrong_code'
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : digit
                    ? 'border-primary-300 text-app-text focus:border-primary-500 focus:ring-primary-200'
                    : 'border-app-border text-app-text focus:border-primary-500 focus:ring-primary-200'
              }`}
              disabled={loading}
            />
          ))}
        </div>

        {/* Error states */}
        {error && (
          <div className={`mt-4 flex items-start gap-2 p-3 rounded-lg ${
            errorType === 'wrong_code'
              ? 'bg-red-50 border border-red-100'
              : errorType === 'expired'
                ? 'bg-amber-50 border border-amber-100'
                : errorType === 'locked'
                  ? 'bg-red-50 border border-red-100'
                  : 'bg-red-50 border border-red-100'
          }`}>
            {errorType === 'locked' ? (
              <div className="flex-shrink-0 mt-0.5">{LockIcon}</div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                errorType === 'expired' ? 'text-amber-500' : 'text-red-500'
              }`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <div>
              <p className={`text-sm font-medium ${
                errorType === 'expired' ? 'text-amber-700' : 'text-red-700'
              }`}>
                {error}
              </p>
              {errorType === 'expired' && (
                <button
                  type="button"
                  onClick={onResend}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium underline mt-1"
                >
                  Request a new code
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submit CTA */}
        <button
          type="button"
          onClick={handleManualSubmit}
          disabled={!isComplete || loading}
          className="mt-5 w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying...
            </span>
          ) : (
            'Submit'
          )}
        </button>
      </div>

      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        &larr; Back
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════

function MailVerifySuccess({ onContinue }: { onContinue: () => void }) {
  // Trigger celebration animation on mount
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`space-y-4 transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="rounded-xl border border-app-border bg-app-surface p-6 text-center">
        {/* Celebration animation */}
        <div className="relative inline-block mb-4">
          {/* Pulse rings */}
          <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full bg-emerald-200 animate-ping opacity-30" />
          <div className="relative mx-auto">{CheckIcon}</div>
        </div>

        <h3 className="text-xl font-bold text-app-text mb-1">Welcome home!</h3>
        <p className="text-sm text-app-text-secondary">
          Your address has been verified. You&apos;re all set to continue.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LOCKED / EXPIRED ERROR SCREEN
// ═══════════════════════════════════════════════════════════

function MailVerifyError({
  errorType,
  error,
  onResend,
  onSwitchMethod,
  onBack,
}: {
  errorType: 'expired' | 'locked' | 'network' | null;
  error: string | null;
  onResend: () => void;
  onSwitchMethod?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <div className="flex items-start gap-3 mb-4">
          {errorType === 'locked' ? LockIcon : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-app-text">
              {errorType === 'locked' ? 'Too many attempts' : 'Code expired'}
            </h3>
            <p className="text-sm text-app-text-secondary mt-1">
              {error}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {errorType === 'expired' && (
            <button
              type="button"
              onClick={onResend}
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
            >
              Request a new code
            </button>
          )}

          {onSwitchMethod && (
            <button
              type="button"
              onClick={onSwitchMethod}
              className="w-full px-4 py-3 border border-app-border text-app-text-strong rounded-xl font-medium hover:bg-app-hover transition-colors"
            >
              Use a different method
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        &larr; Use a different address
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════

/**
 * MailVerificationFlow — Orchestrates the three-screen mail verification flow.
 *
 * Internally tracks whether the user is viewing the pending screen or
 * the code-entry screen via a local `showCodeEntry` flag on top of the
 * hook's phase state machine.
 */
export default function MailVerificationFlow({
  addressId,
  unit,
  normalized,
  onVerified,
  onSwitchToLandlord,
  onSwitchMethod,
  onBack,
}: Props) {
  const mail = useMailVerification({ addressId, unit, normalized });
  const [showCodeEntry, setShowCodeEntry] = useState(false);

  const handleEnterCode = useCallback(() => {
    mail.goToCodeEntry();
    setShowCodeEntry(true);
  }, [mail]);

  const handleBackFromCode = useCallback(() => {
    setShowCodeEntry(false);
  }, []);

  const handleVerified = useCallback(() => {
    onVerified(mail.claim);
  }, [onVerified, mail.claim]);

  // ── Render based on phase ────────────────────────────────

  // Success
  if (mail.phase === 'success') {
    return <MailVerifySuccess onContinue={handleVerified} />;
  }

  // Terminal error (expired or locked — shown as full screen)
  if (mail.phase === 'error') {
    return (
      <MailVerifyError
        errorType={mail.errorType as 'expired' | 'locked' | 'network' | null}
        error={mail.error}
        onResend={mail.resendCode}
        onSwitchMethod={onSwitchMethod}
        onBack={onBack}
      />
    );
  }

  // Start screen
  if (mail.phase === 'start' || mail.phase === 'sending') {
    return (
      <MailVerifyStart
        normalized={normalized}
        unit={unit}
        loading={mail.phase === 'sending'}
        error={mail.error}
        onSend={mail.sendCode}
        onSwitchToLandlord={onSwitchToLandlord}
        onBack={onBack}
      />
    );
  }

  // Code entry (user clicked "Enter code" from pending)
  if (showCodeEntry || mail.phase === 'confirming') {
    return (
      <MailVerifyConfirm
        loading={mail.phase === 'confirming'}
        error={mail.error}
        errorType={mail.errorType}
        attemptsRemaining={mail.attemptsRemaining}
        onSubmit={mail.confirmCode}
        onResend={mail.resendCode}
        onBack={handleBackFromCode}
      />
    );
  }

  // Pending screen (code sent, waiting)
  return (
    <MailVerifyPending
      normalized={normalized}
      unit={unit}
      expiresAt={mail.expiresAt}
      cooldownSeconds={mail.cooldownSeconds}
      resendsRemaining={mail.resendsRemaining}
      maxResends={mail.maxResends}
      error={mail.error}
      onEnterCode={handleEnterCode}
      onResend={mail.resendCode}
      onSwitchMethod={onSwitchMethod}
      onBack={onBack}
    />
  );
}
