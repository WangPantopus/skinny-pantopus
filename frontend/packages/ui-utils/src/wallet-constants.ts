// ============================================================
// WALLET / TRANSACTION CONSTANTS
// Display config for wallet transaction types
// ============================================================

export interface WalletTxTypeStyle {
  label: string;
  iconName: string;  // Lucide icon name
  color: string;     // Tailwind classes for icon container
}

export const WALLET_TX_TYPE_CONFIG: Record<string, WalletTxTypeStyle> = {
  deposit:          { label: 'Deposit',           iconName: 'ArrowDown',  color: 'text-emerald-600 bg-emerald-100' },
  withdrawal:       { label: 'Withdrawal',        iconName: 'ArrowUp',    color: 'text-blue-600 bg-blue-100' },
  gig_income:       { label: 'Task Income',       iconName: 'Wallet',     color: 'text-emerald-600 bg-emerald-100' },
  gig_payment:      { label: 'Task Payment',      iconName: 'Wallet',     color: 'text-red-600 bg-red-100' },
  tip_income:       { label: 'Tip Received',      iconName: 'Star',       color: 'text-yellow-600 bg-yellow-100' },
  tip_sent:         { label: 'Tip Sent',           iconName: 'Star',       color: 'text-yellow-600 bg-yellow-100' },
  refund:           { label: 'Refund',             iconName: 'Undo2',      color: 'text-emerald-600 bg-emerald-100' },
  adjustment:       { label: 'Adjustment',         iconName: 'Settings',   color: 'text-gray-600 bg-gray-100' },
  transfer_in:      { label: 'Transfer In',        iconName: 'ArrowDown',  color: 'text-emerald-600 bg-emerald-100' },
  transfer_out:     { label: 'Transfer Out',       iconName: 'ArrowUp',    color: 'text-blue-600 bg-blue-100' },
  cancellation_fee: { label: 'Cancellation Fee',   iconName: 'X',          color: 'text-red-600 bg-red-100' },
};
