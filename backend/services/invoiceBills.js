/**
 * Bills from business invoices (Mail tab, SRV-7). When a business invoices someone through Pantopus (or sends the
 * invoice again), a bill, drawn as a window envelope, goes to the payer's Me drawer. It follows the delivery rule (due
 * today or earlier: at once, a special delivery), carries the due date and the key facts (amount, due date, business)
 * with a note the business's invoice wrote, and is linked to its invoice (Mail.invoice_id): its `invoice` field reads
 * the status live, and Pay opens the invoice's existing payment. Once paid, the bill is filed in the payer's Receipts;
 * a void one leaves the Counter and stays readable. One bill per invoice: its id comes from the invoice's, so a retry or
 * a re-send never delivers twice. invoice_received stays as it is (no second notice for the bill).
 */
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { isLaunchFeatureEnabled } = require('../utils/featureFlags');
const mailDelivery = require('./mailDelivery');

function billId(invoiceId) {
  const hex = crypto.createHash('sha256').update(`pantopus:invoice-bill:v1:${String(invoiceId).toLowerCase()}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function money(cents, currency = 'usd') {
  const amount = (Number(cents || 0) / 100).toFixed(2);
  return String(currency || 'usd').toLowerCase() === 'usd' ? `$${amount}` : `${amount} ${String(currency).toUpperCase()}`;
}

function dayLabel(isoDate) {
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// The business as the payer sees it, and whether Pantopus verified it (its official mark).
async function businessSender(businessId) {
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('User').select('name, username').eq('id', businessId).maybeSingle(),
    supabaseAdmin.from('BusinessProfile').select('verification_status').eq('business_user_id', businessId).maybeSingle(),
  ]);
  const name = (user?.name || user?.username || 'A business').trim().slice(0, 120);
  const verified = ['document_verified', 'government_verified'].includes(profile?.verification_status);
  return { name, trust: verified ? 'verified_business' : 'pantopus_user' };
}

/**
 * Deliver the bill for an invoice unless it is already there. Answers { id, created }, or null (no payer, or the
 * mailbox is off: invoices sent then get their bill when they are sent again).
 */
async function deliverBill(invoice) {
  if (!invoice?.id || !invoice.recipient_user_id || !isLaunchFeatureEnabled('mailbox')) return null;
  const id = billId(invoice.id);
  const { data: existing, error: readError } = await supabaseAdmin.from('Mail').select('id').eq('id', id).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) return { id, created: false };
  const sender = await businessSender(invoice.business_user_id);
  const total = money(invoice.total_cents, invoice.currency);
  const due = invoice.due_date ? String(invoice.due_date).slice(0, 10) : null;
  const lines = (Array.isArray(invoice.line_items) ? invoice.line_items : []).slice(0, 30).map((item) => {
    const qty = Number(item?.quantity || 1);
    const label = String(item?.description || 'Item').slice(0, 200);
    return `${label}${qty > 1 ? ` × ${qty}` : ''}: ${money(Number(item?.amount_cents || 0) * qty, invoice.currency)}`;
  });
  const content = [
    `Invoice from ${sender.name}`, '',
    ...lines, '',
    `Total due: ${total}`,
    due ? `Due ${dayLabel(due)}` : 'No due date',
    ...(invoice.memo ? ['', String(invoice.memo).slice(0, 1000)] : []),
    '', 'Pay it from this bill in your Mail, or from the invoice.',
  ].join('\n');
  const now = new Date();
  const soon = due && (Date.parse(`${due}T00:00:00Z`) - now.getTime()) <= 3 * 86400000;
  const row = {
    id,
    recipient_user_id: invoice.recipient_user_id,
    drawer: 'personal',
    privacy: 'private_to_person',
    type: 'bill',
    mail_type: 'bill',
    mail_object_type: 'envelope',
    subject: `Invoice from ${sender.name}`,
    display_title: `Invoice from ${sender.name}`,
    content,
    preview_text: `${total}${due ? `, due ${dayLabel(due)}` : ''}`,
    sender_display: sender.name,
    sender_business_name: sender.name,
    sender_entity_id: invoice.business_user_id,
    sender_trust: sender.trust,
    due_date: due,
    urgency: soon ? 'due_soon' : 'none',
    primary_action: 'view_bill',
    key_facts: [
      { label: 'Amount due', value: total },
      ...(due ? [{ label: 'Due', value: dayLabel(due) }] : []),
      { label: 'From', value: sender.name },
    ],
    invoice_id: invoice.id,
    lifecycle: 'delivered',
    mail_extracted: {
      invoice_bill: true,
      summary: `${sender.name} sent you a bill for ${total}${due ? `, due ${dayLabel(due)}` : ''}.`,
      summary_source: 'sender',
      summary_at: now.toISOString(),
    },
  };
  const stored = { ...row, ...(await mailDelivery.deliveryFor(row, { now })) };
  const { error } = await supabaseAdmin.from('Mail').insert(stored);
  if (error) {
    if (error.code === '23505') return { id, created: false };
    throw new Error(error.message);
  }
  await mailDelivery.afterStored([stored]);
  return { id, created: true };
}

/** Never throws: an invoice is sent whether or not its bill could be written (the next re-send tries again). */
async function deliverBillSafe(invoice) {
  try {
    return await deliverBill(invoice);
  } catch (error) {
    logger.warn('Invoice bill not delivered', { invoiceId: invoice?.id, error: error.message });
    return null;
  }
}

/** The invoice was paid: its bill shows Paid (read live) and is filed in the payer's Receipts. Never throws. */
async function onInvoicePaid(invoiceId) {
  try {
    const { data: bill } = await supabaseAdmin.from('Mail').select('id, recipient_user_id, lifecycle')
      .eq('invoice_id', invoiceId).is('deleted_at', null).maybeSingle();
    if (!bill?.recipient_user_id) return null;
    // eslint-disable-next-line global-require
    const { ensureSystemFolders } = require('./mailVault');
    // eslint-disable-next-line global-require
    const { getAccessibleHomeIds } = require('../utils/homeMailAccess');
    await ensureSystemFolders(bill.recipient_user_id, await getAccessibleHomeIds(bill.recipient_user_id));
    const { data: receipts } = await supabaseAdmin.from('VaultFolder').select('id').eq('user_id', bill.recipient_user_id)
      .eq('drawer', 'personal').eq('label', 'Receipts').eq('system', true).order('created_at').limit(1);
    const { error } = await supabaseAdmin.from('Mail').update({
      lifecycle: 'filed', vault_folder_id: receipts?.[0]?.id || null, action_required: false,
    }).eq('id', bill.id);
    if (error) throw new Error(error.message);
    return bill.id;
  } catch (error) {
    logger.warn('Paid invoice bill not filed', { invoiceId, error: error.message });
    return null;
  }
}

/** The invoice was voided: its bill shows Void (read live), leaves the Counter and stays readable. Never throws. */
async function onInvoiceVoid(invoiceId) {
  try {
    const { error } = await supabaseAdmin.from('Mail').update({ due_date: null, urgency: 'none', action_required: false })
      .eq('invoice_id', invoiceId).is('deleted_at', null);
    if (error) throw new Error(error.message);
  } catch (error) {
    logger.warn('Void invoice bill not updated', { invoiceId, error: error.message });
  }
}

/**
 * The pieces with their `invoice` field: { id, status, total_cents, currency, due_date, business_name } read live
 * from the invoice (status overdue once a sent invoice's due day has passed where the bill's mailbox is), or null. A
 * paid or void bill is not on the Counter. Answers new objects; never throws (a failed read leaves invoice null).
 */
async function attachInvoices(pieces) {
  const list = Array.isArray(pieces) ? pieces : [pieces];
  const ids = [...new Set(list.map((p) => p?.invoice_id).filter(Boolean))];
  let byId = new Map();
  if (ids.length) {
    try {
      const { data, error } = await supabaseAdmin.from('BusinessInvoice')
        .select('id, status, total_cents, currency, due_date, business_user_id').in('id', ids);
      if (error) throw new Error(error.message);
      const businesses = [...new Set((data || []).map((i) => i.business_user_id))];
      const { data: users } = businesses.length
        ? await supabaseAdmin.from('User').select('id, name, username').in('id', businesses) : { data: [] };
      const names = new Map((users || []).map((u) => [u.id, (u.name || u.username || 'A business').trim()]));
      byId = new Map((data || []).map((i) => [i.id, i]));
      for (const invoice of byId.values()) invoice.business_name = names.get(invoice.business_user_id) || 'A business';
    } catch (error) {
      logger.warn('Bill invoices not read', { error: error.message });
    }
  }
  const now = new Date();
  const out = await Promise.all(list.map(async (piece) => {
    if (!piece) return piece;
    const invoice = piece.invoice_id ? byId.get(piece.invoice_id) : null;
    if (!invoice) return { ...piece, invoice: null };
    const due = invoice.due_date ? String(invoice.due_date).slice(0, 10) : null;
    let status = invoice.status;
    if (['sent', 'viewed'].includes(status) && due) {
      const today = mailDelivery.localDate(now, await mailDelivery.mailboxTimeZone(piece).catch(() => mailDelivery.FALLBACK_TIME_ZONE));
      if (due < today) status = 'overdue';
    }
    return {
      ...piece,
      invoice: { id: invoice.id, status, total_cents: invoice.total_cents, currency: invoice.currency, due_date: due,
        business_name: invoice.business_name },
      on_counter: ['paid', 'void'].includes(status) ? false : piece.on_counter,
    };
  }));
  return Array.isArray(pieces) ? out : out[0];
}

module.exports = { billId, deliverBill, deliverBillSafe, onInvoicePaid, onInvoiceVoid, attachInvoices };
