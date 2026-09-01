'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { CreditCard } from 'lucide-react';
import { payments } from '@pantopus/api';
const { getPaymentMethods, deletePaymentMethod, setDefaultPaymentMethod } = payments;
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
}

/** Backend / DB uses card_* and payment_method_type; align with mobile PaymentMethodsTab. */
function normalizePaymentMethod(raw: Record<string, any>): PaymentMethod {
  const nested = (raw.card && typeof raw.card === 'object' ? raw.card : raw) as Record<string, any>;
  const brandRaw =
    (nested.brand as string | undefined) ||
    (nested.card_brand as string | undefined) ||
    (raw.card_brand as string | undefined);
  const last4 =
    (nested.last4 as string | undefined) ||
    (nested.card_last4 as string | undefined) ||
    (raw.card_last4 as string | undefined) ||
    (raw.bank_last4 as string | undefined) ||
    '';
  const expMonth =
    (nested.exp_month as number | undefined) ??
    (nested.card_exp_month as number | undefined) ??
    (raw.card_exp_month as number | undefined);
  const expYear =
    (nested.exp_year as number | undefined) ??
    (nested.card_exp_year as number | undefined) ??
    (raw.card_exp_year as number | undefined);
  const type =
    (raw.payment_method_type as string | undefined) ||
    (raw.type as string | undefined) ||
    'card';
  const isDefault = Boolean(raw.is_default ?? raw.isDefault);

  return {
    id: String(raw.id),
    type,
    last4,
    brand: brandRaw ? brandRaw.toLowerCase() : undefined,
    exp_month: typeof expMonth === 'number' ? expMonth : undefined,
    exp_year: typeof expYear === 'number' ? expYear : undefined,
    is_default: isDefault,
  };
}

const BRAND_ICONS: Record<string, ReactNode> = {
  visa: <CreditCard className="w-5 h-5" />,
  mastercard: <CreditCard className="w-5 h-5" />,
  amex: <CreditCard className="w-5 h-5" />,
  discover: <CreditCard className="w-5 h-5" />,
  default: <CreditCard className="w-5 h-5" />,
};

interface PaymentMethodListProps {
  /** Called when the user wants to add a new card. */
  onAddNew?: () => void;
  /** Called when a card is selected (e.g., for payment). */
  onSelect?: (methodId: string) => void;
  /** If true, shows selection radio buttons. */
  selectable?: boolean;
  /** Currently selected method ID. */
  selectedId?: string;
  /** Compact mode for embedded use. */
  compact?: boolean;
}

/**
 * Lists saved payment methods with actions: set default, delete.
 */
export default function PaymentMethodList({
  onAddNew,
  onSelect,
  selectable = false,
  selectedId,
  compact = false,
}: PaymentMethodListProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    try {
      setError(null);
      const result = await getPaymentMethods();
      const rows = result.paymentMethods || [];
      setMethods(rows.map((m) => normalizePaymentMethod(m as Record<string, any>)));
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleDelete = async (id: string) => {
    const yes = await confirmStore.open({ title: 'Remove this payment method?', confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    setDeletingId(id);
    try {
      await deletePaymentMethod(id);
      setMethods((prev) => prev.filter((m) => m.id !== id));
    } catch {
      toast.error('Failed to remove payment method.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultPaymentMethod(id);
      setMethods((prev) =>
        prev.map((m) => ({ ...m, is_default: m.id === id }))
      );
    } catch {
      toast.error('Failed to set default payment method.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-app-text-muted text-sm">
        Loading payment methods...
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={loadMethods}
        className={`w-full text-center ${compact ? 'py-4' : 'py-8'} hover:bg-red-50 transition rounded-lg`}
      >
        <p className="text-red-800 text-sm font-medium">{error}</p>
        <p className="text-red-600 text-xs mt-1">Click to retry</p>
      </button>
    );
  }

  if (methods.length === 0) {
    return (
      <div className={`text-center ${compact ? 'py-4' : 'py-8'}`}>
        <p className="text-app-text-secondary text-sm">No saved payment methods.</p>
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="mt-3 text-sm text-emerald-600 font-medium hover:text-emerald-700"
          >
            + Add a card
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {methods.map((method) => (
        <div
          key={method.id}
          onClick={() => selectable && onSelect?.(method.id)}
          className={`flex items-center gap-3 p-3 border rounded-lg transition ${
            selectable ? 'cursor-pointer hover:border-emerald-300' : ''
          } ${
            selectedId === method.id
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-app-border'
          }`}
        >
          {/* Selection indicator */}
          {selectable && (
            <div
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                selectedId === method.id
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-app-border'
              }`}
            >
              {selectedId === method.id && (
                <div className="w-full h-full rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-app-surface rounded-full" />
                </div>
              )}
            </div>
          )}

          {/* Card icon */}
          <span className="flex-shrink-0 text-app-text-secondary">
            {BRAND_ICONS[method.brand?.toLowerCase() || 'default'] || BRAND_ICONS.default}
          </span>

          {/* Card details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-app-text capitalize">
                {method.brand
                  ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1)
                  : method.type === 'card'
                    ? 'Card'
                    : method.type}
              </span>
              {method.last4 ? (
                <span className="text-sm text-app-text-secondary">•••• {method.last4}</span>
              ) : (
                <span className="text-sm text-app-text-muted">••••</span>
              )}
              {method.is_default && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                  Default
                </span>
              )}
            </div>
            {method.exp_month != null && method.exp_year != null && (
              <span className="text-xs text-app-text-muted">
                Expires {String(method.exp_month).padStart(2, '0')}/
                {String(method.exp_year).length > 2
                  ? String(method.exp_year).slice(-2)
                  : method.exp_year}
              </span>
            )}
          </div>

          {/* Actions */}
          {!selectable && !compact && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {!method.is_default && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetDefault(method.id);
                  }}
                  className="text-xs text-app-text-secondary hover:text-emerald-600 px-2 py-1"
                  title="Set as default"
                >
                  Set default
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(method.id);
                }}
                disabled={deletingId === method.id}
                className="text-xs text-app-text-muted hover:text-red-500 px-2 py-1 disabled:opacity-50"
                title="Remove"
              >
                {deletingId === method.id ? '...' : '✕'}
              </button>
            </div>
          )}
        </div>
      ))}

      {onAddNew && (
        <button
          onClick={onAddNew}
          className="w-full p-3 border border-dashed border-app-border rounded-lg text-sm text-app-text-secondary hover:text-emerald-600 hover:border-emerald-300 transition"
        >
          + Add new card
        </button>
      )}
    </div>
  );
}
