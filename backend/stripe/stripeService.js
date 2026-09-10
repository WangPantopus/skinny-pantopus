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
const { conflict, providerId, assertPaymentTerms, assertIntentBinding, assertAuthorizedIntent, assertCapturedIntent } = require('./gigPaymentProof');

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
  async _readPayment(paymentId) {
    const { data, error } = await supabaseAdmin.from('Payment').select('*').eq('id', paymentId).single();
    if (error || !data) throw conflict('Payment could not be verified');
    return data;
  }

  async recoverGigPayment(attempt) {
    // Provider recovery is scoped to the payer's durable customer, never a
    // global search or a caller-supplied intent. Absence is not creation proof.
    const { data: payer, error } = await supabaseAdmin.from('User').select('stripe_customer_id')
      .eq('id', attempt.payer_id).single();
    if (error || !payer) throw conflict('The payment customer could not be verified');
    if (!payer.stripe_customer_id) return null;
    const createdAt = Date.parse(attempt.created_at);
    if (!Number.isFinite(createdAt)) throw conflict('The payment operation time could not be verified');
    const matches = [];
    let after;
    for (let page = 0; page < 10; page += 1) {
      const batch = await stripe.paymentIntents.list({
        customer: payer.stripe_customer_id, limit: 100,
        created: { gte: Math.max(0, Math.floor(createdAt / 1000) - 300) },
        ...(after ? { starting_after: after } : {}),
      });
      if (!Array.isArray(batch?.data)) throw conflict('Provider reconciliation is incomplete');
      for (const candidate of batch.data) {
        if (candidate.metadata?.acceptance_attempt_id === attempt.id) matches.push(candidate);
      }
      if (matches.length > 1) throw conflict('Multiple provider intents need reconciliation for this operation');
      if (!batch.has_more) break;
      after = batch.data.at(-1)?.id;
      if (!after || page === 9) throw conflict('Provider reconciliation is incomplete');
    }
    if (matches.length === 0) return null;
    // Retrieve again: list contents are candidates, not current provider proof.
    const intent = await stripe.paymentIntents.retrieve(matches[0].id);
    const platformFeeText = intent?.metadata?.platform_fee;
    if (!/^\d+$/.test(platformFeeText || '')) throw conflict('Provider fee terms could not be verified');
    const platformFee = Number(platformFeeText);
    if (!Number.isSafeInteger(platformFee) || platformFee > attempt.amount) throw conflict('Provider fee terms do not match the operation');
    const expected = {
      gig_id: attempt.gig_id, payer_id: attempt.payer_id, payee_id: attempt.payee_id,
      amount_total: attempt.amount, currency: attempt.currency.toUpperCase(), payment_type: 'gig_payment',
      stripe_customer_id: payer.stripe_customer_id, stripe_payment_intent_id: intent.id,
      metadata: { acceptance_attempt_id: attempt.id },
    };
    assertPaymentTerms(expected, { gigId: attempt.gig_id, payerId: attempt.payer_id, payeeId: attempt.payee_id, amount: attempt.amount });
    assertIntentBinding(expected, intent);
    if (!['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture', 'canceled'].includes(intent.status)) {
      throw conflict('The provider intent requires explicit reconciliation');
    }
    if (intent.status === 'requires_capture') assertAuthorizedIntent(expected, intent);
    const status = intent.status === 'canceled' ? PAYMENT_STATES.CANCELED
      : intent.status === 'requires_capture' ? PAYMENT_STATES.AUTHORIZED : PAYMENT_STATES.AUTHORIZE_PENDING;
    const { data: recovered, error: insertError } = await supabaseAdmin.from('Payment').insert({
      ...expected, amount_subtotal: attempt.amount, amount_platform_fee: platformFee,
      amount_to_payee: attempt.amount - platformFee,
      amount_processing_fee: this.calculateFees(attempt.amount).estimatedStripeFee,
      payment_status: status, is_escrowed: true,
      stripe_charge_id: providerId(intent.latest_charge) || null,
      authorization_expires_at: status === PAYMENT_STATES.AUTHORIZED ? new Date(Date.now() + AUTH_HOLD_MS).toISOString() : null,
      payment_attempted_at: new Date(intent.created * 1000 || createdAt).toISOString(),
    }).select('*').single();
    if (insertError) {
      if (insertError.code !== '23505') throw Object.assign(new Error('Could not save recovered payment. Please retry.'), { statusCode: 503 });
      const { data: winner, error: winnerError } = await supabaseAdmin.from('Payment').select('*')
        .eq('stripe_payment_intent_id', intent.id).single();
      if (winnerError || !winner || winner.metadata?.acceptance_attempt_id !== attempt.id) throw conflict('Recovered payment binding changed');
      assertPaymentTerms(winner, { gigId: attempt.gig_id, payerId: attempt.payer_id, payeeId: attempt.payee_id, amount: attempt.amount });
      assertIntentBinding(winner, intent);
      if (winner.amount_platform_fee !== platformFee || winner.amount_to_payee !== attempt.amount - platformFee) {
        throw conflict('Recovered payment fee terms changed');
      }
      return winner;
    }
    if (!recovered) throw conflict('Recovered payment receipt is missing');
    return recovered;
  }

  async resumeGigPayment(paymentId, terms) {
    let payment = assertPaymentTerms(await this._readPayment(paymentId), terms);
    if (!['authorize_pending', 'authorized'].includes(payment.payment_status)) throw conflict('Payment is no longer available for authorization');
    const intent = assertIntentBinding(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id));
    if (!['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture'].includes(intent.status)) {
      throw conflict('Payment is no longer available for authorization');
    }
    const authorizationReady = intent.status === 'requires_capture';
    if (authorizationReady) {
      // Return ready only after fresh exact proof and a saved authorized state.
      payment = (await this.verifyGigAuthorization(payment.id, terms)).payment;
    } else if (!intent.client_secret) {
      throw conflict('The payment sheet could not be prepared');
    }
    return { success: true, paymentId: payment.id, paymentIntentId: intent.id,
      clientSecret: authorizationReady ? null : intent.client_secret, payment, reused: true,
      authorizationReady, paymentStatus: payment.payment_status, providerStatus: intent.status,
      amountCents: payment.amount_total, currency: payment.currency.toLowerCase() };
  }

  async verifyGigAuthorization(paymentId, terms) {
    let payment = assertPaymentTerms(await this._readPayment(paymentId), terms);
    if (!['authorize_pending', 'authorized'].includes(payment.payment_status)) throw conflict('Payment is not available for authorization');
    const intent = assertAuthorizedIntent(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id));
    if (payment.payment_status === PAYMENT_STATES.AUTHORIZE_PENDING) {
      const { data, error } = await supabaseAdmin.from('Payment').update({
        payment_status: PAYMENT_STATES.AUTHORIZED,
        authorization_expires_at: new Date(Date.now() + AUTH_HOLD_MS).toISOString(),
        stripe_charge_id: providerId(intent.latest_charge) || null,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id).eq('payment_status', PAYMENT_STATES.AUTHORIZE_PENDING)
        .eq('stripe_payment_intent_id', intent.id).select('*').maybeSingle();
      if (error) throw Object.assign(new Error('Could not save authorization. Please retry.'), { statusCode: 503 });
      payment = data || assertPaymentTerms(await this._readPayment(payment.id), terms);
    }
    if (payment.payment_status !== PAYMENT_STATES.AUTHORIZED) throw conflict('Authorization changed while it was being verified');
    return { payment_status: payment.payment_status, payment };
  }

  async syncPaymentAuthorizationStatus(paymentId) {
    const payment = await this._readPayment(paymentId);
    if (payment.payment_type === 'gig_payment' && payment.gig_id) {
      return this.verifyGigAuthorization(paymentId, {
        gigId: payment.gig_id, payerId: payment.payer_id, payeeId: payment.payee_id, amount: payment.amount_total,
      });
    }
    if (payment.payment_status !== PAYMENT_STATES.AUTHORIZE_PENDING || !payment.stripe_payment_intent_id) {
      return { payment_status: payment.payment_status };
    }
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    if (intent.status === 'requires_capture') {
      assertAuthorizedIntent(payment, intent);
      const updated = await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZED, {
        authorization_expires_at: new Date(Date.now() + AUTH_HOLD_MS).toISOString(),
        stripe_charge_id: providerId(intent.latest_charge),
      });
      return { payment_status: updated.payment_status };
    }
    return { payment_status: payment.payment_status, stripe_status: intent.status };
  }

  // ============ CUSTOMERS ============

  /**
   * Get or create Stripe customer for a user.
   * Checks User.stripe_customer_id first, then PaymentMethod table,
   * then creates a new customer and persists the ID on User.
   */
  async getOrCreateCustomer(userId) {
    const { data: user, error: userError } = await supabaseAdmin.from('User')
      .select('stripe_customer_id, email, name, username').eq('id', userId).single();
    if (userError) throw new Error('Could not load payment customer');
    if (!user) throw this._addCardError(404, 'Payment customer not found');
    if (user.stripe_customer_id) return user.stripe_customer_id;

    const { data: existingMethod, error: methodError } = await supabaseAdmin.from('PaymentMethod')
      .select('stripe_customer_id').eq('user_id', userId).limit(1).maybeSingle();
    if (methodError) throw new Error('Could not load payment customer');
    let candidate = existingMethod?.stripe_customer_id;
    if (!candidate) {
      // Email/name can change, so a permanent user-scoped provider idempotency
      // key would conflict with later parameters. The CAS below always returns
      // the durable winner; a lost provider response may leave an unused
      // Customer object, but never an intent bound to an uncommitted customer.
      const customer = await stripe.customers.create({
        email: user.email, name: user.name || user.username, metadata: { user_id: userId },
      });
      candidate = customer?.id;
    }
    if (!candidate) throw new Error('Could not create payment customer');
    const result = await this._paymentMethodRpc('bind_payment_customer', {
      p_user_id: userId, p_customer_id: candidate,
    });
    if (typeof result.customer_id !== 'string' || !result.customer_id) {
      throw new Error('Could not confirm payment customer');
    }
    return result.customer_id;
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
      if (existingPaymentId) {
        const existing = await this._readPayment(existingPaymentId);
        if (existing.metadata?.acceptance_attempt_id) {
          throw conflict('Recover the existing bid authorization before changing its payment');
        }
      }
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
            currency: String(currency || 'usd').toUpperCase(),
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
  async capturePayment(paymentId, expectedTerms) {
    let payment = await this._readPayment(paymentId);
    const isGig = payment.payment_type === 'gig_payment' && Boolean(payment.gig_id);
    if (expectedTerms || isGig) assertPaymentTerms(payment, expectedTerms || {
      gigId: payment.gig_id, payerId: payment.payer_id, payeeId: payment.payee_id, amount: payment.amount_total,
    });
    if (!['authorized', 'capture_pending', 'captured_hold'].includes(payment.payment_status)) {
      throw conflict(`Cannot capture: payment is in ${payment.payment_status} state`);
    }
    // Always read the provider first, including retries after an unknown capture
    // response or failed local commit. A canceled PI can never prove capture.
    let intent = assertIntentBinding(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, { expand: ['latest_charge'] }));
    if (intent.status !== 'succeeded') {
      if (payment.payment_status === PAYMENT_STATES.CAPTURED_HOLD) throw conflict('Local capture requires provider reconciliation');
      assertAuthorizedIntent(payment, intent);
      if (isGig) {
        const { data, error } = await supabaseAdmin.rpc('prepare_paid_gig_capture', { p_payment_id: payment.id });
        if (error || !data?.payment || data.error) throw conflict('Capture could not be prepared. Please retry.');
        payment = data.payment;
      } else {
        if ((payment.capture_attempts || 0) >= MAX_CAPTURE_ATTEMPTS) {
          throw Object.assign(new Error('Capture attempt limit reached'), { code: 'capture_attempts_exhausted' });
        }
        const { error } = await supabaseAdmin.from('Payment').update({ capture_attempts: (payment.capture_attempts || 0) + 1 })
          .eq('id', payment.id);
        if (error) throw new Error('Could not prepare capture');
      }
      try {
        intent = await stripe.paymentIntents.capture(payment.stripe_payment_intent_id, {}, {
          idempotencyKey: `gig-capture:${payment.id}:${payment.stripe_payment_intent_id}`,
        });
      } catch (error) {
        // Even a network error can follow a successful provider capture. Only
        // exact retrieved success proves it; all other states remain retryable.
        const recovered = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, { expand: ['latest_charge'] });
        if (recovered?.status !== 'succeeded') throw error;
        intent = recovered;
      }
    }
    assertCapturedIntent(payment, intent);
    const chargeId = providerId(intent.latest_charge);
    if (isGig) {
      const { data, error } = await supabaseAdmin.rpc('record_paid_gig_capture', {
        p_payment_id: payment.id, p_intent_id: intent.id, p_charge_id: chargeId,
        p_amount: intent.amount_received, p_customer_id: providerId(intent.customer), p_currency: intent.currency,
      });
      if (error || data?.error || !data?.payment?.captured_at || data.payment.payment_status !== PAYMENT_STATES.CAPTURED_HOLD) {
        throw Object.assign(new Error('Capture is awaiting local confirmation. Please retry.'), { statusCode: 503 });
      }
      return { success: true, alreadyCaptured: Boolean(data.reused), chargeId };
    }
    if (payment.payment_status !== PAYMENT_STATES.CAPTURED_HOLD) {
      const now = new Date();
      await transitionPaymentStatus(payment.id, PAYMENT_STATES.CAPTURED_HOLD, {
        captured_at: now.toISOString(), cooling_off_ends_at: new Date(now.getTime() + COOLING_OFF_MS).toISOString(),
        stripe_charge_id: chargeId, payment_succeeded_at: now.toISOString(),
      });
    }
    return { success: true, chargeId };
  }

  /**
   * Create an explicit transfer to the provider's Connect account.
   * Currently disabled; active settlement credits the Pantopus wallet.
   */
  async createTransfer(_paymentId) {
    // Active gig settlement uses the fenced wallet transaction. The historical
    // unused Connect helper issued an external transfer before reserving local
    // state, which could race a refund. Keep it closed until it has its own
    // durable transfer operation and exact unknown-response reconciliation.
    throw conflict('Direct Connect transfers require a durable settlement workflow.');
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

      if (payment.payment_status === PAYMENT_STATES.CANCELED) return { success: true, reused: true };
      if (!cancellableStates.includes(payment.payment_status)) {
        throw new Error(`Cannot cancel authorization: payment is in ${payment.payment_status} state`);
      }

      // Unknown cancellation outcomes retain the durable pending operation.
      // Never label a captured or still-authorized provider intent canceled.
      if (payment.stripe_payment_intent_id) {
        let intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
        assertIntentBinding(payment, intent);
        if (intent.status !== 'canceled') {
          try {
            intent = await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `gig-cancel:${payment.id}:${intent.id}` });
          } catch (error) {
            intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
            if (intent.status !== 'canceled') throw error;
          }
        }
        assertIntentBinding(payment, intent);
        if (intent.status !== 'canceled') throw conflict('Provider cancellation has not been confirmed');
      } else if (payment.stripe_setup_intent_id) {
        let intent = await stripe.setupIntents.retrieve(payment.stripe_setup_intent_id);
        if (providerId(intent.customer) !== payment.stripe_customer_id) throw conflict();
        if (intent.status !== 'canceled') intent = await stripe.setupIntents.cancel(intent.id);
        if (intent.status !== 'canceled') throw conflict('Provider cancellation has not been confirmed');
      } else {
        throw conflict('Payment has no provider cancellation proof');
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
  async createSmartRefund(paymentId, amount, reason, initiatedBy, options = {}) {
    // Existing internal cancellation callers retain policy authority. HTTP
    // routes explicitly use payer/admin modes in the dedicated service.
    const normalized = ['duplicate', 'fraudulent', 'requested_by_customer', 'work_not_completed', 'other'].includes(reason) ? reason : 'other';
    return require('../services/paymentRefundService').create({
      paymentId, amount: amount ?? null, reason: normalized, actorId: initiatedBy,
      actorMode: options.actorMode || 'policy', requestId: options.requestId,
      description: options.description || (normalized !== reason ? reason : null),
    });
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
    const { data: payment, error } = await supabaseAdmin.from('Payment')
      .select('stripe_payment_intent_id, payer_id').eq('id', paymentId).single();
    if (error) throw new Error('Could not load payment');
    if (!payment?.stripe_payment_intent_id || payment.payer_id !== userId) return;
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    const methodId = this._stripeId(intent.payment_method);
    const customerId = this._stripeId(intent.customer);
    if (!methodId || !customerId) return;
    // Current provider state and the shared transaction fence delayed checkout
    // reconciliation after a removal; an expanded historical PI is not proof.
    const method = await stripe.paymentMethods.retrieve(methodId);
    return this._savePaymentMethod(userId, customerId, methodId, async () => method);
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(userId, paymentMethodId) {
    const customerId = await this.getOrCreateCustomer(userId);
    // A DB failure after attachment is retried without another attachment. A
    // method attached to a different customer can never be claimed by this API.
    const current = await stripe.paymentMethods.retrieve(paymentMethodId);
    const attachedCustomer = this._stripeId(current?.customer);
    if (attachedCustomer && attachedCustomer !== customerId) {
      throw this._addCardError(404, 'Payment method not found');
    }
    return this._savePaymentMethod(userId, customerId, paymentMethodId, () =>
      attachedCustomer ? current : stripe.paymentMethods.attach(paymentMethodId, { customer: customerId }));
  }

  // Shared durable save. PostgreSQL owns default selection and removal fences;
  // retries never write a stale snapshot into Stripe's invoice preferences.
  async _savePaymentMethod(userId, customerId, paymentMethodId, loadAttachedMethod) {
    const paymentMethod = await loadAttachedMethod();
    if (!paymentMethod || paymentMethod.id !== paymentMethodId ||
        this._stripeId(paymentMethod.customer) !== customerId ||
        !['card', 'us_bank_account'].includes(paymentMethod.type) ||
        !paymentMethod[paymentMethod.type]) {
      throw this._addCardError(404, 'Payment method not found');
    }
    const details = { payment_method_type: paymentMethod.type };
    if (paymentMethod.type === 'card') {
      details.card_brand = paymentMethod.card.brand;
      details.card_last4 = paymentMethod.card.last4;
      details.card_exp_month = paymentMethod.card.exp_month;
      details.card_exp_year = paymentMethod.card.exp_year;
      details.card_funding = paymentMethod.card.funding;
    } else {
      details.bank_name = paymentMethod.us_bank_account.bank_name;
      details.bank_last4 = paymentMethod.us_bank_account.last4;
      details.bank_account_type = paymentMethod.us_bank_account.account_type;
    }
    const result = await this._paymentMethodRpc('save_payment_method', {
      p_user_id: userId, p_customer_id: customerId, p_method_id: paymentMethodId, p_details: details,
    });
    const saved = result.payment_method;
    if (!saved?.id || saved.user_id !== userId || saved.stripe_customer_id !== customerId ||
        saved.stripe_payment_method_id !== paymentMethodId) {
      throw new Error('Could not confirm saved payment method');
    }
    return { success: true, paymentMethod: saved };
  }

  async _paymentMethodRpc(name, args) {
    const { data, error } = await supabaseAdmin.rpc(name, args);
    if (error || !data) throw new Error('Could not save payment method changes. Please retry.');
    if (data.error === 'NOT_FOUND' || data.error === 'REMOVED') {
      throw this._addCardError(404, 'Payment method not found');
    }
    if (data.error) throw new Error('Could not save payment method changes. Please retry.');
    return data;
  }

  _stripeId(value) {
    return typeof value === 'string' ? value : value?.id;
  }

  _addCardError(statusCode, message) {
    return Object.assign(new Error(message), { statusCode, isAddCardError: true });
  }

  // Preparation resume and post-sheet confirmation must share proof ownership.
  // A missing saved identifier never falls back to making a new setup/customer.
  async _getOwnedMobileCardSetup(userId, setupIntentId) {
    if (!/^seti_[A-Za-z0-9]+$/.test(setupIntentId || '')) {
      throw this._addCardError(404, 'Card setup not found');
    }
    const { data: user, error } = await supabaseAdmin.from('User')
      .select('id, stripe_customer_id').eq('id', userId).maybeSingle();
    if (error) throw new Error('Could not load card setup owner');
    if (!user?.stripe_customer_id) throw this._addCardError(404, 'Card setup not found');

    let setup;
    try {
      setup = await stripe.setupIntents.retrieve(setupIntentId);
    } catch (err) {
      if (err.code === 'resource_missing') throw this._addCardError(404, 'Card setup not found');
      throw err;
    }
    if (setup?.id !== setupIntentId || this._stripeId(setup.customer) !== user.stripe_customer_id ||
        setup.metadata?.source !== 'mobile_add_card' || setup.metadata?.user_id !== userId) {
      throw this._addCardError(404, 'Card setup not found');
    }
    if (setup.status === 'canceled') throw this._addCardError(404, 'Card setup is no longer available');
    return { setup, customerId: user.stripe_customer_id };
  }

  /** Verify the provider's owned completed setup before saving its attached card.
   * This path never creates a customer, confirms a setup, charges, or reattaches.
   */
  async confirmAddCardSetup(userId, setupIntentId) {
    const { setup, customerId } = await this._getOwnedMobileCardSetup(userId, setupIntentId);
    if (setup.status !== 'succeeded') {
      throw this._addCardError(409, 'Card setup has not completed. Please try again.');
    }
    const methodId = this._stripeId(setup.payment_method);
    if (!methodId) throw this._addCardError(409, 'Card setup has not completed. Please try again.');
    let method;
    try {
      method = await stripe.paymentMethods.retrieve(methodId);
    } catch (err) {
      if (err.code === 'resource_missing') throw this._addCardError(404, 'Saved card is no longer available');
      throw err;
    }
    // A stale setup must not re-add a card the user has since removed.
    if (method?.id !== methodId || this._stripeId(method.customer) !== customerId ||
        method.type !== 'card' || !method.card) {
      throw this._addCardError(404, 'Saved card is no longer available');
    }
    return this._savePaymentMethod(userId, customerId, methodId, async () => method);
  }

  /** Attachment events may race the post-sheet request or arrive after removal.
   * Read current provider ownership and share the same retryable durable save.
   */
  async reconcileAttachedPaymentMethod(eventMethod) {
    const customerId = this._stripeId(eventMethod.customer);
    if (!customerId) return;
    const { data: user, error } = await supabaseAdmin.from('User')
      .select('id').eq('stripe_customer_id', customerId).maybeSingle();
    if (error) throw new Error('Could not load payment method owner');
    if (!user) return; // This Stripe customer does not belong to the application.
    let method;
    try {
      method = await stripe.paymentMethods.retrieve(eventMethod.id);
    } catch (err) {
      if (err.code === 'resource_missing') return;
      throw err;
    }
    if (method?.id !== eventMethod.id || this._stripeId(method.customer) !== customerId) return;
    try {
      return await this._savePaymentMethod(user.id, customerId, method.id, async () => method);
    } catch (err) {
      if (err.isAddCardError && err.statusCode === 404) return;
      throw err;
    }
  }

  /** Select the app's preferred saved card. Explicit checkout choices and
   * already-authorized payment methods remain authoritative. */
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    const result = await this._paymentMethodRpc('set_default_payment_method', {
      p_user_id: userId, p_method_id: paymentMethodId,
    });
    if (result.payment_method?.id !== paymentMethodId || result.payment_method.user_id !== userId) {
      throw new Error('Could not confirm default payment method');
    }
    return { success: true };
  }

  async _currentPaymentMethod(paymentMethodId) {
    try {
      return await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (err) {
      if (err.code === 'resource_missing') return null;
      throw err;
    }
  }

  async _completePaymentMethodRemoval(paymentMethodId) {
    const result = await this._paymentMethodRpc('complete_payment_method_removal', { p_method_id: paymentMethodId });
    if (result.completed !== true) throw new Error('Could not confirm payment method removal');
    return { success: true };
  }

  /** Admit a permanent removal fence before the external detach. Unknown
   * provider responses and DB failures can retry the original owned method ID. */
  async deletePaymentMethod(userId, paymentMethodId) {
    const result = await this._paymentMethodRpc('begin_payment_method_removal', {
      p_user_id: userId, p_method_id: paymentMethodId,
    });
    const removal = result.removal;
    if (removal?.user_id !== userId || removal.method_id !== paymentMethodId || !removal.stripe_payment_method_id) {
      throw new Error('Could not confirm payment method removal');
    }
    if (removal.completed_at) return { success: true };
    const methodId = removal.stripe_payment_method_id;
    const current = await this._currentPaymentMethod(methodId);
    if (current && current.id !== methodId) throw new Error('Could not confirm payment method removal');
    const customer = this._stripeId(current?.customer);
    if (customer && customer !== removal.stripe_customer_id) {
      throw this._addCardError(404, 'Payment method not found');
    }
    if (customer) {
      try {
        const detached = await stripe.paymentMethods.detach(methodId);
        if (detached?.id !== methodId || this._stripeId(detached.customer)) {
          throw new Error('Could not confirm payment method removal');
        }
      } catch (err) {
        // A concurrent request or a lost success response may already have
        // detached it. Otherwise preserve the tombstone and return failure.
        const after = await this._currentPaymentMethod(methodId);
        if (after && (after.id !== methodId || this._stripeId(after.customer))) throw err;
      }
    }
    return this._completePaymentMethodRemoval(methodId);
  }

  async reconcileDetachedPaymentMethod(eventMethod) {
    const current = await this._currentPaymentMethod(eventMethod.id);
    if (current && (current.id !== eventMethod.id || this._stripeId(current.customer))) return;
    return this._completePaymentMethodRemoval(eventMethod.id);
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
  async getAddCardSheetParams(userId, setupIntentId = null) {
    let customerId;
    let setupIntent;
    let ephemeralKey;
    if (setupIntentId != null) {
      const owned = await this._getOwnedMobileCardSetup(userId, setupIntentId);
      customerId = owned.customerId;
      setupIntent = owned.setup;
    } else {
      customerId = await this.getOrCreateCustomer(userId);
      // Mint the key before creating the first setup, so a key outage cannot
      // leave an unreturned new setup behind. Resumes mint only when needed.
      ephemeralKey = await this.createEphemeralKey(customerId);
      setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: { source: 'mobile_add_card', user_id: userId },
      });
    }
    const resumable = ['requires_payment_method', 'requires_confirmation', 'requires_action'];
    if (!setupIntent?.id || ![...resumable, 'processing', 'succeeded'].includes(setupIntent.status)) {
      throw new Error('Could not prepare card setup');
    }
    if (resumable.includes(setupIntent.status)) {
      if (!setupIntent.client_secret) throw new Error('Could not resume card setup');
      ephemeralKey ||= await this.createEphemeralKey(customerId);
      if (!ephemeralKey?.secret) throw new Error('Could not prepare card setup');
    }
    // A succeeded setup needs durable reconciliation, not another PaymentSheet.
    // Processing must be rechecked later. Neither needs a new ephemeral key.
    return {
      setupIntent: setupIntent.client_secret || '',
      setupIntentId: setupIntent.id,
      setupStatus: setupIntent.status,
      ephemeralKey: resumable.includes(setupIntent.status) ? ephemeralKey.secret : '',
      customer: customerId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    };
  }
}

module.exports = new StripeService();
