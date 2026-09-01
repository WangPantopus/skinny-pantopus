'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { OfferEnvelope, CouponOrderResult } from '@/types/mailbox';

// ── Types ────────────────────────────────────────────────────

type PipelineStage = 'offer' | 'browse' | 'cart' | 'confirm';

type CartItem = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  quantity: number;
  imageUrl?: string;
};

type CouponPipelineProps = {
  offer: OfferEnvelope;
  discountType: string;
  discountValue: number;
  onClose: () => void;
  onComplete: (result: CouponOrderResult) => void;
  /** Fetches merchant product catalog. Returns mock data if not provided. */
  fetchCatalog?: (merchantId: string) => Promise<CatalogProduct[]>;
  /** Places the order. Returns result. */
  placeOrder?: (data: {
    offerId: string;
    items: Array<{ name: string; price: number; quantity?: number }>;
  }) => Promise<CouponOrderResult>;
};

type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
};

// ── Helpers ──────────────────────────────────────────────────

const STAGES: PipelineStage[] = ['offer', 'browse', 'cart', 'confirm'];

function stageIndex(stage: PipelineStage): number {
  return STAGES.indexOf(stage);
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function applyDiscount(price: number, type: string, value: number): number {
  if (type === 'percent' || type === 'percentage') {
    return Math.round(price * (1 - value / 100));
  }
  // flat discount in cents
  return Math.max(0, price - value);
}

function formatDiscountBadge(type: string, value: number): string {
  if (type === 'percent' || type === 'percentage') {
    return `${value}% off`;
  }
  return `$${(value / 100).toFixed(2)} off`;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Main component ───────────────────────────────────────────

export default function CouponPipeline({
  offer,
  discountType,
  discountValue,
  onClose,
  onComplete,
  fetchCatalog,
  placeOrder,
}: CouponPipelineProps) {
  const [stage, setStage] = useState<PipelineStage>('offer');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<CouponOrderResult | null>(null);
  const [ordering, setOrdering] = useState(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-close on confirm stage ───────────────────────────
  useEffect(() => {
    if (stage === 'confirm' && orderResult) {
      autoCloseRef.current = setTimeout(() => {
        onComplete(orderResult);
      }, 5000);
      return () => {
        if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      };
    }
  }, [stage, orderResult, onComplete]);

  // Cancel auto-close on user interaction in confirm stage
  const cancelAutoClose = useCallback(() => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
  }, []);

  // ── Load catalog on browse ────────────────────────────────
  const handleBrowse = useCallback(async () => {
    setStage('browse');
    setCatalogLoading(true);
    try {
      if (fetchCatalog) {
        const products = await fetchCatalog(offer.advertiser_id);
        setCatalog(products);
      } else {
        // Mock catalog if no fetcher provided
        setCatalog([
          { id: '1', name: 'House Blend Coffee', price: 1499, description: 'Rich medium roast' },
          { id: '2', name: 'Organic Earl Grey Tea', price: 1199, description: '20-count box' },
          { id: '3', name: 'Sourdough Loaf', price: 699, description: 'Freshly baked' },
          { id: '4', name: 'Local Honey Jar', price: 899, description: '12oz wildflower' },
          { id: '5', name: 'Artisan Granola', price: 799, description: 'Maple pecan' },
          { id: '6', name: 'Cold Brew Concentrate', price: 1299, description: '32oz bottle' },
        ]);
      }
    } finally {
      setCatalogLoading(false);
    }
  }, [fetchCatalog, offer.advertiser_id]);

  // ── Cart operations ───────────────────────────────────────
  const addToCart = useCallback((product: CatalogProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: applyDiscount(product.price, discountType, discountValue),
        originalPrice: product.price,
        quantity: 1,
        imageUrl: product.imageUrl,
      }];
    });
  }, [discountType, discountValue]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
    } else {
      setCart(prev => prev.map(item =>
        item.id === productId ? { ...item, quantity: qty } : item,
      ));
    }
  }, []);

  // ── Totals ────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const discountAmount = cart.reduce((sum, item) => sum + (item.originalPrice - item.price) * item.quantity, 0);
  const total = subtotal - discountAmount;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Checkout ──────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    setOrdering(true);
    try {
      const items = cart.map(item => ({
        name: item.name,
        price: item.price * item.quantity,
        quantity: item.quantity,
      }));

      let result: CouponOrderResult;
      if (placeOrder) {
        result = await placeOrder({ offerId: offer.id, items });
      } else {
        // Mock result
        result = {
          orderId: `order_${Date.now()}`,
          subtotal: subtotal / 100,
          discount: discountAmount / 100,
          total: total / 100,
          receiptMailId: `receipt_${Date.now()}`,
          earnPayoutReleased: true,
        };
      }

      setOrderResult(result);
      setStage('confirm');
    } finally {
      setOrdering(false);
    }
  }, [cart, subtotal, discountAmount, total, offer.id, placeOrder]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal — full-screen on mobile, centered on desktop */}
      <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:mx-4 bg-app-surface md:rounded-xl md:shadow-2xl flex flex-col overflow-hidden">
        {/* ── Coupon banner (persistent, cannot be dismissed) ── */}
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex-shrink-0">
          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded">
            {formatDiscountBadge(discountType, discountValue)}
          </span>
          <span className="text-xs text-amber-800 dark:text-amber-300 truncate flex-1">
            {offer.offer_title} — {offer.business_name}
          </span>
          {stage !== 'confirm' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-amber-600 hover:text-amber-800 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Progress indicator ────────────────────────────── */}
        <div className="flex items-center px-4 py-2 border-b border-app-border-subtle flex-shrink-0">
          {STAGES.map((s, i) => {
            const current = stageIndex(stage);
            const done = i < current;
            const active = i === current;
            return (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    done
                      ? 'bg-green-500 text-white'
                      : active
                        ? 'bg-primary-600 text-white'
                        : 'bg-app-surface-sunken text-app-text-muted'
                  }`}
                >
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`ml-1 text-[10px] font-medium hidden sm:inline ${
                    active ? 'text-app-text' : 'text-app-text-muted'
                  }`}
                >
                  {s === 'offer' ? 'Offer' : s === 'browse' ? 'Browse' : s === 'cart' ? 'Cart' : 'Done'}
                </span>
                {i < STAGES.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${done ? 'bg-green-400' : 'bg-app-surface-sunken'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Stage content ─────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {stage === 'offer' && (
            <OfferStage
              offer={offer}
              discountType={discountType}
              discountValue={discountValue}
              onBrowse={handleBrowse}
              onSave={() => onClose()}
            />
          )}

          {stage === 'browse' && (
            <BrowseStage
              catalog={catalog}
              loading={catalogLoading}
              discountType={discountType}
              discountValue={discountValue}
              cart={cart}
              onAddToCart={addToCart}
            />
          )}

          {stage === 'cart' && (
            <CartStage
              cart={cart}
              subtotal={subtotal}
              discountAmount={discountAmount}
              total={total}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onCheckout={handleCheckout}
              ordering={ordering}
            />
          )}

          {stage === 'confirm' && orderResult && (
            <ConfirmStage
              result={orderResult}
              offer={offer}
              discountAmount={discountAmount}
              onDone={() => {
                cancelAutoClose();
                onComplete(orderResult);
              }}
            />
          )}
        </div>

        {/* ── Sticky footer for browse stage ────────────────── */}
        {stage === 'browse' && cartCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-app-border bg-app-surface flex-shrink-0">
            <span className="text-sm text-app-text-strong">
              {cartCount} item{cartCount !== 1 ? 's' : ''} · {formatCurrency(total)}
            </span>
            <button
              type="button"
              onClick={() => setStage('cart')}
              className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Cart &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stage 1: Offer ──────────────────────────────────────────

function OfferStage({
  offer,
  discountType,
  discountValue,
  onBrowse,
  onSave,
}: {
  offer: OfferEnvelope;
  discountType: string;
  discountValue: number;
  onBrowse: () => void;
  onSave: () => void;
}) {
  return (
    <div className="p-6 flex flex-col items-center text-center">
      {/* Brand logo */}
      {offer.business_logo_url ? (
        <img
          src={offer.business_logo_url}
          alt={offer.business_name}
          className="w-16 h-16 rounded-xl object-cover mb-4"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-app-surface-sunken flex items-center justify-center mb-4">
          <span className="text-2xl font-bold text-app-text-muted">{offer.business_name.charAt(0)}</span>
        </div>
      )}

      {/* Discount badge */}
      <span className="px-3 py-1 text-sm font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-full mb-3">
        {formatDiscountBadge(discountType, discountValue)}
      </span>

      <h2 className="text-lg font-semibold text-app-text mb-1">{offer.offer_title}</h2>
      {offer.offer_subtitle && (
        <p className="text-sm text-app-text-secondary mb-2">{offer.offer_subtitle}</p>
      )}

      {offer.expires_at && (
        <p className="text-xs text-app-text-muted mb-4">
          Expires {new Date(offer.expires_at).toLocaleDateString()}
          {daysUntil(offer.expires_at) <= 7 && (
            <span className="text-amber-600 ml-1">({daysUntil(offer.expires_at)} days left)</span>
          )}
        </p>
      )}

      <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 mb-6">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Coupon already applied — no code needed
      </div>

      <button
        type="button"
        onClick={onBrowse}
        className="w-full py-3 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mb-3"
      >
        Browse {offer.business_name} &rarr;
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="text-xs text-app-text-secondary hover:text-app-text-strong hover:underline"
        >
          Save offer
        </button>
      </div>
    </div>
  );
}

// ── Stage 2: Browse ─────────────────────────────────────────

function BrowseStage({
  catalog,
  loading,
  discountType,
  discountValue,
  cart,
  onAddToCart,
}: {
  catalog: CatalogProduct[];
  loading: boolean;
  discountType: string;
  discountValue: number;
  cart: CartItem[];
  onAddToCart: (product: CatalogProduct) => void;
}) {
  const cartIds = new Set(cart.map(item => item.id));

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-app-surface-sunken rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {catalog.map((product) => {
          const discounted = applyDiscount(product.price, discountType, discountValue);
          const inCart = cartIds.has(product.id);
          return (
            <div key={product.id} className="border border-app-border rounded-lg overflow-hidden">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 bg-app-surface-sunken flex items-center justify-center">
                  <span className="text-2xl text-gray-300">{product.name.charAt(0)}</span>
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs font-medium text-app-text truncate">{product.name}</p>
                {product.description && (
                  <p className="text-[10px] text-app-text-muted truncate">{product.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-bold text-app-text">{formatCurrency(discounted)}</span>
                  {discounted !== product.price && (
                    <span className="text-[10px] text-app-text-muted line-through">{formatCurrency(product.price)}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAddToCart(product)}
                  className={`mt-2 w-full py-1.5 text-[11px] font-semibold rounded transition-colors ${
                    inCart
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40'
                  }`}
                >
                  {inCart ? 'Added' : 'Add to cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stage 3: Cart ───────────────────────────────────────────

function CartStage({
  cart,
  subtotal,
  discountAmount,
  total,
  onUpdateQuantity,
  onRemove,
  onCheckout,
  ordering,
}: {
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  ordering: boolean;
}) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <p className="text-sm text-app-text-secondary">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Line items */}
      <div className="space-y-3 mb-6">
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-app-text truncate">{item.name}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-app-text">
                  {formatCurrency(item.price * item.quantity)}
                </span>
                {item.price !== item.originalPrice && (
                  <span className="text-[10px] text-app-text-muted line-through">
                    {formatCurrency(item.originalPrice * item.quantity)}
                  </span>
                )}
              </div>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-app-hover dark:hover:bg-gray-800 text-xs"
              >
                -
              </button>
              <span className="text-xs text-app-text-strong w-4 text-center">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                className="w-6 h-6 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-app-hover dark:hover:bg-gray-800 text-xs"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="p-1 text-app-text-muted hover:text-red-500 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-app-border pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-app-text-secondary">Subtotal</span>
          <span className="text-app-text-strong">{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Coupon applied</span>
            <span className="text-green-600 font-medium">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-app-border-subtle pt-2">
          <span className="text-app-text">Total</span>
          <span className="text-app-text">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Checkout button */}
      <button
        type="button"
        onClick={onCheckout}
        disabled={ordering}
        className={`mt-6 w-full py-3 text-sm font-semibold rounded-lg transition-colors ${
          ordering
            ? 'bg-gray-300 text-app-text-secondary cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {ordering ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          <>Checkout &rarr; {formatCurrency(total)}</>
        )}
      </button>
    </div>
  );
}

// ── Stage 4: Confirm ────────────────────────────────────────

function ConfirmStage({
  result,
  offer,
  discountAmount,
  onDone,
}: {
  result: CouponOrderResult;
  offer: OfferEnvelope;
  discountAmount: number;
  onDone: () => void;
}) {
  return (
    <div className="p-6 flex flex-col items-center text-center" onClick={onDone}>
      {/* Success icon */}
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-lg font-semibold text-app-text mb-1">Order placed!</h2>

      <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-4">
        Saved {formatCurrency(discountAmount)} with your mailbox coupon
      </p>

      {/* Receipt routing */}
      {result.receiptMailId && (
        <div className="flex items-center gap-2 px-3 py-2 bg-app-surface-raised rounded-lg mb-3">
          <svg className="w-4 h-4 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xs text-app-text-secondary dark:text-app-text-muted">
            Receipt sent to Personal &rsaquo; Receipts
          </p>
        </div>
      )}

      {/* Earn payout */}
      {result.earnPayoutReleased && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg mb-4">
          <span className="text-base">$</span>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Earned ${offer.payout_amount.toFixed(2)} for opening this offer
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
        className="px-6 py-2 text-sm font-medium text-primary-600 hover:underline"
      >
        Done
      </button>

      <p className="text-[10px] text-app-text-muted mt-2">Auto-closing in a few seconds...</p>
    </div>
  );
}
