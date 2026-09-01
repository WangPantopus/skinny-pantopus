'use client';

/**
 * useMailVerification — State machine for the mail-based address verification flow.
 *
 * Phases:
 *   start     → user sees address card + "Send verification code" CTA
 *   sending   → POST /verify/mail/start in flight
 *   pending   → code sent, waiting for user to enter it (with cooldown timer)
 *   confirming → POST /verify/mail/confirm in flight
 *   success   → code accepted, address verified
 *   error     → terminal error (expired, locked, etc.)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type {
  NormalizedAddress,
  MailVerifyStartResponse,
  MailVerifyConfirmResponse,
} from '@pantopus/api';

export type MailVerificationPhase =
  | 'start'
  | 'sending'
  | 'pending'
  | 'confirming'
  | 'success'
  | 'error';

export type MailVerificationState = {
  phase: MailVerificationPhase;
  addressId: string;
  unit?: string;
  normalized?: NormalizedAddress;
  /** ID returned from /verify/mail/start */
  verificationId: string | null;
  /** When the code expires */
  expiresAt: string | null;
  /** When the user can resend */
  cooldownUntil: string | null;
  /** How many resends remain */
  resendsRemaining: number;
  /** Max resends allowed */
  maxResends: number;
  /** Remaining confirm attempts (after wrong code) */
  attemptsRemaining: number | null;
  /** Error message for display */
  error: string | null;
  /** Error type for conditional rendering */
  errorType: 'wrong_code' | 'expired' | 'locked' | 'network' | null;
  /** Locked until (for locked state) */
  lockedUntil: string | null;
  /** The claim returned on success */
  claim: api.addressValidation.AddressClaim | null;
  /** Seconds remaining on cooldown (ticking) */
  cooldownSeconds: number;
};

type InitParams = {
  addressId: string;
  unit?: string;
  normalized?: NormalizedAddress;
};

export function useMailVerification({ addressId, unit, normalized }: InitParams) {
  const [state, setState] = useState<MailVerificationState>({
    phase: 'start',
    addressId,
    unit,
    normalized,
    verificationId: null,
    expiresAt: null,
    cooldownUntil: null,
    resendsRemaining: 0,
    maxResends: 3,
    attemptsRemaining: null,
    error: null,
    errorType: null,
    lockedUntil: null,
    claim: null,
    cooldownSeconds: 0,
  });

  // ── Cooldown timer ────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldownTimer = useCallback((cooldownUntil: string) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000),
      );
      setState((prev) => ({ ...prev, cooldownSeconds: remaining }));
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Apply start/resend response to state ──────────────────
  const applyStartResponse = useCallback(
    (resp: MailVerifyStartResponse) => {
      setState((prev) => ({
        ...prev,
        phase: 'pending',
        verificationId: resp.verification_id,
        expiresAt: resp.expires_at,
        cooldownUntil: resp.cooldown_until,
        resendsRemaining: resp.resends_remaining,
        maxResends: resp.max_resends,
        error: null,
        errorType: null,
      }));
      if (resp.cooldown_until) {
        startCooldownTimer(resp.cooldown_until);
      }
    },
    [startCooldownTimer],
  );

  // ── Send code (initial) ───────────────────────────────────
  const sendCode = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: 'sending', error: null, errorType: null }));

    try {
      const resp = await api.addressValidation.startMailVerification({
        address_id: addressId,
        unit,
      });
      applyStartResponse(resp);
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        phase: 'start',
        error: err instanceof Error ? err.message : 'Failed to send verification code',
        errorType: 'network',
      }));
    }
  }, [addressId, unit, applyStartResponse]);

  // ── Resend code ───────────────────────────────────────────
  const resendCode = useCallback(async () => {
    if (!state.verificationId || state.cooldownSeconds > 0) return;

    setState((prev) => ({ ...prev, error: null, errorType: null }));

    try {
      const resp = await api.addressValidation.resendMailVerification(
        state.verificationId,
      );
      applyStartResponse(resp);
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to resend code',
        errorType: 'network',
      }));
    }
  }, [state.verificationId, state.cooldownSeconds, applyStartResponse]);

  // ── Confirm code ──────────────────────────────────────────
  const confirmCode = useCallback(
    async (code: string) => {
      if (!state.verificationId) return;

      setState((prev) => ({
        ...prev,
        phase: 'confirming',
        error: null,
        errorType: null,
      }));

      try {
        const resp: MailVerifyConfirmResponse =
          await api.addressValidation.confirmMailVerification({
            verification_id: state.verificationId,
            code,
          });

        switch (resp.status) {
          case 'confirmed':
            setState((prev) => ({
              ...prev,
              phase: 'success',
              claim: resp.claim ?? null,
              error: null,
              errorType: null,
            }));
            break;

          case 'wrong_code':
            setState((prev) => ({
              ...prev,
              phase: 'pending',
              attemptsRemaining: resp.attempts_remaining ?? null,
              error: `That code doesn't match. ${resp.attempts_remaining ?? 0} attempt${(resp.attempts_remaining ?? 0) === 1 ? '' : 's'} remaining.`,
              errorType: 'wrong_code',
            }));
            break;

          case 'expired':
            setState((prev) => ({
              ...prev,
              phase: 'error',
              error: 'That code has expired. Request a new one.',
              errorType: 'expired',
            }));
            break;

          case 'locked':
            setState((prev) => ({
              ...prev,
              phase: 'error',
              lockedUntil: resp.locked_until ?? null,
              error: resp.locked_until
                ? `Too many attempts. Try again after ${new Date(resp.locked_until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
                : 'Too many attempts. Please try again later.',
              errorType: 'locked',
            }));
            break;
        }
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          phase: 'pending',
          error: err instanceof Error ? err.message : 'Verification failed. Please try again.',
          errorType: 'network',
        }));
      }
    },
    [state.verificationId],
  );

  // ── Reset to start ────────────────────────────────────────
  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState({
      phase: 'start',
      addressId,
      unit,
      normalized,
      verificationId: null,
      expiresAt: null,
      cooldownUntil: null,
      resendsRemaining: 0,
      maxResends: 3,
      attemptsRemaining: null,
      error: null,
      errorType: null,
      lockedUntil: null,
      claim: null,
      cooldownSeconds: 0,
    });
  }, [addressId, unit, normalized]);

  // ── Navigate to code entry from pending ───────────────────
  const goToCodeEntry = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      errorType: null,
    }));
  }, []);

  return {
    ...state,
    sendCode,
    resendCode,
    confirmCode,
    reset,
    goToCodeEntry,
  };
}
