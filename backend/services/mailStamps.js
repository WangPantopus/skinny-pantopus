// Digital sending credits are not the withdrawable money wallet or collectible stamps.
const db = require("../config/supabaseAdmin");
const crypto = require("node:crypto");
const { SignJWT, importPKCS8, decodeJwt } = require("jose");
const { DateTime } = require("luxon");
const { areLaunchFeaturesEnabled } = require("../utils/featureFlags");
const holidayCards = require("./holidayCards");
const mailDelivery = require("./mailDelivery");
const BOOKS = [
  [5, 299],
  [20, 799],
  [50, 1499],
].map(([credits, price_cents]) => ({
  id: `com.pantopus.stamps.${credits}`,
  credits,
  price_cents,
  currency: "usd",
}));
const listed = (name, user) =>
  !!user &&
  (process.env[name] || "")
    .split(",")
    .some((id) => id.trim().toLowerCase() === user.toLowerCase());
const enabled = (user) =>
  (process.env.MAIL_STAMPS_ENABLED === "true" ||
    listed("MAIL_STAMPS_PREVIEW_USERS", user)) &&
  areLaunchFeaturesEnabled(["mailbox", "holiday_cards"]);
const book = (id) => BOOKS.find((b) => b.id === id);
// Stamps only send Christmas cards, which close when December 31 ends, so books stop selling when the last sales day
// ends where the person lives. Receipts, balances and sending keep working after that.
async function salesOpen(user, now = new Date()) {
  const zone =
    (await mailDelivery.personTimeZone(user)) ||
    mailDelivery.FALLBACK_TIME_ZONE;
  const lastDay = process.env.MAIL_STAMPS_SALES_LAST_DAY || "2026-12-26";
  const end = DateTime.fromISO(lastDay, { zone }).plus({ days: 1 }).startOf("day");
  return holidayCards.seasonOpen(zone, now) && end.isValid && now < end.toJSDate();
}
const failure = (
  message = "Could not verify this purchase. Please try again.",
  status = 503,
) => Object.assign(new Error(message), { status });
async function rpc(name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw failure();
  return data;
}
async function balance(user) {
  return rpc("mail_stamp_balance", { p_user: user });
}
// The latest stamp moves for the Stamps wallet, newest first: the free three, books, cards sent, stamps returned and
// refunded books. Only kinds and counts; who a card went to stays in Sent.
async function history(user, limit = 30) {
  const { data, error } = await db
    .from("MailStampLedger")
    .select("event_key,bucket,delta,created_at")
    .eq("user_id", user)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw failure();
  return (data || []).map((row) => ({
    kind: row.event_key.split(":")[0],
    bucket: row.bucket,
    delta: row.delta,
    at: new Date(row.created_at).toISOString(),
  }));
}
// Stamps used on cards that went (sent minus taken back or expired), for the wallet's "N used".
async function usedTotal(user) {
  const count = async (prefix) => {
    const { count: n, error } = await db
      .from("MailStampLedger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user)
      .like("event_key", `${prefix}:%`);
    if (error) throw failure();
    return n || 0;
  };
  const [sent, returned] = await Promise.all([count("send"), count("return")]);
  return Math.max(0, sent - returned);
}
async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw failure();
  return response.json();
}
const stripe = () => require("../stripe/getStripeClient").getStripeClient();
const sandbox = () => process.env.MAIL_STAMPS_SANDBOX === "true";
const googleAccount = (user) =>
  crypto.createHash("sha256").update(`pantopus-stamps:${user}`).digest("hex");
async function appleToken() {
  const key = await importPKCS8(
    (process.env.MAIL_STAMPS_APPLE_KEY || "").replace(/\\n/g, "\n"),
    "ES256",
  );
  return new SignJWT({ bid: "com.pantopus.app" })
    .setProtectedHeader({
      alg: "ES256",
      kid: process.env.MAIL_STAMPS_APPLE_KEY_ID,
      typ: "JWT",
    })
    .setIssuer(process.env.MAIL_STAMPS_APPLE_ISSUER)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
async function googleToken() {
  const credentials = JSON.parse(
    process.env.MAIL_STAMPS_GOOGLE_SERVICE_ACCOUNT || "{}",
  );
  const key = await importPKCS8(credentials.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(credentials.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
  return (
    await json("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    })
  ).access_token;
}
async function proof(provider, reference, user, productId) {
  if (provider === "stripe") {
    const session = await stripe().checkout.sessions.retrieve(reference, {
      expand: ["payment_intent.latest_charge"],
    });
    const b = book(session.metadata?.stamp_product);
    if (
      !b ||
      session.metadata?.stamp_user !== user ||
      session.mode !== "payment" ||
      session.currency !== "usd" ||
      session.amount_total !== b.price_cents ||
      session.livemode === sandbox()
    )
      throw failure("This purchase does not belong to this account.", 403);
    if (session.payment_status !== "paid")
      throw failure("Payment is still pending.", 409);
    const charge = session.payment_intent?.latest_charge;
    if (!charge || typeof charge === "string") throw failure();
    return { b, revoked: !!charge.disputed || charge.amount_refunded > 0 };
  }
  if (provider === "apple") {
    if (!/^\d{1,40}$/.test(reference))
      throw failure("Invalid transaction.", 400);
    // Only decode data retrieved directly from Apple's authenticated HTTPS API, never client-supplied JWS.
    // App Review uses Sandbox even for a production binary. Only founder-designated
    // review accounts may use that environment on a live backend; never auto-fallback.
    const appleSandbox = sandbox() || listed("MAIL_STAMPS_APPLE_SANDBOX_USERS", user);
    const host = appleSandbox
      ? "api.storekit-sandbox.apple.com"
      : "api.storekit.apple.com";
    const reply = await json(
      `https://${host}/inApps/v1/transactions/${reference}`,
      { headers: { Authorization: `Bearer ${await appleToken()}` } },
    );
    const t = decodeJwt(reply.signedTransactionInfo),
      b = book(t.productId);
    if (
      !b ||
      t.transactionId !== reference ||
      t.bundleId !== "com.pantopus.app" ||
      t.appAccountToken?.toLowerCase() !== user.toLowerCase() ||
      t.type !== "Consumable" ||
      t.quantity !== 1 ||
      t.environment !== (appleSandbox ? "Sandbox" : "Production")
    )
      throw failure("This purchase does not belong to this account.", 403);
    return { b, revoked: !!t.revocationDate };
  }
  if (provider === "google") {
    const b = book(productId);
    if (!b) throw failure("Unknown stamp book.", 400);
    const token = await googleToken();
    const packageName =
      process.env.MAIL_STAMPS_GOOGLE_PACKAGE || "com.pantopus.app";
    const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases`;
    const t = await json(
      `${root}/products/${encodeURIComponent(b.id)}/tokens/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (
      t.obfuscatedExternalAccountId !== googleAccount(user) ||
      (t.quantity || 1) !== 1 ||
      (t.purchaseType === 0) !== sandbox()
    )
      throw failure("This purchase does not belong to this account.", 403);
    if (t.purchaseState === 2) throw failure("Payment is still pending.", 409);
    return {
      b,
      revoked: t.purchaseState !== 0,
      consume:
        t.purchaseState === 0 && t.consumptionState === 0
          ? async () => {
              const response = await fetch(
                `${root}/products/${encodeURIComponent(b.id)}/tokens/${encodeURIComponent(reference)}:consume`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                  signal: AbortSignal.timeout(15000),
                },
              );
              if (!response.ok) throw failure();
            }
          : null,
    };
  }
  throw failure("Unknown payment provider.", 400);
}
async function confirm(provider, reference, user, productId) {
  const { b, revoked, consume } = await proof(
    provider,
    reference,
    user,
    productId,
  );
  const result = await rpc("mail_stamp_purchase", {
    p_user: user,
    p_provider: provider,
    p_reference: reference,
    p_product: b.id,
    p_credits: b.credits,
    p_revoked: revoked,
  });
  // Consume only after the ledger commits. A crash/retry cannot grant twice. The sweep retries failed consumption.
  if (consume) {
    try {
      await consume();
    } catch {
      /* Durable credit exists; reconciliation will retry. */
    }
  }
  return result;
}
async function checkout(user, productId, requestId) {
  const b = book(productId);
  if (!b) throw failure("Unknown stamp book.", 400);
  if (!(await salesOpen(user)))
    throw failure("Stamp books aren’t on sale any more this year.", 410);
  if (
    !new RegExp(sandbox() ? "^(sk|rk)_test_" : "^(sk|rk)_live_").test(
      process.env.STRIPE_SECRET_KEY || "",
    )
  )
    throw failure("Stamp purchases are not configured.", 503);
  const origin = process.env.FRONTEND_URL || "https://pantopus.com";
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: user,
      metadata: { stamp_user: user, stamp_product: b.id },
      payment_intent_data: {
        metadata: { stamp_user: user, stamp_product: b.id },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: b.price_cents,
            product_data: {
              name: `${b.credits} Pantopus digital stamps`,
              description:
                "One stamp sends one Christmas card to one recipient. Digital delivery only. Christmas cards can be sent until December 31, 2026; unused stamps stay in your account.",
            },
          },
        },
      ],
      success_url: `${origin}/app/mailbox/cards?stamp_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/mailbox/cards?stamp_cancelled=1`,
    },
    { idempotencyKey: `stamp:${user}:${requestId}` },
  );
  if (session.livemode === sandbox())
    throw failure("Stamp purchases are not configured.", 503);
  return { url: session.url };
}
async function reconcile() {
  // Settlements/refunds outlive a seasonal sales switch.
  const { data, error } = await db
    .from("MailStampPurchase")
    .select("user_id,provider,reference,product_id")
    .eq("revoked", false)
    .not("user_id", "is", null) // A deleted account's receipts are only marked by late refund events.
    .lt("checked_at", new Date(Date.now() - 3600000).toISOString())
    .order("checked_at")
    .limit(100);
  if (error) {
    if (!enabled() && ["42P01", "PGRST205"].includes(error.code)) return;
    throw failure();
  }
  let failures = 0;
  for (const p of data || []) {
    try {
      await confirm(p.provider, p.reference, p.user_id, p.product_id);
    } catch {
      failures += 1;
      // Move a failed provider check to the back of the queue so one bad receipt cannot starve others.
      await db
        .from("MailStampPurchase")
        .update({ checked_at: new Date().toISOString() })
        .eq("provider", p.provider)
        .eq("reference", p.reference);
    }
  }
  if (failures)
    require("../utils/logger").warn(
      "Stamp purchase reconciliation needs retry",
      { checked: data.length, failures },
    );
}
// Signed Stripe webhook handlers call this before unrelated wallet/gig refund handlers.
async function stripeChargeChanged(object, connectedAccount) {
  if (connectedAccount) return false; // Stamp books are platform charges, never Connect charges.
  let paymentIntent = object.payment_intent;
  if (!paymentIntent && object.charge) {
    const charge = await stripe().charges.retrieve(
      typeof object.charge === "string" ? object.charge : object.charge.id,
    );
    paymentIntent = charge.payment_intent;
  }
  if (!paymentIntent) return false;
  const pi = await stripe().paymentIntents.retrieve(
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id,
  );
  if (!book(pi.metadata?.stamp_product)) return false;
  const sessions = await stripe().checkout.sessions.list({
    payment_intent: pi.id,
    limit: 1,
  });
  if (!sessions.data[0]) throw failure();
  await confirm("stripe", sessions.data[0].id, pi.metadata.stamp_user);
  return true;
}
module.exports = {
  BOOKS,
  enabled,
  salesOpen,
  balance,
  history,
  usedTotal,
  confirm,
  checkout,
  reconcile,
  googleAccount,
  stripeChargeChanged,
};
