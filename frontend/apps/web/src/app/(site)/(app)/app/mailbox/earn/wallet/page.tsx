import { redirect } from 'next/navigation';

/**
 * Legacy EarnWallet page — redirects to the canonical wallet
 * in Settings → Payments.
 */
export default function EarnWalletPage() {
  redirect('/app/settings/payments');
}
