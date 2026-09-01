// @ts-nocheck
"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import type {
  StripeAccount,
  EarningsSummary,
  SpendingSummary,
} from "@pantopus/types";
import StripeProvider from "../../../../../components/payments/StripeProvider";
import PaymentMethodForm from "../../../../../components/payments/PaymentMethodForm";
import PaymentMethodList from "../../../../../components/payments/PaymentMethodList";
import StripeConnectOnboarding from "../../../../../components/payments/StripeConnectOnboarding";
import WalletBalanceCard from "../../../../../components/wallet/WalletBalanceCard";
import WithdrawModal from "../../../../../components/wallet/WithdrawModal";
import WalletTransactionList from "../../../../../components/wallet/WalletTransactionList";
import SchedulingConnectPanel from "@/components/scheduling/payments/SchedulingConnectPanel";
import { webFeatureFlags } from "@/lib/featureFlags";

function PaymentSettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(
    null,
  );
  const [showAddCard, setShowAddCard] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "wallet" | "methods" | "payouts" | "history" | "scheduling"
  >("wallet");
  // W14: the scheduling earnings/payouts tab is gated by the paid flag.
  const showScheduling = webFeatureFlags.schedulingPaid;
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletKey, setWalletKey] = useState(0); // for forcing re-render after withdraw

  // Handle onboarding return
  const onboardingStatus = searchParams.get("onboarding");

  const [accountError, setAccountError] = useState<string | null>(null);

  const loadStripeAccount = useCallback(async () => {
    try {
      setAccountError(null);
      const result = await api.payments.getStripeAccount();
      setStripeAccount(result.account || null);
    } catch (err: any) {
      setStripeAccount(null);
      // 404 = no account yet (expected), anything else is an error
      if (err?.statusCode !== 404) {
        setAccountError(err?.message || "Failed to load payout account");
      }
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadStripeAccount().finally(() => setLoading(false));
  }, [router, loadStripeAccount]);

  const handleDashboard = async () => {
    try {
      const result = await api.payments.connectStripeDashboard();
      if (result.dashboardUrl) {
        window.open(result.dashboardUrl, "_blank");
      }
    } catch (err) {
      console.error("Failed to open Stripe dashboard:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
      </div>
    );
  }

  const isOnboarded =
    stripeAccount?.payouts_enabled && stripeAccount?.charges_enabled;

  return (
    <div className="bg-app-surface-raised min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-app-text">
              Payments & Payouts
            </h1>
            <p className="text-sm text-app-text-secondary mt-1">
              Manage your payment methods, payout settings, and transaction
              history
            </p>
          </div>
          <button
            onClick={() => router.push("/app/profile/settings")}
            className="text-sm text-app-text-secondary hover:text-app-text-strong"
          >
            Back to Settings
          </button>
        </div>

        {/* Onboarding success banner */}
        {onboardingStatus === "success" && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-xl">&#10003;</span>
            <div>
              <p className="font-medium text-green-800">
                Stripe account connected!
              </p>
              <p className="text-sm text-green-600">
                Your payout setup is being verified. This usually takes 1-2
                business days.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-app-surface-sunken p-1 rounded-lg w-fit">
          {(showScheduling
            ? ["wallet", "methods", "payouts", "history", "scheduling"]
            : ["wallet", "methods", "payouts", "history"]
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-app-surface text-app-text shadow-sm"
                  : "text-app-text-secondary hover:text-app-text-strong"
              }`}
            >
              {
                {
                  wallet: "Wallet",
                  methods: "Payment Methods",
                  payouts: "Payouts",
                  history: "History",
                  scheduling: "Scheduling",
                }[tab]
              }
            </button>
          ))}
        </div>

        {/* ─── Wallet Tab ─── */}
        {activeTab === "wallet" && (
          <div className="space-y-6">
            {/* Balance Card */}
            <WalletBalanceCard
              key={walletKey}
              onWithdraw={() => setShowWithdraw(true)}
              onLoad={(w) => setWalletBalance(w.balance)}
            />

            {/* Quick info */}
            <div className="bg-app-surface rounded-xl border border-app-border p-5">
              <h3 className="font-semibold text-app-text mb-3">How it works</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium text-app-text">
                      Complete tasks
                    </p>
                    <p className="text-xs text-app-text-secondary">
                      When you finish a task, funds are released to your wallet
                      after a review period (typically up to 48 hours).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium text-app-text">
                      Receive tips
                    </p>
                    <p className="text-xs text-app-text-secondary">
                      Tips are processed through the same review period before
                      they become withdrawable.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium text-app-text">
                      Withdraw anytime
                    </p>
                    <p className="text-xs text-app-text-secondary">
                      Once funds are available in wallet, you can withdraw to
                      bank anytime. Arrives in 2-3 business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent transactions */}
            <WalletTransactionList />

            {/* Withdraw Modal */}
            {showWithdraw && (
              <WithdrawModal
                balance={walletBalance}
                onClose={() => setShowWithdraw(false)}
                onSuccess={() => {
                  setShowWithdraw(false);
                  setWalletKey((k) => k + 1); // refresh balance
                }}
              />
            )}
          </div>
        )}

        {/* ─── Payment Methods Tab ─── */}
        {activeTab === "methods" && (
          <div className="space-y-6">
            {/* Saved Cards */}
            <div className="bg-app-surface rounded-xl border border-app-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-app-text">
                    Payment Methods
                  </h2>
                  <p className="text-sm text-app-text-secondary">
                    Cards you use to pay for tasks and services
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCard(!showAddCard)}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
                >
                  {showAddCard ? "Cancel" : "+ Add Card"}
                </button>
              </div>

              <StripeProvider>
                {showAddCard && (
                  <div className="mb-6 p-4 bg-app-surface-raised rounded-lg border border-app-border">
                    <h3 className="text-sm font-medium text-app-text-strong mb-3">
                      Add a new card
                    </h3>
                    <PaymentMethodForm
                      onSuccess={() => {
                        setShowAddCard(false);
                      }}
                      onCancel={() => setShowAddCard(false)}
                    />
                  </div>
                )}

                <PaymentMethodList />
              </StripeProvider>
            </div>
          </div>
        )}

        {/* ─── Payouts Tab ─── */}
        {activeTab === "payouts" && (
          <div className="space-y-6">
            {/* Stripe Connect Status */}
            <div className="bg-app-surface rounded-xl border border-app-border p-6">
              <h2 className="text-lg font-semibold text-app-text mb-1">
                Payout Account
              </h2>
              <p className="text-sm text-app-text-secondary mb-4">
                Connect your bank account through Stripe to receive withdrawals
                from wallet earnings
              </p>

              {isOnboarded ? (
                <div className="space-y-4">
                  {/* Connected status */}
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-green-800">
                        Stripe account connected
                      </p>
                      <p className="text-sm text-green-600">
                        Payouts are enabled. Wallet withdrawals are sent to your
                        connected bank account.
                      </p>
                    </div>
                  </div>

                  {/* Account details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-app-surface-raised rounded-lg">
                      <p className="text-xs text-app-text-secondary uppercase tracking-wider">
                        Card Payments
                      </p>
                      <p className="mt-1 font-medium text-app-text">
                        {stripeAccount?.charges_enabled
                          ? "Enabled"
                          : "Disabled"}
                      </p>
                    </div>
                    <div className="p-4 bg-app-surface-raised rounded-lg">
                      <p className="text-xs text-app-text-secondary uppercase tracking-wider">
                        Payouts
                      </p>
                      <p className="mt-1 font-medium text-app-text">
                        {stripeAccount?.payouts_enabled
                          ? "Enabled"
                          : "Disabled"}
                      </p>
                    </div>
                  </div>

                  {/* Stripe Dashboard link */}
                  <button
                    onClick={handleDashboard}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Open Stripe Dashboard
                  </button>
                </div>
              ) : (
                <StripeConnectOnboarding
                  variant="card"
                  onComplete={() => loadStripeAccount()}
                />
              )}
            </div>

            {/* Earnings overview */}
            <EarningsCard />
          </div>
        )}

        {/* ─── History Tab ─── */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <TransactionHistory />
          </div>
        )}

        {/* ─── Scheduling Tab (W14) ─── */}
        {activeTab === "scheduling" && showScheduling && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-app-text">
                Scheduling payments
              </h2>
              <p className="text-sm text-app-text-secondary">
                Connect Stripe to take Calendarly booking payments and get paid
                out.
              </p>
            </div>
            <SchedulingConnectPanel />
            <button
              onClick={() => router.push("/app/scheduling/payments")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-app-business px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Open payouts &amp; earnings
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Earnings Card
 * ───────────────────────────────────────────── */
function EarningsCard() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [spending, setSpending] = useState<SpendingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    const [e, s] = await Promise.allSettled([
      api.payments.getEarnings(),
      api.payments.getSpending(),
    ]);
    if (e.status === "fulfilled") setEarnings(e.value);
    else setError("Failed to load earnings");
    if (s.status === "fulfilled") setSpending(s.value);
    else
      setError((prev) =>
        prev ? `${prev}; Failed to load spending` : "Failed to load spending",
      );
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const earningsSummary = ((earnings as any)?.earnings ||
    (earnings as any) ||
    {}) as Record<string, any>;
  const spendingSummary = ((spending as any)?.spending ||
    (spending as any) ||
    {}) as Record<string, any>;
  const totalEarnedCents =
    Number(
      earningsSummary?.total_earned ?? earningsSummary?.totalEarned ?? 0,
    ) || 0;
  const totalSpentCents =
    Number(spendingSummary?.total_spent ?? spendingSummary?.totalSpent ?? 0) ||
    0;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-6">
      <h2 className="text-lg font-semibold text-app-text mb-4">
        Earnings & Spending
      </h2>
      {error && (
        <button
          onClick={loadData}
          className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left hover:bg-red-100 transition"
        >
          <p className="text-sm font-medium text-red-800">{error}</p>
          <p className="text-xs text-red-600 mt-0.5">Click to retry</p>
        </button>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
          <p className="text-xs text-emerald-600 uppercase tracking-wider font-medium">
            Total Earned
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            ${(totalEarnedCents / 100).toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-600 uppercase tracking-wider font-medium">
            Total Spent
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            ${(totalSpentCents / 100).toFixed(2)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-app-text-secondary">
        Total earned includes funds still in review/hold. Wallet balance shows
        currently withdrawable funds.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Transaction History
 * ───────────────────────────────────────────── */
function TransactionHistory() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await api.payments.getTransactionHistory();
      setTransactions(
        (result as any)?.transactions || (result as any)?.payments || [],
      );
    } catch (err: any) {
      // Only show error if we have no existing data to display.
      // Use functional updater to check current state without stale closure.
      setTransactions((prev) => {
        if (prev.length === 0) {
          setError(err?.message || "Failed to load transaction history");
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return (
      <div className="bg-app-surface rounded-xl border border-app-border p-6 text-center text-app-text-secondary">
        Loading transactions...
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <button
        onClick={loadHistory}
        className="w-full bg-app-surface rounded-xl border border-red-200 p-10 text-center hover:bg-red-50 transition"
      >
        <p className="text-4xl mb-3">&#9888;</p>
        <p className="font-medium text-red-800">{error}</p>
        <p className="text-sm text-red-600 mt-1">Click to retry</p>
      </button>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-app-surface rounded-xl border border-app-border p-10 text-center">
        <p className="text-4xl mb-3">&#128176;</p>
        <p className="font-medium text-app-text-strong">No transactions yet</p>
        <p className="text-sm text-app-text-secondary mt-1">
          Your payment history will appear here after your first task.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
      <div className="p-4 border-b border-app-border-subtle">
        <h2 className="font-semibold text-app-text">Transaction History</h2>
      </div>
      <div className="divide-y divide-app-border-subtle">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="px-4 py-3 flex items-center justify-between hover:bg-app-hover"
          >
            <div className="flex items-center gap-3">
              {(() => {
                const isTip = tx.payment_type === "tip";
                const isPayout = tx.entry_type === "payout";
                const isSent =
                  isPayout || tx.direction === "debit" || tx._isSender;
                const iconWrapClass = isTip
                  ? "bg-yellow-100 text-yellow-600"
                  : isPayout
                    ? "bg-indigo-100 text-indigo-600"
                    : isSent
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-600";
                const icon = isTip ? "★" : isPayout ? "⤴" : isSent ? "↑" : "↓";
                const amountCents =
                  tx.amount_cents ?? tx.amount_total ?? tx.amount ?? 0;
                const status =
                  tx.status || tx.payment_status || tx.payout_status || "";
                const title = isPayout
                  ? tx.description ||
                    `Payout${tx.destination_last4 ? ` to bank ••••${tx.destination_last4}` : ""}`
                  : tx.gig?.title || tx.description || "Payment";

                return (
                  <>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${iconWrapClass}`}
                    >
                      {icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-app-text">
                        {title}
                      </p>
                      <p className="text-xs text-app-text-secondary">
                        {tx.created_at
                          ? new Date(tx.created_at).toLocaleDateString()
                          : ""}{" "}
                        {status ? `· ${String(status).replace(/_/g, " ")}` : ""}
                      </p>
                    </div>
                    <span
                      className={`ml-auto text-sm font-semibold ${
                        isSent ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {isSent ? "-" : "+"}$
                      {(Number(amountCents || 0) / 100).toFixed(2)}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaymentSettingsPage() {
  return (
    <Suspense>
      <PaymentSettingsPageContent />
    </Suspense>
  );
}
