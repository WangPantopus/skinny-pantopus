/**
 * UX regression tests for the mail verification surface (audit 2026-08-22).
 */

import { formatCountdown } from '@/components/address/MailVerificationFlow';

describe('UX-07 — countdown is readable at cooldown scale', () => {
  test('a 48 hour cooldown reads as days, not 2880 minutes', () => {
    // The old formatter produced "2880:00" ticking down by one second.
    const out = formatCountdown(48 * 3600);
    expect(out).not.toMatch(/^\d{3,}:/);
    expect(out).toBe('2d');
  });

  test('hour-scale waits read in hours and minutes', () => {
    expect(formatCountdown(3 * 3600 + 25 * 60)).toBe('3h 25m');
    expect(formatCountdown(3600)).toBe('1h');
  });

  test('day-scale waits include the remaining hours when there are any', () => {
    expect(formatCountdown(36 * 3600)).toBe('1d 12h');
  });

  test('minute and second scale stay familiar', () => {
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(45)).toBe('45s');
  });

  test('never renders a negative or fractional countdown', () => {
    expect(formatCountdown(-10)).toBe('0s');
    expect(formatCountdown(30.7)).toBe('30s');
  });
});
