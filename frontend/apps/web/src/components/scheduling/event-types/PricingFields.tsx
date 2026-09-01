"use client";

// W2 — Event Types. Priced fields for the editor (B2), rendered ONLY when
// webFeatureFlags.schedulingPaid is on. Reads the owner's Stripe connection
// status (GET /payments/status) to decide between the price fields and a
// "connect payments" prompt (which links to the W14 payments setup). Stripe
// runs in TEST mode; W2 never collects payment itself — it only configures it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, ExternalLink } from "lucide-react";
import * as api from "@pantopus/api";
import type { PaymentsStatus, SchedulingOwnerRef } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import {
  EditorCard,
  FieldLabel,
  Segmented,
  TextField,
  ToggleRow,
} from "./fields";
import {
  REFUND_POLICIES,
  centsToDollars,
  dollarsToCents,
  type EventTypeFormValues,
} from "./eventTypeFormModel";

type PricingPatch = Partial<
  Pick<
    EventTypeFormValues,
    | "charge"
    | "price_cents"
    | "currency"
    | "collect_deposit"
    | "deposit_cents"
    | "refund_policy"
  >
>;

export default function PricingFields({
  values,
  onPatch,
  errors,
  disabled,
  owner,
  pillar,
}: {
  values: EventTypeFormValues;
  onPatch: (patch: PricingPatch) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  owner: SchedulingOwnerRef;
  pillar: Pillar;
}) {
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingStatus(true);
    api.scheduling
      .getPaymentsStatus(owner)
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {
        if (alive) setStatus(null);
      })
      .finally(() => {
        if (alive) setLoadingStatus(false);
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  const connected = status?.connected === true;

  return (
    <EditorCard overline="Pricing & payment" pillar={pillar}>
      <ToggleRow
        label="Charge for this booking"
        sub="Collect payment when someone books"
        on={values.charge}
        onChange={(next) => onPatch({ charge: next })}
        disabled={disabled}
        last={!values.charge}
      />

      {values.charge && (
        <>
          {!connected && !loadingStatus ? (
            <ConnectPrompt />
          ) : (
            <>
              <div className="flex gap-2.5">
                <div className="flex-[1.4]">
                  <TextField
                    label="Price"
                    value={centsToDollars(values.price_cents)}
                    onChange={(v) =>
                      onPatch({ price_cents: dollarsToCents(v) })
                    }
                    placeholder="0"
                    prefix="$"
                    inputMode="decimal"
                    mono
                    disabled={disabled}
                    error={errors.price_cents}
                  />
                </div>
                <div className="flex-1">
                  <FieldLabel>Currency</FieldLabel>
                  <Segmented
                    ariaLabel="Currency"
                    value={values.currency}
                    onChange={(v) => onPatch({ currency: v })}
                    disabled={disabled}
                    options={[
                      { value: "USD", label: "USD" },
                      { value: "EUR", label: "EUR" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Collect</FieldLabel>
                <Segmented<"full" | "deposit">
                  ariaLabel="Collect amount"
                  value={values.collect_deposit ? "deposit" : "full"}
                  onChange={(v) =>
                    onPatch({ collect_deposit: v === "deposit" })
                  }
                  disabled={disabled}
                  options={[
                    { value: "full", label: "Full amount" },
                    { value: "deposit", label: "Deposit" },
                  ]}
                />
              </div>

              {values.collect_deposit && (
                <TextField
                  label="Deposit"
                  value={centsToDollars(values.deposit_cents)}
                  onChange={(v) =>
                    onPatch({ deposit_cents: dollarsToCents(v) })
                  }
                  placeholder="0"
                  prefix="$"
                  inputMode="decimal"
                  mono
                  disabled={disabled}
                  error={errors.deposit_cents}
                />
              )}

              <div>
                <FieldLabel>If cancelled</FieldLabel>
                <Segmented
                  ariaLabel="Refund policy"
                  value={values.refund_policy}
                  onChange={(v) => onPatch({ refund_policy: v })}
                  disabled={disabled}
                  options={REFUND_POLICIES.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                />
              </div>
            </>
          )}
        </>
      )}
    </EditorCard>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-app-border bg-primary-50/60 p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
          <CreditCard className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-app-text">
            Connect payments to charge for bookings
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-app-text-secondary">
            Pantopus uses Stripe to collect payments and deposits. It takes
            about a minute.
          </p>
        </div>
      </div>
      <Link
        href="/app/scheduling/payments"
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 text-[12.5px] font-bold text-white transition hover:bg-primary-700"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        Set up payments
      </Link>
    </div>
  );
}
