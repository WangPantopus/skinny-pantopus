/**
 * W14 · Payments & payouts — targeted unit tests for this stream's pure logic:
 *  - cancellation/refund policy serialization round-trip (G14)
 *  - Stripe Connect state machine (G6)
 *  - money formatting (G7)
 *  - the schedulingPaid feature-flag gate
 */

import type { PaymentsStatus, StripeAccount } from "@pantopus/types";
import {
  CustomPolicy,
  fromCancellationPolicy,
  toCancellationPolicy,
} from "@/components/scheduling/payments/policyPresets";
import { deriveConnectState } from "@/components/scheduling/payments/connectState";
import { formatUsd } from "@/components/scheduling/payments/kit";

const CUSTOM: CustomPolicy = {
  cutoffHours: 48,
  refundPctAfter: 25,
  depositNonRefundable: true,
  noShow: "no_charge",
};

describe("G14 policy serialization", () => {
  it("maps presets to the documented CancellationPolicy shape", () => {
    expect(toCancellationPolicy("flexible", CUSTOM)).toMatchObject({
      cutoff_min: 1440,
      refund_policy: "full",
      preset: "flexible",
    });
    expect(toCancellationPolicy("moderate", CUSTOM)).toMatchObject({
      cutoff_min: 2880,
      refund_policy: "partial",
    });
    expect(toCancellationPolicy("strict", CUSTOM)).toMatchObject({
      cutoff_min: 0,
      refund_policy: "none",
    });
  });

  it("encodes custom fields and derives the refund_policy enum", () => {
    const policy = toCancellationPolicy("custom", CUSTOM);
    expect(policy).toMatchObject({
      cutoff_min: 48 * 60,
      reschedule_cutoff_min: 48 * 60,
      refund_policy: "partial", // 25% after cutoff → partial
      preset: "custom",
      refund_percent_after: 25,
      deposit_non_refundable: true,
      no_show_handling: "no_charge",
    });
  });

  it("round-trips every preset back to its key", () => {
    for (const key of ["flexible", "moderate", "strict", "custom"] as const) {
      const policy = toCancellationPolicy(key, CUSTOM);
      expect(fromCancellationPolicy(policy).selected).toBe(key);
    }
  });

  it("round-trips the custom fields", () => {
    const policy = toCancellationPolicy("custom", CUSTOM);
    expect(fromCancellationPolicy(policy).custom).toEqual(CUSTOM);
  });

  it("defaults to flexible when no policy is stored", () => {
    expect(fromCancellationPolicy(null).selected).toBe("flexible");
    expect(fromCancellationPolicy(undefined).selected).toBe("flexible");
  });

  it("detects a preset by value even without a marker (legacy rows)", () => {
    expect(
      fromCancellationPolicy({ cutoff_min: 0, refund_policy: "none" }).selected,
    ).toBe("strict");
    expect(
      fromCancellationPolicy({ cutoff_min: 1440, refund_policy: "full" })
        .selected,
    ).toBe("flexible");
  });

  it("falls back to custom for an unrecognized policy (never drops data)", () => {
    expect(
      fromCancellationPolicy({ cutoff_min: 360, refund_policy: "partial" })
        .selected,
    ).toBe("custom");
  });
});

const BASE_ACCOUNT: StripeAccount = {
  id: "acct_row",
  user_id: "u1",
  stripe_account_id: "acct_1",
  account_status: "active",
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const acct = (p: Partial<StripeAccount>): StripeAccount => ({
  ...BASE_ACCOUNT,
  ...p,
});
const status = (p: Partial<PaymentsStatus>): PaymentsStatus => ({
  applicable: true,
  connected: false,
  ...p,
});

describe("G6 Stripe Connect state machine", () => {
  it("is not_applicable for homes", () => {
    expect(deriveConnectState(status({ applicable: false }), null)).toBe(
      "not_applicable",
    );
  });

  it("is not_connected with no account and no connection", () => {
    expect(deriveConnectState(status({ connected: false }), null)).toBe(
      "not_connected",
    );
  });

  it("is incomplete when details are not submitted", () => {
    expect(
      deriveConnectState(
        status({ connected: true }),
        acct({
          details_submitted: false,
          charges_enabled: false,
          payouts_enabled: false,
        }),
      ),
    ).toBe("incomplete");
  });

  it("is restricted when charges work but payouts are paused", () => {
    expect(
      deriveConnectState(
        status({ connected: true }),
        acct({ payouts_enabled: false }),
      ),
    ).toBe("restricted");
  });

  it("is ready when charges and payouts are enabled", () => {
    expect(deriveConnectState(status({ connected: true }), acct({}))).toBe(
      "ready",
    );
  });

  it("falls back to status when there is no account row", () => {
    expect(
      deriveConnectState(
        status({
          connected: true,
          charges_enabled: true,
          payouts_enabled: true,
        }),
        null,
      ),
    ).toBe("ready");
  });
});

describe("G7 money formatting", () => {
  it("renders cents as USD", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(12450)).toBe("$124.50");
    expect(formatUsd(164200)).toBe("$1,642.00");
  });
  it("is null-safe", () => {
    expect(formatUsd(null)).toBe("$0.00");
    expect(formatUsd(undefined)).toBe("$0.00");
  });
});

describe("schedulingPaid feature-flag gate", () => {
  const KEYS = [
    "NEXT_PUBLIC_APP_ENV",
    "VERCEL_ENV",
    "NEXT_PUBLIC_SCHEDULING_ENABLED",
    "NEXT_PUBLIC_SCHEDULING_PAID_ENABLED",
  ];

  function loadFlags(env: Record<string, string>) {
    const saved: Record<string, string | undefined> = {};
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    let flags: { schedulingPaid: boolean; scheduling: boolean } = {
      schedulingPaid: false,
      scheduling: false,
    };
    jest.isolateModules(() => {
      flags = require("@/lib/featureFlags").webFeatureFlags;
    });
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
    return flags;
  }

  it("defaults ON outside production", () => {
    expect(loadFlags({}).schedulingPaid).toBe(true);
  });

  it("is OFF when explicitly disabled", () => {
    expect(
      loadFlags({ NEXT_PUBLIC_SCHEDULING_PAID_ENABLED: "0" }).schedulingPaid,
    ).toBe(false);
  });

  it("is OFF when the scheduling master flag is off", () => {
    expect(
      loadFlags({ NEXT_PUBLIC_SCHEDULING_ENABLED: "0" }).schedulingPaid,
    ).toBe(false);
  });

  it("defaults OFF in production", () => {
    expect(
      loadFlags({ NEXT_PUBLIC_APP_ENV: "production" }).schedulingPaid,
    ).toBe(false);
  });

  it("can be force-enabled in production", () => {
    expect(
      loadFlags({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_SCHEDULING_ENABLED: "1",
        NEXT_PUBLIC_SCHEDULING_PAID_ENABLED: "1",
      }).schedulingPaid,
    ).toBe(true);
  });
});
