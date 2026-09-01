// ============================================================
// STRIPE CONNECT SERVICE
// Handles all Stripe Connect operations using
// Separate Charges and Transfers with manual capture.
// ============================================================

const { getStripeClient } = require('./getStripeClient');
const stripe = getStripeClient();
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { PAYMENT_STATES, transitionPaymentStatus } = require('./paymentStateMachine');
const { createNotification } = require('../services/notificationService');

// Default platform fee: 15%
const DEFAULT_PLATFORM_FEE_PCT = 15;
// Cooling-off period before transfer (48 hours in ms)
const COOLING_OFF_MS = 48 * 60 * 60 * 1000;
// Authorization hold window (7 days in ms)
const AUTH_HOLD_MS = 7 * 24 * 60 * 60 * 1000;
// Maximum capture attempts before giving up (prevents infinite Stripe spam)
const MAX_CAPTURE_ATTEMPTS = 5;

class StripeService {
  async _getGigInfo(gigId) {
    if (!gigId) return null;
    const { data } = await supabaseAdmin
      .from('Gig')
      .select('id, title')
      .eq('id', gigId)
      .single();
    return data || null;
  }

  async _notifyTipReceivedIfNeeded(payment) {
    if (!payment || payment.payment_type !== 'tip') return false;

    const metadata = payment.metadata || {};
    if (metadata.tip_notification_sent_at) {
      return false;
    }

    const gig = await this._getGigInfo(payment.gig_id);
    const notification = await createNotification({
      userId: payment.payee_id,
      type: 'tip_received',
      title: 'You received a tip!',
      body: `The poster of "${gig?.title || 'a gig'}" sent you a $${(payment.amount_total / 100).toFixed(2)} tip. 🎉`,
      icon: '💰',
      link: payment.gig_id ? `/gigs/${payment.gig_id}` : null,
      metadata: {
        gig_id: payment.gig_id,
        amount: payment.amount_total,
        payment_id: payment.id,
      },
    });

    if (notification === null) {
      return false;
    }

    await supabaseAdmin
      .from('Payment')
      .update({
        metadata: {
          ...metadata,
          tip_notification_id: notification?.id || null,
          tip_notification_sent_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    return true;
  }

  /**
   * Best-effort reconciliation for tip payments after Stripe confirms the
   * PaymentIntent. This is used by both webhooks and the mobile post-sheet
   * success path so tips don't remain stuck in authorize_pending.
   */
  async syncTipPaymentStatus(paymentId, { paymentIntent: providedPaymentIntent } = {}) {
    if (!paymentId) throw new Error('Payment ID is required');

    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.payment_type !== 'tip') {
      return { payment_status: payment.payment_status, payment };
    }

    const alreadySucceededStates = new Set([
      PAYMENT_STATES.CAPTURED_HOLD,
      PAYMENT_STATES.TRANSFER_SCHEDULED,
      PAYMENT_STATES.TRANSFER_PENDING,
      PAYMENT_STATES.TRANSFERRED,
      PAYMENT_STATES.REFUND_PENDING,
      PAYMENT_STATES.REFUNDED_PARTIAL,
      PAYMENT_STATES.REFUNDED_FULL,
      PAYMENT_STATES.DISPUTED,
    ]);

    if (alreadySucceededStates.has(payment.payment_status) && payment.payment_succeeded_at) {
      await this._notifyTipReceivedIfNeeded(payment);
      return { payment_status: payment.payment_status, payment };
    }

    if (!payment.stripe_payment_intent_id) {
      return { payment_status: payment.payment_status, payment };
    }

    const paymentIntent = providedPaymentIntent || await stripe.paymentIntents.retrieve(
      payment.stripe_payment_intent_id,
      { expand: ['latest_charge'] }
    );

    if (!paymentIntent) {
      return { payment_status: payment.payment_status, payment };
    }

    if (paymentIntent.status === 'canceled') {
      if (payment.payment_status === PAYMENT_STATES.AUTHORIZE_PENDING) {
        try {
          await transitionPaymentStatus(payment.id, PAYMENT_STATES.CANCELED);
        } catch (err) {
          logger.info('syncTipPaymentStatus: cancel transition skipped', {
            paymentId: payment.id,
            error: err.message,
          });
        }
      }
      return {
        payment_status: PAYMENT_STATES.CANCELED,
        stripe_status: paymentIntent.status,
        payment,
      };
    }

    if (paymentIntent.status !== 'succeeded') {
      return {
        payment_status: payment.payment_status,
        stripe_status: paymentIntent.status,
        payment,
      };
    }

    const charge =
      typeof paymentIntent.latest_charge === 'object'
        ? paymentIntent.latest_charge
        : paymentIntent.charges?.data?.[0] || null;
    const capturedAt = charge?.created
      ? new Date(charge.created * 1000)
      : paymentIntent.created
        ? new Date(paymentIntent.created * 1000)
        : new Date();
    const coolingOffEnds = new Date(capturedAt.getTime() + COOLING_OFF_MS);
    const paymentMethodId =
      typeof paymentIntent.payment_method === 'string'
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id || null;
    const cardUpdates = {
      stripe_charge_id:
        charge?.id ||
        (typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : payment.stripe_charge_id || null),
      stripe_payment_method_id: paymentMethodId || payment.stripe_payment_method_id || null,
      payment_method_type: charge?.payment_method_details?.type || payment.payment_method_type || null,
      payment_method_last4:
        charge?.payment_method_details?.card?.last4 ||
        charge?.payment_method_details?.us_bank_account?.last4 ||
        payment.payment_method_last4 ||
        null,
      payment_method_brand: charge?.payment_method_details?.card?.brand || payment.payment_method_brand || null,
    };

    try {
      if (payment.payment_status === PAYMENT_STATES.AUTHORIZE_PENDING) {
        await transitionPaymentStatus(payment.id, PAYMENT_STATES.CAPTURED_HOLD, {
          captured_at: capturedAt.toISOString(),
          cooling_off_ends_at: coolingOffEnds.toISOString(),
          payment_succeeded_at: capturedAt.toISOString(),
          ...cardUpdates,
        });
      } else if (alreadySucceededStates.has(payment.payment_status)) {
        await supabaseAdmin
          .from('Payment')
          .update({
            ...cardUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
      }
    } catch (err) {
      logger.warn('syncTipPaymentStatus: capture transition failed, direct update fallback', {
        paymentId: payment.id,
        currentStatus: payment.payment_status,
        error: err.message,
      });

      await supabaseAdmin
        .from('Payment')
        .update({
          payment_status: PAYMENT_STATES.CAPTURED_HOLD,
          captured_at: capturedAt.toISOString(),
          cooling_off_ends_at: coolingOffEnds.toISOString(),
          payment_succeeded_at: capturedAt.toISOString(),
          ...cardUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
    }

    const { data: refreshed } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .eq('id', payment.id)
      .single();

    await this._notifyTipReceivedIfNeeded(refreshed || payment);

    return {
      payment_status: refreshed?.payment_status || PAYMENT_STATES.CAPTURED_HOLD,
      stripe_status: paymentIntent.status,
      payment: refreshed || payment,
    };
  }

  /**
   * Opportunistically reconcile any stuck authorize_pending tip payments that
   * belong to the given user. Used by read paths so older missed-webhook tips
   * self-heal when the user opens Payments & Payouts.
   */
  async reconcilePendingTipsForUser(userId, { payeeOnly = false } = {}) {
    if (!userId) return [];

    const query = supabaseAdmin
      .from('Payment')
      .select('id')
      .eq('payment_type', 'tip')
      .eq('payment_status', PAYMENT_STATES.AUTHORIZE_PENDING);

    if (payeeOnly) {
      query.eq('payee_id', userId);
    } else {
      query.or(`payer_id.eq.${userId},payee_id.eq.${userId}`);
    }

    const { data: pendingTips, error } = await query;
    if (error) {
      logger.warn('reconcilePendingTipsForUser: query failed', {
        userId,
        payeeOnly,
        error: error.message,
      });
      return [];
    }

    if (!pendingTips?.length) {
      return [];
    }

    const settled = await Promise.allSettled(
      pendingTips.map((tip) => this.syncTipPaymentStatus(tip.id))
    );

    return settled;
  }

  // ============ CONNECT ACCOUNTS ============

  /**
   * Create Stripe Connect Express account for seller
   */
  async createConnectAccount(userId, userData = {}) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('StripeAccount')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return {
          success: false,
          error: 'Stripe account already exists',
          accountId: existing.stripe_account_id
        };
      }

      const account = await stripe.accounts.create({
        type: 'express',
        country: userData.country || 'US',
        email: userData.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: userData.business_type || 'individual',
        metadata: {
          user_id: userId,
          platform: 'pantopus'
        }
      });

      logger.info('Stripe Connect account created', { userId, accountId: account.id });

      const { data: savedAccount, error: dbError } = await supabaseAdmin
        .from('StripeAccount')
        .insert({
          user_id: userId,
          stripe_account_id: account.id,
          account_type: 'express',
          country: account.country,
          business_type: account.business_type,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          requirements: account.requirements,
          last_synced_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Error saving Stripe account', { error: dbError.message });
      }

      return {
        success: true,
        account: savedAccount,
        stripeAccountId: account.id
      };

    } catch (err) {
      logger.error('Error creating Connect account', { error: err.message, userId });
      throw err;
    }
  }

  /**
   * Create onboarding link for Connect account.
   * If the stored account was created in Stripe test mode but we're now using live keys,
   * creates a new live Connect account and replaces the stored one, then returns the link.
   */
  async createAccountLink(userId, returnUrl, refreshUrl) {
    try {
      const { data: account } = await supabaseAdmin
        .from('StripeAccount')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (!account) {
        throw new Error('Stripe account not found');
      }

      let accountId = account.stripe_account_id;

      try {
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding'
        });

        logger.info('Account link created', { userId, accountId });
        return {
          success: true,
          url: accountLink.url,
          expiresAt: accountLink.expires_at
        };
      } catch (linkErr) {
        const msg = String(linkErr?.message || '');
        const isTestAccountWithLiveKeys = msg.includes('live mode') && msg.includes('test mode');
        if (!isTestAccountWithLiveKeys) {
          logger.error('Error creating account link', { error: linkErr.message, userId });
          throw linkErr;
        }

        logger.info('Replacing test-mode Connect account with new live account', { userId });
        const { data: user } = await supabaseAdmin
          .from('User')
          .select('email')
          .eq('id', userId)
          .single();
        if (!user?.email) {
          throw new Error('User email not found; cannot create new Connect account');
        }

        const newAccount = await stripe.accounts.create({
          type: 'express',
          country: 'US',
          email: user.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: 'individual',
          metadata: { user_id: userId, platform: 'pantopus' }
        });
        accountId = newAccount.id;

        const { error: updateError } = await supabaseAdmin
          .from('StripeAccount')
          .update({
            stripe_account_id: newAccount.id,
            charges_enabled: newAccount.charges_enabled,
            payouts_enabled: newAccount.payouts_enabled,
            details_submitted: newAccount.details_submitted,
            requirements: newAccount.requirements || {},
            last_synced_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          logger.error('Error updating StripeAccount with new live account', { error: updateError.message, userId });
          throw new Error(`Failed to save new Connect account: ${updateError.message}`);
        }

        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding'
        });

        logger.info('Account link created for new live account', { userId, accountId });
        return {
          success: true,
          url: accountLink.url,
          expiresAt: accountLink.expires_at
        };
      }
    } catch (err) {
      logger.error('Error creating account link', { error: err.message, userId });
      throw err;
    }
  }

  /**
   * Get Connect account details
   */
  async getConnectAccount(userId) {
    try {
      const { data: account } = await supabaseAdmin
        .from('StripeAccount')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!account) {
        return { success: false, error: 'No Stripe account found' };
      }

      const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

      await supabaseAdmin
        .from('StripeAccount')
        .update({
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
          requirements: stripeAccount.requirements,
          card_payments_enabled: stripeAccount.capabilities?.card_payments === 'active',
          transfers_enabled: stripeAccount.capabilities?.transfers === 'active',
          last_synced_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      return {
        success: true,
        account: {
          ...account,
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          requirements: stripeAccount.requirements
        }
      };

    } catch (err) {
      logger.error('Error getting Connect account', { error: err.message, userId });
      throw err;
    }
  }

  /**
   * Create login link for Connect Express dashboard
   */
  async createLoginLink(userId) {
    try {
      const { data: account } = await supabaseAdmin
        .from('StripeAccount')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (!account) {
        throw new Error('Stripe account not found');
      }

      const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);

      return { success: true, url: loginLink.url };

    } catch (err) {
      logger.error('Error creating login link', { error: err.message, userId });
      throw err;
    }
  }

  /**
   * Retrieve the client_secret for an existing PaymentIntent so the frontend
   * can resume an in-progress on-session authorization flow.
   */
  async getPaymentIntentClientSecret(paymentIntentId) {
    if (!paymentIntentId) {
      throw new Error('PaymentIntent ID is required');
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!paymentIntent?.client_secret) {
      throw new Error('PaymentIntent has no client secret');
    }
    return paymentIntent.client_secret;
  }

  /**
   * Best-effort reconciliation for local/dev environments where webhook
   * delivery may be delayed. If Stripe already shows manual-capture auth
   * success (requires_capture), transition to AUTHORIZED.
   */
  async syncPaymentAuthorizationStatus(paymentId) {
    if (!paymentId) throw new Error('Payment ID is required');

    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('id, payment_status, stripe_payment_intent_id')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (
      payment.payment_status !== PAYMENT_STATES.AUTHORIZE_PENDING ||
      !payment.stripe_payment_intent_id
    ) {
      return { payment_status: payment.payment_status };
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    if (!paymentIntent) {
      return { payment_status: payment.payment_status };
    }

    if (paymentIntent.capture_method === 'manual' && paymentIntent.status === 'requires_capture') {
      const authExpiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
      try {
        await transitionPaymentStatus(payment.id, PAYMENT_STATES.AUTHORIZED, {
          authorization_expires_at: authExpiresAt.toISOString(),
          stripe_charge_id: paymentIntent.latest_charge,
        });
      } catch (err) {
        logger.info('syncPaymentAuthorizationStatus: transition skipped', {
          paymentId: payment.id,
          error: err.message,
        });
      }
      return { payment_status: PAYMENT_STATES.AUTHORIZED };
    }

    if (paymentIntent.status === 'canceled') {
      try {
        await transitionPaymentStatus(payment.id, PAYMENT_STATES.CANCELED);
      } catch (err) {
        logger.info('syncPaymentAuthorizationStatus: cancel transition skipped', {
          paymentId: payment.id,
          error: err.message,
        });
      }
      return { payment_status: PAYMENT_STATES.CANCELED };
    }

    return { payment_status: payment.payment_status, stripe_status: paymentIntent.status };
  }

  // ============ CUSTOMERS ============

  /**
   * Get or create Stripe customer for a user.
   * Checks User.stripe_customer_id first, then PaymentMethod table,
   * then creates a new customer and persists the ID on User.
   */
  async getOrCreateCustomer(userId) {
    try {
      // 1. Check User table first (primary source)
      const { data: user } = await supabaseAdmin
        .from('User')
        .select('stripe_customer_id, email, name, username')
        .eq('id', userId)
        .single();

      if (!user) {
        throw new Error('User not found');
      }

      if (user.stripe_customer_id) {
        return user.stripe_customer_id;
      }

      // 2. Fallback: check PaymentMethod table (legacy)
      const { data: existingMethod } = await supabaseAdmin
        .from('PaymentMethod')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (existingMethod?.stripe_customer_id) {
        // Backfill to User table
        await supabaseAdmin
          .from('User')
          .update({ stripe_customer_id: existingMethod.stripe_customer_id })
          .eq('id', userId);
        return existingMethod.stripe_customer_id;
      }

      // 3. Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.username,
        metadata: { user_id: userId }
      });

      // Persist on User table
      await supabaseAdmin
        .from('User')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId);

      logger.info('Stripe customer created', { userId, customerId: customer.id });

      return customer.id;

    } catch (err) {
      logger.error('Error getting/creating customer', { error: err.message, userId });
      throw err;
    }
  }

  // ============ FEE CALCULATION ============

  /**
   * Calculate payment fee breakdown.
   * Estimate fees for display and record-keeping purposes.
   * The estimatedStripeFee is an approximation (2.9% + 30¢). Actual Stripe
   * processing fees vary by card type, country, and payment method, and are
   * determined at charge time. See Stripe BalanceTransaction objects for actuals.
   *
   * @param {number} amountCents - Total amount in cents
   * @param {number} platformFeePct - Platform fee percentage (default 15)
   * @returns {{ platformFee, amountToPayee, estimatedStripeFee }}
   */
  calculateFees(amountCents, platformFeePct = DEFAULT_PLATFORM_FEE_PCT) {
    const platformFee = Math.floor(amountCents * platformFeePct / 100);
    const amountToPayee = amountCents - platformFee;
    const estimatedStripeFee = Math.floor(amountCents * 0.029) + 30; // 2.9% + 30¢ estimate
    return { platformFee, amountToPayee, estimatedStripeFee };
  }

  /**
   * Get the effective platform fee rate for a business.
   * Returns the per-business override if set, else the platform default (15%).
   *
   * @param {string} businessUserId - The business user ID (payee)
   * @returns {Promise<number>} - Fee percentage (0-100)
   */
  async getEffectiveFeeRate(businessUserId) {
    if (!businessUserId) return DEFAULT_PLATFORM_FEE_PCT;
    try {
      const { data: profile } = await supabaseAdmin
        .from('BusinessProfile')
        .select('fee_override_pct')
        .eq('business_user_id', businessUserId)
        .maybeSingle();
      if (profile && profile.fee_override_pct !== null && profile.fee_override_pct !== undefined) {
        return Number(profile.fee_override_pct);
      }
    } catch (err) {
      logger.warn('getEffectiveFeeRate: failed to fetch override, using default', {
        businessUserId, error: err.message,
      });
    }
    return DEFAULT_PLATFORM_FEE_PCT;
  }

  // ============ PAYMENT LIFECYCLE (Separate Charges & Transfers) ============

  /**
   * Get the payee's Stripe Connect account.
   * For Separate Charges & Transfers + wallet settlement, we only require
   * that the provider has a connected account record.
   */
  async _getPayeeAccount(payeeId) {
    const { data: payeeAccount } = await supabaseAdmin
      .from('StripeAccount')
      .select('stripe_account_id, charges_enabled, payouts_enabled')
      .eq('user_id', payeeId)
      .single();

    if (!payeeAccount) {
      throw new Error('Payee has no Stripe account. They must complete onboarding first.');
    }
    if (!payeeAccount.stripe_account_id) {
      throw new Error('Payee has no Stripe account. They must complete onboarding first.');
    }
    return payeeAccount;
  }

  /**
   * Non-throwing variant of _getPayeeAccount.
   * Returns the payee's StripeAccount or null if they haven't onboarded.
   * Used in flows where the payee's Stripe account is informational metadata,
   * not a hard requirement (e.g., wallet-based settlement).
   */
  async _getPayeeAccountOptional(payeeId) {
    try {
      return await this._getPayeeAccount(payeeId);
    } catch {
      return null;
    }
  }

  /**
   * Create a SetupIntent for saving a card for future authorization.
   * Used when the gig starts beyond 5 days from now.
   *
   * Flow: accept-bid → createSetupIntent → frontend confirms → card saved →
   *       T-24h job creates PaymentIntent off-session
   */
  async createSetupIntent({ payerId, payeeId, gigId, amount, homeId, metadata = {} }) {
    try {
      const payeeAccount = await this._getPayeeAccountOptional(payeeId);
      const customerId = await this.getOrCreateCustomer(payerId);
      const feeRate = await this.getEffectiveFeeRate(payeeId);
      const fees = this.calculateFees(amount, feeRate);

      const siMetadata = {
        payer_id: payerId,
        payee_id: payeeId,
        gig_id: gigId || '',
        amount: String(amount),
        platform_fee: String(fees.platformFee),
        ...metadata,
      };
      if (payeeAccount?.stripe_account_id) {
        siMetadata.payee_stripe_account = payeeAccount.stripe_account_id;
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: siMetadata,
        usage: 'off_session',
      });

      // Insert Payment record
      const { data: payment, error: dbError } = await supabaseAdmin
        .from('Payment')
        .insert({
          payer_id: payerId,
          payee_id: payeeId,
          gig_id: gigId,
          home_id: homeId || null,
          stripe_setup_intent_id: setupIntent.id,
          stripe_customer_id: customerId,
          amount_total: amount,
          amount_subtotal: amount,
          amount_platform_fee: fees.platformFee,
          amount_to_payee: fees.amountToPayee,
          amount_processing_fee: fees.estimatedStripeFee,
          payment_status: PAYMENT_STATES.SETUP_PENDING,
          payment_type: 'gig_payment',
          is_escrowed: true,
          metadata: metadata,
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Error saving payment record for SetupIntent', { error: dbError.message });
        throw new Error(`Failed to save payment: ${dbError.message}`);
      }

      logger.info('SetupIntent created', {
        setupIntentId: setupIntent.id,
        paymentId: payment.id,
        amount,
        gigId,
      });

      return {
        success: true,
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        paymentId: payment.id,
        payment,
      };

    } catch (err) {
      logger.error('Error creating SetupIntent', { error: err.message, gigId });
      throw err;
    }
  }

  /**
   * Called after frontend confirms the SetupIntent (card saved).
   * Retrieves the SetupIntent from Stripe, extracts the saved payment method,
   * and transitions payment to ready_to_authorize.
   */
  async confirmSetupAndSaveCard(paymentId) {
    try {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) throw new Error('Payment not found');
      if (payment.payment_status !== PAYMENT_STATES.SETUP_PENDING) {
        throw new Error(`Cannot confirm setup: payment is in ${payment.payment_status} state`);
      }

      // Retrieve SetupIntent from Stripe to get the saved payment method
      const setupIntent = await stripe.setupIntents.retrieve(payment.stripe_setup_intent_id);

      if (setupIntent.status !== 'succeeded') {
        throw new Error(`SetupIntent not succeeded: ${setupIntent.status}`);
      }

      const paymentMethodId = setupIntent.payment_method;

      // Transition state
      await transitionPaymentStatus(paymentId, PAYMENT_STATES.READY_TO_AUTHORIZE, {
        stripe_payment_method_id: paymentMethodId,
      });

      logger.info('Setup confirmed, card saved', { paymentId, paymentMethodId });

      return { success: true, paymentMethodId };

    } catch (err) {
      logger.error('Error confirming setup', { error: err.message, paymentId });
      throw err;
    }
  }

  /**
   * Create a PaymentIntent with manual capture for gig payment.
   * Uses Separate Charges and Transfers — NO transfer_data on the PI.
   * Charge stays on the platform until explicit transfer.
   *
   * @param {object} opts
   * @param {string} opts.payerId - UUID of the payer (gig poster)
   * @param {string} opts.payeeId - UUID of the payee (worker)
   * @param {string} opts.gigId - UUID of the gig
   * @param {number} opts.amount - Amount in cents
   * @param {string} [opts.paymentMethodId] - Stripe pm_xxx (required for off-session)
   * @param {boolean} [opts.offSession=false] - If true, confirms immediately off-session
   * @param {string} [opts.existingPaymentId] - If updating an existing Payment record (e.g., from SetupIntent flow)
   * @param {string} [opts.homeId] - Optional home FK
   * @param {object} [opts.metadata] - Extra metadata
   * @param {string} [opts.description] - Stripe/Payment description
   * @param {string} [opts.idempotencyKey] - Stable Stripe idempotency key for this order
   */
  async createPaymentIntentForGig({
    payerId,
    payeeId,
    gigId,
    amount,
    // ISO 4217, lowercase for Stripe. Scheduling event types / packages are host-priced in
    // their own currency (design offers USD/EUR) — charging their magnitude as USD is wrong.
    currency = 'usd',
    paymentMethodId,
    offSession = false,
    existingPaymentId,
    homeId,
    metadata = {},
    description,
    idempotencyKey,
  }) {
    try {
      const payeeAccount = await this._getPayeeAccountOptional(payeeId);
      const customerId = await this.getOrCreateCustomer(payerId);
      const feeRate = await this.getEffectiveFeeRate(payeeId);
      const fees = this.calculateFees(amount, feeRate);

      // Build PaymentIntent params — Separate Charges and Transfers
      // No transfer_data, no application_fee_amount
      const piMetadata = {
        payer_id: payerId,
        payee_id: payeeId,
        gig_id: gigId || '',
        platform_fee: String(fees.platformFee),
        ...metadata,
      };
      if (payeeAccount?.stripe_account_id) {
        piMetadata.payee_stripe_account = payeeAccount.stripe_account_id;
      }

      const piParams = {
        amount,
        currency: String(currency || 'usd').toLowerCase(),
        customer: customerId,
        capture_method: 'manual', // Hold, don't capture
        metadata: piMetadata,
        description: description || `Pantopus Gig Payment - ${gigId || 'unknown'}`,
      };

      if (paymentMethodId) {
        piParams.payment_method = paymentMethodId;
      }
      if (offSession) {
        piParams.off_session = true;
        piParams.confirm = true;
        piParams.metadata.off_session = 'true';
      }

      const paymentIntent = idempotencyKey
        ? await stripe.paymentIntents.create(piParams, { idempotencyKey })
        : await stripe.paymentIntents.create(piParams);

      // Determine initial status based on Stripe response
      let initialStatus = PAYMENT_STATES.AUTHORIZE_PENDING;
      if (paymentIntent.status === 'requires_capture') {
        initialStatus = PAYMENT_STATES.AUTHORIZED;
      }

      const now = new Date().toISOString();
      const authExpires = new Date(Date.now() + AUTH_HOLD_MS).toISOString();

      if (existingPaymentId) {
        // Update existing Payment record (from SetupIntent → PaymentIntent)
        await transitionPaymentStatus(existingPaymentId, initialStatus, {
          stripe_payment_intent_id: paymentIntent.id,
          stripe_payment_method_id: paymentMethodId || null,
          authorization_expires_at: initialStatus === PAYMENT_STATES.AUTHORIZED ? authExpires : null,
          payment_attempted_at: now,
          payment_succeeded_at: initialStatus === PAYMENT_STATES.AUTHORIZED ? now : null,
          metadata,
          ...(description ? { description } : {}),
        });

        const { data: updated } = await supabaseAdmin
          .from('Payment')
          .select('*')
          .eq('id', existingPaymentId)
          .single();

        logger.info('PaymentIntent created (existing payment)', {
          paymentIntentId: paymentIntent.id,
          paymentId: existingPaymentId,
          status: initialStatus,
          amount,
          gigId,
        });

        return {
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          paymentId: existingPaymentId,
          payment: updated,
        };

      } else {
        // Insert new Payment record
        const { data: payment, error: dbError } = await supabaseAdmin
          .from('Payment')
          .insert({
            payer_id: payerId,
            payee_id: payeeId,
            gig_id: gigId,
            home_id: homeId || null,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_customer_id: customerId,
            stripe_payment_method_id: paymentMethodId || null,
            amount_total: amount,
            amount_subtotal: amount,
            amount_platform_fee: fees.platformFee,
            amount_to_payee: fees.amountToPayee,
            amount_processing_fee: fees.estimatedStripeFee,
            payment_status: initialStatus,
            payment_type: 'gig_payment',
            is_escrowed: true,
            authorization_expires_at: initialStatus === PAYMENT_STATES.AUTHORIZED ? authExpires : null,
            payment_attempted_at: now,
            payment_succeeded_at: initialStatus === PAYMENT_STATES.AUTHORIZED ? now : null,
            description: description || null,
            metadata,
          })
          .select()
          .single();

        if (dbError) {
          if (dbError.code === '23505' && paymentIntent.id) {
            const { data: existingPayment } = await supabaseAdmin
              .from('Payment')
              .select('*')
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .single();

            if (existingPayment) {
              return {
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                paymentId: existingPayment.id,
                payment: existingPayment,
                reused: true,
              };
            }
          }

          logger.error('Error saving payment record', { error: dbError.message });
          throw new Error(`Failed to save payment: ${dbError.message}`);
        }

        logger.info('PaymentIntent created (new payment)', {
          paymentIntentId: paymentIntent.id,
          paymentId: payment.id,
          status: initialStatus,
          amount,
          gigId,
        });

        return {
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          paymentId: payment.id,
          payment,
        };
      }

    } catch (err) {
      // Handle SCA / authentication_required for off-session
      if (offSession && err.code === 'authentication_required' && existingPaymentId) {
        logger.warn('Off-session auth required', { paymentId: existingPaymentId, gigId });
        await transitionPaymentStatus(existingPaymentId, PAYMENT_STATES.AUTHORIZATION_FAILED, {
          off_session_auth_required: true,
          failure_code: err.code,
          failure_message: err.message,
        });
        return {
          success: false,
          error: 'authentication_required',
          paymentId: existingPaymentId,
          paymentIntentId: err.raw?.payment_intent?.id,
        };
      }

      logger.error('Error creating PaymentIntent', { error: err.message, gigId });
      throw err;
    }
  }

  /**
   * Capture a previously authorized PaymentIntent.
   * Called when the requester confirms completion.
   * Transitions to captured_hold and starts the cooling-off timer.
   */
  async capturePayment(paymentId) {
    try {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) throw new Error('Payment not found');
      if (payment.payment_status !== PAYMENT_STATES.AUTHORIZED) {
        throw new Error(`Cannot capture: payment is in ${payment.payment_status} state`);
      }

      // Enforce capture attempt cap to prevent infinite Stripe API spam
      const currentAttempts = payment.capture_attempts || 0;
      if (currentAttempts >= MAX_CAPTURE_ATTEMPTS) {
        const err = new Error(`Capture attempt limit reached (${MAX_CAPTURE_ATTEMPTS}) for payment ${paymentId}`);
        err.code = 'capture_attempts_exhausted';
        logger.error('capturePayment: attempt limit reached', {
          paymentId,
          attempts: currentAttempts,
          max: MAX_CAPTURE_ATTEMPTS,
        });
        throw err;
      }

      // Increment capture_attempts counter
      await supabaseAdmin
        .from('Payment')
        .update({ capture_attempts: currentAttempts + 1 })
        .eq('id', paymentId);

      // Capture on Stripe
      const captured = await stripe.paymentIntents.capture(payment.stripe_payment_intent_id);

      const now = new Date();
      const coolingOffEnds = new Date(now.getTime() + COOLING_OFF_MS);

      // Transition state
      await transitionPaymentStatus(paymentId, PAYMENT_STATES.CAPTURED_HOLD, {
        captured_at: now.toISOString(),
        cooling_off_ends_at: coolingOffEnds.toISOString(),
        stripe_charge_id: captured.latest_charge,
        payment_succeeded_at: now.toISOString(),
      });

      logger.info('Payment captured', {
        paymentId,
        chargeId: captured.latest_charge,
        coolingOffEnds: coolingOffEnds.toISOString(),
      });

      return { success: true, chargeId: captured.latest_charge };

    } catch (err) {
      // Reconcile local state if Stripe already captured this PI but
      // our DB transition was missed (e.g., webhook timing/race in dev).
      if (err?.code === 'payment_intent_unexpected_state' || /already been captured/i.test(err?.message || '')) {
        try {
          const { data: payment } = await supabaseAdmin
            .from('Payment')
            .select('id, payment_status, stripe_payment_intent_id')
            .eq('id', paymentId)
            .single();

          if (payment?.stripe_payment_intent_id && payment.payment_status === PAYMENT_STATES.AUTHORIZED) {
            const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
              expand: ['latest_charge'],
            });
            const chargeObj = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
            const capturedAt = chargeObj?.created
              ? new Date(chargeObj.created * 1000)
              : new Date();
            const coolingOffEnds = new Date(capturedAt.getTime() + COOLING_OFF_MS);

            await transitionPaymentStatus(paymentId, PAYMENT_STATES.CAPTURED_HOLD, {
              captured_at: capturedAt.toISOString(),
              cooling_off_ends_at: coolingOffEnds.toISOString(),
              stripe_charge_id: chargeObj?.id || null,
              payment_succeeded_at: capturedAt.toISOString(),
            });

            logger.warn('Capture reconciliation applied after Stripe already-captured response', {
              paymentId,
              stripePaymentIntentId: payment.stripe_payment_intent_id,
            });

            return { success: true, alreadyCaptured: true, chargeId: chargeObj?.id || null };
          }
        } catch (reconcileErr) {
          logger.error('Capture reconciliation failed', {
            error: reconcileErr.message,
            paymentId,
          });
        }
      }

      logger.error('Error capturing payment', { error: err.message, paymentId });
      throw err;
    }
  }

  /**
   * Create an explicit transfer to the provider's Connect account.
   * Called by the processPendingTransfers background job after cooling off.
   * Uses source_transaction to link the transfer to the original charge.
   */
  async createTransfer(paymentId) {
    try {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) throw new Error('Payment not found');
      if (!['captured_hold', 'transfer_scheduled'].includes(payment.payment_status)) {
        throw new Error(`Cannot transfer: payment is in ${payment.payment_status} state`);
      }
      if (!payment.stripe_charge_id) {
        throw new Error('No charge ID on payment — cannot create transfer');
      }

      // Get payee's Stripe Connect account
      const { data: payeeAccount } = await supabaseAdmin
        .from('StripeAccount')
        .select('stripe_account_id, payouts_enabled')
        .eq('user_id', payment.payee_id)
        .single();

      if (!payeeAccount) {
        throw new Error('Payee Stripe account not found');
      }
      if (!payeeAccount.payouts_enabled) {
        throw new Error('Payee payouts not enabled — skipping transfer');
      }

      // Create transfer
      const transfer = await stripe.transfers.create({
        amount: payment.amount_to_payee,
        currency: payment.currency || 'usd',
        destination: payeeAccount.stripe_account_id,
        source_transaction: payment.stripe_charge_id,
        metadata: {
          payment_id: paymentId,
          gig_id: payment.gig_id || '',
          payer_id: payment.payer_id,
          payee_id: payment.payee_id,
        },
      });

      // Transition state
      await transitionPaymentStatus(paymentId, PAYMENT_STATES.TRANSFER_PENDING, {
        stripe_transfer_id: transfer.id,
        transfer_status: 'in_transit',
        transfer_scheduled_at: new Date().toISOString(),
      });

      logger.info('Transfer created', {
        paymentId,
        transferId: transfer.id,
        amount: payment.amount_to_payee,
        destination: payeeAccount.stripe_account_id,
      });

      return { success: true, transferId: transfer.id };

    } catch (err) {
      logger.error('Error creating transfer', { error: err.message, paymentId });
      throw err;
    }
  }

  /**
   * Cancel a PaymentIntent authorization (release the hold).
   * Used when a gig is cancelled before capture.
   */
  async cancelAuthorization(paymentId) {
    try {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) throw new Error('Payment not found');

      const cancellableStates = [
        PAYMENT_STATES.AUTHORIZED,
        PAYMENT_STATES.AUTHORIZE_PENDING,
        PAYMENT_STATES.AUTHORIZATION_FAILED,
        PAYMENT_STATES.SETUP_PENDING,
        PAYMENT_STATES.READY_TO_AUTHORIZE,
      ];

      if (!cancellableStates.includes(payment.payment_status)) {
        throw new Error(`Cannot cancel authorization: payment is in ${payment.payment_status} state`);
      }

      // Cancel on Stripe if a PaymentIntent exists
      if (payment.stripe_payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
        } catch (stripeErr) {
          // PI might already be canceled or in a non-cancellable state
          logger.warn('Stripe PI cancel attempt', { error: stripeErr.message, paymentId });
        }
      }

      // Cancel SetupIntent if applicable
      if (payment.stripe_setup_intent_id && !payment.stripe_payment_intent_id) {
        try {
          await stripe.setupIntents.cancel(payment.stripe_setup_intent_id);
        } catch (stripeErr) {
          logger.warn('Stripe SI cancel attempt', { error: stripeErr.message, paymentId });
        }
      }

      await transitionPaymentStatus(paymentId, PAYMENT_STATES.CANCELED);

      logger.info('Authorization canceled', { paymentId });
      return { success: true };

    } catch (err) {
      logger.error('Error canceling authorization', { error: err.message, paymentId });
      throw err;
    }
  }

  /**
   * Smart refund that handles three scenarios based on payment state:
   * 1. Before capture (authorized) → cancel PI (release hold)
   * 2. After capture, before transfer → normal Stripe refund
   * 3. After transfer → refund customer + transfer reversal
   *
   * @param {string} paymentId
   * @param {number|null} amount - Refund amount in cents (null = full refund)
   * @param {string} reason - Refund reason
   * @param {string} initiatedBy - UUID of who initiated
   */
  async createSmartRefund(paymentId, amount, reason, initiatedBy) {
    try {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) throw new Error('Payment not found');

      const refundAmount = amount || payment.amount_total;

      // Validate refund amount doesn't exceed remaining refundable amount
      const alreadyRefunded = payment.refunded_amount || 0;
      const maxRefundable = payment.amount_total - alreadyRefunded;
      if (refundAmount <= 0) {
        throw new Error('Refund amount must be positive');
      }
      if (refundAmount > maxRefundable) {
        throw new Error(
          `Refund amount ($${(refundAmount / 100).toFixed(2)}) exceeds remaining refundable amount ($${(maxRefundable / 100).toFixed(2)})`
        );
      }

      const status = payment.payment_status;

      // Scenario 1: Before capture — cancel PI (release hold)
      if ([PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.AUTHORIZE_PENDING].includes(status)) {
        return await this.cancelAuthorization(paymentId);
      }

      // Scenario 2: After capture, before transfer
      if ([PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.TRANSFER_SCHEDULED].includes(status)) {
        // Move to intermediate state BEFORE any external side effects
        await transitionPaymentStatus(paymentId, PAYMENT_STATES.REFUND_PENDING, {
          refund_reason: reason,
        });

        const refund = await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: refundAmount,
          reason: reason === 'fraudulent' ? 'fraudulent' : 'requested_by_customer',
          metadata: { payment_id: paymentId, initiated_by: initiatedBy },
        });

        // Save refund record after Stripe succeeds
        await supabaseAdmin.from('Refund').insert({
          payment_id: paymentId,
          stripe_refund_id: refund.id,
          amount: refundAmount,
          reason,
          refund_status: refund.status,
          initiated_by: initiatedBy,
        });

        const isFullRefund = refundAmount >= payment.amount_total;
        await transitionPaymentStatus(
          paymentId,
          isFullRefund ? PAYMENT_STATES.REFUNDED_FULL : PAYMENT_STATES.REFUNDED_PARTIAL,
          {
            refunded_amount: (payment.refunded_amount || 0) + refundAmount,
          }
        );

        logger.info('Refund created (pre-transfer)', { paymentId, refundAmount, refundId: refund.id });
        return { success: true, refundId: refund.id };
      }

      // Scenario 3: After transfer — refund customer + reverse transfer
      if ([PAYMENT_STATES.TRANSFER_PENDING, PAYMENT_STATES.TRANSFERRED].includes(status)) {
        // Move to intermediate state BEFORE any external side effects
        await transitionPaymentStatus(paymentId, PAYMENT_STATES.REFUND_PENDING, {
          refund_reason: reason,
        });

        // Step 1: Refund the customer
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: refundAmount,
          reason: reason === 'fraudulent' ? 'fraudulent' : 'requested_by_customer',
          metadata: { payment_id: paymentId, initiated_by: initiatedBy },
        });

        await supabaseAdmin.from('Refund').insert({
          payment_id: paymentId,
          stripe_refund_id: refund.id,
          amount: refundAmount,
          reason,
          refund_status: refund.status,
          initiated_by: initiatedBy,
        });

        // Step 2: Reverse the transfer to claw back from provider
        let reversalResult = null;
        if (payment.stripe_transfer_id) {
          // Calculate the provider's portion of the refund
          const providerRefundAmount = Math.min(
            Math.floor(refundAmount * payment.amount_to_payee / payment.amount_total),
            payment.amount_to_payee
          );

          try {
            const reversal = await stripe.transfers.createReversal(
              payment.stripe_transfer_id,
              {
                amount: providerRefundAmount,
                metadata: { payment_id: paymentId, reason },
              }
            );
            reversalResult = reversal;

            await supabaseAdmin.from('Payment').update({
              stripe_transfer_reversal_id: reversal.id,
            }).eq('id', paymentId);

            logger.info('Transfer reversed', { paymentId, reversalId: reversal.id, amount: providerRefundAmount });

          } catch (reversalErr) {
            // Reversal failed — connected account has insufficient balance
            logger.error('Transfer reversal failed — provider may have insufficient balance', {
              error: reversalErr.message,
              paymentId,
              transferId: payment.stripe_transfer_id,
            });
            // Record the failure — this becomes a debt the provider owes
            await supabaseAdmin.from('Payment').update({
              metadata: {
                ...payment.metadata,
                reversal_failed: true,
                reversal_failure_reason: reversalErr.message,
                reversal_failed_at: new Date().toISOString(),
                provider_debt_amount: providerRefundAmount,
              },
            }).eq('id', paymentId);
          }
        }

        const isFullRefund = refundAmount >= payment.amount_total;
        await transitionPaymentStatus(
          paymentId,
          isFullRefund ? PAYMENT_STATES.REFUNDED_FULL : PAYMENT_STATES.REFUNDED_PARTIAL,
          {
            refunded_amount: (payment.refunded_amount || 0) + refundAmount,
          }
        );

        logger.info('Refund created (post-transfer)', { paymentId, refundAmount, refundId: refund.id });
        return { success: true, refundId: refund.id, reversalResult };
      }

      throw new Error(`Cannot refund: payment is in ${status} state`);

    } catch (err) {
      logger.error('Error creating smart refund', { error: err.message, paymentId });
      throw err;
    }
  }

  /**
   * Create a tip payment (separate PaymentIntent, auto-capture).
   * Tips are charged immediately and transferred after a short delay.
   *
   * Tips go 100% to the worker — no Pantopus platform fee is deducted.
   * Pantopus also absorbs the Stripe processing fee on tips, so the worker's
   * wallet receives the full tip amount.
   */
  async createTipPayment({ payerId, payeeId, gigId, amount, paymentMethodId, offSession = false }) {
    try {
      const payeeAccount = await this._getPayeeAccount(payeeId);
      const customerId = await this.getOrCreateCustomer(payerId);

      // Tips: 100% to worker. No platform fee, and Pantopus absorbs processing.
      const estimatedStripeFee = Math.floor(amount * 0.029) + 30; // 2.9% + 30¢
      const platformFee = 0;
      const amountToPayee = amount;

      const piParams = {
        amount,
        currency: 'usd',
        customer: customerId,
        // Tips are auto-captured (no manual capture needed)
        metadata: {
          payer_id: payerId,
          payee_id: payeeId,
          gig_id: gigId || '',
          payment_type: 'tip',
          platform_fee: '0',
          payee_stripe_account: payeeAccount.stripe_account_id,
        },
        description: `Pantopus Tip - Gig ${gigId || 'unknown'}`,
      };

      if (paymentMethodId) {
        piParams.payment_method = paymentMethodId;
      }
      if (offSession) {
        piParams.off_session = true;
        piParams.confirm = true;
      }

      const paymentIntent = await stripe.paymentIntents.create(piParams);
      const isTipCaptured = paymentIntent.status === 'succeeded';

      // Insert with AUTHORIZE_PENDING — the natural initial state when a PI is created
      const { data: payment, error: dbError } = await supabaseAdmin
        .from('Payment')
        .insert({
          payer_id: payerId,
          payee_id: payeeId,
          gig_id: gigId,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: customerId,
          stripe_payment_method_id: paymentMethodId || null,
          amount_total: amount,
          amount_subtotal: amount,
          amount_platform_fee: platformFee,
          amount_to_payee: amountToPayee,
          amount_processing_fee: estimatedStripeFee,
          payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
          payment_type: 'tip',
          tip_amount: amount,
          is_escrowed: true,
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Error saving tip payment', { error: dbError.message });
        throw new Error(`Failed to save tip payment: ${dbError.message}`);
      }

      // If the auto-capture PI already succeeded, reconcile immediately so the
      // worker sees the tip in wallet/history even if webhooks are delayed.
      if (isTipCaptured) {
        try {
          await this.syncTipPaymentStatus(payment.id, { paymentIntent });
        } catch (transErr) {
          logger.error('Tip payment: success reconciliation failed', {
            paymentId: payment.id, error: transErr.message,
          });
        }
      }

      // For on-session tips (no paymentMethodId), mint an ephemeral key so the
      // mobile PaymentSheet can display saved cards and let the user pick one.
      // Web ignores these fields.
      let ephemeralKey = null;
      if (!paymentMethodId) {
        try {
          const key = await this.createEphemeralKey(customerId);
          ephemeralKey = key.secret;
        } catch (ekErr) {
          logger.warn('Tip payment: failed to create ephemeral key', {
            paymentId: payment.id, error: ekErr.message,
          });
        }
      }

      logger.info('Tip payment created', {
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        amount,
        gigId,
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        payment,
        customer: customerId,
        ephemeralKey,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      };

    } catch (err) {
      logger.error('Error creating tip payment', { error: err.message, gigId });
      throw err;
    }
  }

  // ============ LEGACY METHODS (kept for backward compatibility) ============

  /**
   * @deprecated Use createPaymentIntentForGig instead.
   * Legacy createPaymentIntent using destination charges.
   */
  async createPaymentIntent(paymentData) {
    logger.warn('Deprecated: createPaymentIntent called. Use createPaymentIntentForGig instead.');
    return this.createPaymentIntentForGig({
      payerId: paymentData.payerId,
      payeeId: paymentData.payeeId,
      amount: paymentData.amount,
      gigId: paymentData.gigId,
      metadata: paymentData.metadata,
    });
  }

  /**
   * @deprecated Use createSmartRefund instead.
   */
  async createRefund(paymentId, amount, reason, initiatedBy) {
    return this.createSmartRefund(paymentId, amount, reason, initiatedBy);
  }

  // ============ PAYMENT METHODS ============

  /**
   * Sync the payment method from a Payment record to the local PaymentMethod table.
   * Reads the Stripe PaymentIntent to get the attached payment_method, fetches its
   * details, and upserts into the local table. Safe to call multiple times (idempotent).
   */
  async syncPaymentMethodToLocal(paymentId, userId) {
    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('stripe_payment_intent_id')
      .eq('id', paymentId)
      .single();

    if (!payment?.stripe_payment_intent_id) {
      logger.info('syncPaymentMethodToLocal: no stripe_payment_intent_id', { paymentId });
      return;
    }

    const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
      expand: ['payment_method'],
    });

    // payment_method can be a string ID or an expanded object
    const pmObj = typeof pi?.payment_method === 'object' ? pi.payment_method : null;
    const pmId = pmObj?.id || (typeof pi?.payment_method === 'string' ? pi.payment_method : null);
    if (!pmId) {
      logger.info('syncPaymentMethodToLocal: no payment_method on PI', {
        paymentIntentId: payment.stripe_payment_intent_id,
      });
      return;
    }

    // Already saved? If exists but missing details, update it.
    const { data: existing } = await supabaseAdmin
      .from('PaymentMethod')
      .select('id, card_last4')
      .eq('stripe_payment_method_id', pmId)
      .maybeSingle();

    if (existing?.card_last4) return; // Already saved with full details

    // If we got an expanded object, use it directly; otherwise retrieve
    const pm = pmObj || await stripe.paymentMethods.retrieve(pmId);
    const card = pm?.card;

    const { data: existingMethods } = await supabaseAdmin
      .from('PaymentMethod')
      .select('id')
      .eq('user_id', userId);

    const row = {
      user_id: userId,
      stripe_customer_id: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null,
      stripe_payment_method_id: pmId,
      payment_method_type: pm?.type || 'card',
      card_brand: card?.brand || null,
      card_last4: card?.last4 || null,
      card_exp_month: card?.exp_month || null,
      card_exp_year: card?.exp_year || null,
      card_funding: card?.funding || null,
      is_default: !existingMethods || existingMethods.length === 0,
    };

    let insertErr;
    if (existing) {
      // Update the existing record with missing details
      ({ error: insertErr } = await supabaseAdmin
        .from('PaymentMethod')
        .update(row)
        .eq('id', existing.id));
    } else {
      ({ error: insertErr } = await supabaseAdmin
        .from('PaymentMethod')
        .insert(row));
    }

    if (insertErr) {
      logger.error('syncPaymentMethodToLocal: save failed', { error: insertErr.message, pmId });
    } else {
      logger.info('syncPaymentMethodToLocal: saved', {
        paymentMethodId: pmId,
        userId,
        brand: card?.brand,
        last4: card?.last4,
      });
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(userId, paymentMethodId) {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      const details = {
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        payment_method_type: paymentMethod.type
      };

      if (paymentMethod.type === 'card') {
        details.card_brand = paymentMethod.card.brand;
        details.card_last4 = paymentMethod.card.last4;
        details.card_exp_month = paymentMethod.card.exp_month;
        details.card_exp_year = paymentMethod.card.exp_year;
        details.card_funding = paymentMethod.card.funding;
      } else if (paymentMethod.type === 'us_bank_account') {
        details.bank_name = paymentMethod.us_bank_account.bank_name;
        details.bank_last4 = paymentMethod.us_bank_account.last4;
        details.bank_account_type = paymentMethod.us_bank_account.account_type;
      }

      const { data: existingMethods } = await supabaseAdmin
        .from('PaymentMethod')
        .select('id')
        .eq('user_id', userId);

      const isFirstMethod = !existingMethods || existingMethods.length === 0;

      const { data: savedMethod, error: dbError } = await supabaseAdmin
        .from('PaymentMethod')
        .insert({
          user_id: userId,
          ...details,
          is_default: isFirstMethod
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Error saving payment method', { error: dbError.message });
      }

      if (isFirstMethod) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId }
        });
      }

      logger.info('Payment method attached', { userId, paymentMethodId });
      return { success: true, paymentMethod: savedMethod };

    } catch (err) {
      logger.error('Error attaching payment method', { error: err.message, userId });
      throw err;
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    try {
      const { data: method } = await supabaseAdmin
        .from('PaymentMethod')
        .select('*')
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .single();

      if (!method) throw new Error('Payment method not found');

      await supabaseAdmin
        .from('PaymentMethod')
        .update({ is_default: false })
        .eq('user_id', userId);

      await supabaseAdmin
        .from('PaymentMethod')
        .update({ is_default: true })
        .eq('id', paymentMethodId);

      await stripe.customers.update(method.stripe_customer_id, {
        invoice_settings: { default_payment_method: method.stripe_payment_method_id }
      });

      logger.info('Default payment method set', { userId, paymentMethodId });
      return { success: true };

    } catch (err) {
      logger.error('Error setting default payment method', { error: err.message });
      throw err;
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(userId, paymentMethodId) {
    try {
      const { data: method } = await supabaseAdmin
        .from('PaymentMethod')
        .select('*')
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .single();

      if (!method) throw new Error('Payment method not found');

      await stripe.paymentMethods.detach(method.stripe_payment_method_id);

      await supabaseAdmin
        .from('PaymentMethod')
        .delete()
        .eq('id', paymentMethodId);

      if (method.is_default) {
        const { data: fallbackMethods, error: fallbackError } = await supabaseAdmin
          .from('PaymentMethod')
          .select('id, stripe_payment_method_id')
          .eq('user_id', userId)
          .neq('id', paymentMethodId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (fallbackError) {
          logger.error('Error finding replacement default payment method', {
            error: fallbackError.message,
            userId,
          });
        }

        const fallback = Array.isArray(fallbackMethods) ? fallbackMethods[0] : null;
        if (fallback?.id) {
          await supabaseAdmin
            .from('PaymentMethod')
            .update({ is_default: true })
            .eq('id', fallback.id);
          if (method.stripe_customer_id) {
            await stripe.customers.update(method.stripe_customer_id, {
              invoice_settings: { default_payment_method: fallback.stripe_payment_method_id },
            });
          }
        } else if (method.stripe_customer_id) {
          await stripe.customers.update(method.stripe_customer_id, {
            invoice_settings: { default_payment_method: null },
          });
        }
      }

      logger.info('Payment method deleted', { userId, paymentMethodId });
      return { success: true };

    } catch (err) {
      logger.error('Error deleting payment method', { error: err.message });
      throw err;
    }
  }

  // ============ MOBILE PAYMENT SHEET ============

  /**
   * Create an ephemeral key for a Stripe customer.
   * Used by mobile PaymentSheet to access saved payment methods.
   */
  async createEphemeralKey(customerId, apiVersion = '2024-06-20') {
    try {
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion },
      );
      return ephemeralKey;
    } catch (err) {
      logger.error('Error creating ephemeral key', { error: err.message, customerId });
      throw err;
    }
  }

  /**
   * Get payment sheet params for a gig's pending payment.
   * Returns everything the mobile PaymentSheet needs.
   */
  async getPaymentSheetParams(gigId, userId) {
    try {
      // Look up the gig payment
      const { data: gig } = await supabaseAdmin
        .from('Gig')
        .select('id, payment_id, payment_status, user_id, price')
        .eq('id', gigId)
        .single();

      if (!gig) throw new Error('Gig not found');
      if (gig.user_id !== userId) throw new Error('Only the gig owner can set up payment');

      // Get the payment record
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('id, stripe_payment_intent_id, stripe_setup_intent_id, payment_status, amount_total')
        .eq('id', gig.payment_id)
        .single();

      if (!payment) throw new Error('No payment found for this gig');

      const customerId = await this.getOrCreateCustomer(userId);
      const ephemeralKey = await this.createEphemeralKey(customerId);

      // Determine client secret
      let clientSecret = null;
      let isSetupIntent = false;

      if (payment.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
        clientSecret = pi.client_secret;
      } else if (payment.stripe_setup_intent_id) {
        const si = await stripe.setupIntents.retrieve(payment.stripe_setup_intent_id);
        clientSecret = si.client_secret;
        isSetupIntent = true;
      }

      if (!clientSecret) throw new Error('No active payment intent found');

      return {
        paymentIntent: clientSecret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        isSetupIntent,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      };
    } catch (err) {
      logger.error('Error getting payment sheet params', { error: err.message, gigId, userId });
      throw err;
    }
  }

  /**
   * Get Stripe mobile PaymentSheet params for adding/saving a card only.
   * This creates a standalone SetupIntent tied to the user Stripe customer.
   */
  async getAddCardSheetParams(userId) {
    try {
      const customerId = await this.getOrCreateCustomer(userId);
      const ephemeralKey = await this.createEphemeralKey(customerId);
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          source: 'mobile_add_card',
          user_id: userId,
        },
      });

      return {
        setupIntent: setupIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      };
    } catch (err) {
      logger.error('Error getting add-card payment sheet params', { error: err.message, userId });
      throw err;
    }
  }
}

module.exports = new StripeService();
