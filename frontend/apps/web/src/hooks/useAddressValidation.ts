'use client';

import { useCallback, useState } from 'react';
import * as api from '@pantopus/api';
import type {
  AddressVerdict,
  AddressVerdictStatus,
  ValidateAddressResponse,
} from '@pantopus/api';

// ── State machine ───────────────────────────────────────────

export type ValidationPhase =
  | 'idle'        // waiting for user to select an address
  | 'validating'  // POST /validate in flight
  | 'result';     // verdict received — render appropriate screen

export type ValidationState = {
  phase: ValidationPhase;
  /** The structured input that was sent to /validate */
  input: api.addressValidation.ValidateAddressInput | null;
  /** Full response from the API */
  response: ValidateAddressResponse | null;
  /** Shortcut to response.verdict */
  verdict: AddressVerdict | null;
  /** Shortcut to response.verdict.status */
  status: AddressVerdictStatus | null;
  /** Persisted address_id from canonical table */
  addressId: string | null;
  /** Error message if the API call failed */
  error: string | null;
};

const INITIAL_STATE: ValidationState = {
  phase: 'idle',
  input: null,
  response: null,
  verdict: null,
  status: null,
  addressId: null,
  error: null,
};

// ── Hook ────────────────────────────────────────────────────

export function useAddressValidation() {
  const [state, setState] = useState<ValidationState>(INITIAL_STATE);

  /**
   * Validate a structured address via POST /api/v1/address/validate.
   * Transitions: idle → validating → result
   */
  const validate = useCallback(async (input: api.addressValidation.ValidateAddressInput) => {
    setState((prev) => ({
      ...prev,
      phase: 'validating',
      input,
      error: null,
    }));

    try {
      const response = await api.addressValidation.validateAddress(input);

      setState({
        phase: 'result',
        input,
        response,
        verdict: response.verdict,
        status: response.verdict.status,
        addressId: response.address_id,
        error: null,
      });

      return response;
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        phase: 'idle',
        error: err instanceof Error ? err.message : 'Address validation failed',
      }));
      return null;
    }
  }, []);

  /**
   * Re-validate with a unit number (for MISSING_UNIT flow).
   * Uses POST /api/v1/address/validate/unit.
   */
  const validateWithUnit = useCallback(async (addressId: string, unit: string) => {
    setState((prev) => ({
      ...prev,
      phase: 'validating',
      error: null,
    }));

    try {
      const response = await api.addressValidation.validateUnit({
        address_id: addressId,
        unit,
      });

      setState((prev) => ({
        ...prev,
        phase: 'result',
        response,
        verdict: response.verdict,
        status: response.verdict.status,
        addressId: response.address_id,
        error: null,
      }));

      return response;
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        phase: 'result', // stay on result so user can retry
        error: err instanceof Error ? err.message : 'Unit validation failed',
      }));
      return null;
    }
  }, []);

  /** Reset back to idle (e.g. user clicks "Change" link). */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    validate,
    validateWithUnit,
    reset,
  };
}
