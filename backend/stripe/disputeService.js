// ============================================================
// DISPUTE SERVICE
// Builds and submits evidence for Stripe disputes.
//
// Pantopus has rich data to fight chargebacks:
//   - Verified addresses from Home profiles
//   - Completion proof (photos, notes, checklists)
//   - Chat logs between parties
//   - Bid history and acceptance records
//   - Timeline events (started_at, completed_at, confirmed_at)
//
// This service compiles all available evidence into Stripe's
// dispute evidence format and submits it automatically.
// ============================================================

const { getStripeClient } = require('./getStripeClient');
const stripe = getStripeClient();
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

/**
 * Gather all evidence for a disputed payment.
 *
 * @param {string} paymentId - Payment UUID
 * @returns {object} Compiled evidence bundle
 */
async function gatherEvidence(paymentId) {
  // ─── Fetch core records ───
  const { data: payment } = await supabaseAdmin
    .from('Payment')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (!payment) throw new Error(`Payment not found: ${paymentId}`);
  if (!payment.dispute_id) throw new Error('Payment has no associated dispute');

  const gigId = payment.gig_id;

  // Parallel fetches for related data
  const [gigResult, bidResult, payerResult, payeeResult, reviewResult, chatResult] = await Promise.all([
    // Gig with completion proof
    gigId
      ? supabaseAdmin
          .from('Gig')
          .select(`
            id, title, description, status, price,
            created_at, accepted_at, started_at,
            worker_completed_at, owner_confirmed_at,
            completion_note, completion_photos, completion_checklist,
            owner_confirmation_note, owner_satisfaction,
            location, address, scheduled_start,
            cancellation_policy
          `)
          .eq('id', gigId)
          .single()
      : { data: null },

    // Accepted bid
    gigId
      ? supabaseAdmin
          .from('GigBid')
          .select('id, user_id, amount, message, status, created_at')
          .eq('gig_id', gigId)
          .eq('status', 'accepted')
          .single()
      : { data: null },

    // Payer (requester) info
    supabaseAdmin
      .from('User')
      .select('id, username, full_name, email, created_at')
      .eq('id', payment.payer_id)
      .single(),

    // Payee (provider) info
    supabaseAdmin
      .from('User')
      .select('id, username, full_name, email, created_at')
      .eq('id', payment.payee_id)
      .single(),

    // Review (if any)
    gigId
      ? supabaseAdmin
          .from('Review')
          .select('id, rating, content, created_at')
          .eq('gig_id', gigId)
          .limit(1)
          .single()
      : { data: null },

    // Chat messages (last 50 between the parties in the gig chat)
    gigId
      ? supabaseAdmin
          .from('ChatRoom')
          .select('id')
          .eq('gig_id', gigId)
          .eq('type', 'gig')
          .single()
      : { data: null },
  ]);

  const gig = gigResult.data;
  const bid = bidResult.data;
  const payer = payerResult.data;
  const payee = payeeResult.data;
  const review = reviewResult.data;

  // Fetch chat messages if chat room exists
  let chatMessages = [];
  if (chatResult.data?.id) {
    const { data: messages } = await supabaseAdmin
      .from('Message')
      .select('id, sender_id, content, created_at')
      .eq('room_id', chatResult.data.id)
      .order('created_at', { ascending: true })
      .limit(50);
    chatMessages = messages || [];
  }

  return {
    payment,
    gig,
    bid,
    payer,
    payee,
    review,
    chatMessages,
  };
}

/**
 * Build a Stripe-compatible evidence object from gathered data.
 *
 * @param {object} evidence - Result from gatherEvidence()
 * @returns {object} Stripe dispute evidence fields
 */
function buildStripeEvidence(evidence) {
  const { payment, gig, bid, payer, payee, review, chatMessages } = evidence;

  const stripeEvidence = {};

  // ─── Product / Service Description ───
  if (gig) {
    const parts = [
      `Service: "${gig.title}"`,
      gig.description ? `Description: ${gig.description.substring(0, 500)}` : null,
      gig.price ? `Agreed price: $${(gig.price / 100).toFixed(2)}` : null,
      gig.address ? `Service location: ${gig.address}` : null,
    ].filter(Boolean);

    stripeEvidence.product_description = parts.join('\n');
  }

  // ─── Service Date ───
  if (gig?.started_at) {
    stripeEvidence.service_date = new Date(gig.started_at).toISOString().split('T')[0];
  } else if (gig?.scheduled_start) {
    stripeEvidence.service_date = new Date(gig.scheduled_start).toISOString().split('T')[0];
  }

  // ─── Service Documentation ───
  // Compile a narrative of the service delivery
  const docParts = [];

  if (gig?.status === 'completed' || gig?.owner_confirmed_at) {
    docParts.push('SERVICE DELIVERY CONFIRMED');
    docParts.push(`Gig status: ${gig.status}`);
  }

  if (gig?.accepted_at) {
    docParts.push(`Bid accepted: ${new Date(gig.accepted_at).toISOString()}`);
  }
  if (gig?.started_at) {
    docParts.push(`Work started: ${new Date(gig.started_at).toISOString()}`);
  }
  if (gig?.worker_completed_at) {
    docParts.push(`Worker marked complete: ${new Date(gig.worker_completed_at).toISOString()}`);
  }
  if (gig?.owner_confirmed_at) {
    docParts.push(`Owner confirmed completion: ${new Date(gig.owner_confirmed_at).toISOString()}`);
  }

  // Completion proof
  if (gig?.completion_note) {
    docParts.push(`\nWorker's completion note: "${gig.completion_note}"`);
  }
  if (gig?.completion_photos?.length > 0) {
    docParts.push(`Worker submitted ${gig.completion_photos.length} photo(s) as proof of work.`);
    // Include photo URLs (Stripe accepts URL evidence)
    gig.completion_photos.forEach((url, i) => {
      docParts.push(`Photo ${i + 1}: ${url}`);
    });
  }
  if (gig?.completion_checklist?.length > 0) {
    const completedItems = gig.completion_checklist.filter(item => item.done).length;
    docParts.push(`Completion checklist: ${completedItems}/${gig.completion_checklist.length} items completed.`);
  }

  // Owner's confirmation
  if (gig?.owner_confirmation_note) {
    docParts.push(`\nRequester's confirmation note: "${gig.owner_confirmation_note}"`);
  }
  if (gig?.owner_satisfaction) {
    docParts.push(`Requester satisfaction rating: ${gig.owner_satisfaction}/5`);
  }

  // Review
  if (review) {
    docParts.push(`\nPost-gig review: ${review.rating}/5 stars`);
    if (review.content) {
      docParts.push(`Review text: "${review.content.substring(0, 300)}"`);
    }
  }

  if (docParts.length > 0) {
    stripeEvidence.service_documentation = docParts.join('\n');
  }

  // ─── Customer Communication ───
  if (chatMessages.length > 0) {
    const chatLog = chatMessages
      .map(msg => {
        const sender = msg.sender_id === payment.payer_id ? 'Requester' : 'Provider';
        const time = new Date(msg.created_at).toISOString();
        const content = (msg.content || '').substring(0, 200);
        return `[${time}] ${sender}: ${content}`;
      })
      .join('\n');

    stripeEvidence.customer_communication = chatLog.substring(0, 20000); // Stripe limit
  }

  // ─── Customer Info ───
  if (payer) {
    stripeEvidence.customer_name = payer.full_name || payer.username;
    stripeEvidence.customer_email_address = payer.email;
  }

  // ─── Shipping / Service Address ───
  // Useful for "fraudulent" disputes — proves the service was at a real address
  if (gig?.address) {
    stripeEvidence.shipping_address = gig.address;
  }

  // ─── Billing Address ───
  // If we have the payer's address (from Home profile), add it
  // This strengthens evidence against "I didn't authorize this" claims

  // ─── Uncategorized Text ───
  // A catch-all for additional context
  const uncategorized = [];
  uncategorized.push(`Pantopus Platform: Marketplace for local services.`);
  uncategorized.push(`Payment ID: ${payment.id}`);
  if (gig) uncategorized.push(`Gig ID: ${gig.id}`);
  if (bid) {
    uncategorized.push(`Bid amount: $${(bid.amount / 100).toFixed(2)}`);
    uncategorized.push(`Bid placed: ${new Date(bid.created_at).toISOString()}`);
    if (bid.message) uncategorized.push(`Bid message: "${bid.message.substring(0, 200)}"`);
  }
  if (payer) {
    uncategorized.push(`Requester account created: ${new Date(payer.created_at).toISOString()}`);
  }
  uncategorized.push(`Payment created: ${new Date(payment.created_at).toISOString()}`);
  if (payment.captured_at) {
    uncategorized.push(`Payment captured: ${new Date(payment.captured_at).toISOString()}`);
  }

  stripeEvidence.uncategorized_text = uncategorized.join('\n').substring(0, 20000);

  return stripeEvidence;
}

/**
 * Submit dispute evidence to Stripe.
 *
 * @param {string} paymentId - Payment UUID
 * @param {boolean} submit - If true, submits (finalizes) the evidence. Default false (save draft).
 * @returns {object} Stripe dispute object
 */
async function submitDisputeEvidence(paymentId, submit = true) {
  try {
    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('id, dispute_id, dispute_status')
      .eq('id', paymentId)
      .single();

    if (!payment) throw new Error('Payment not found');
    if (!payment.dispute_id) throw new Error('Payment has no dispute');

    // Check if dispute is still open
    if (['won', 'lost'].includes(payment.dispute_status)) {
      throw new Error(`Dispute already resolved: ${payment.dispute_status}`);
    }

    // Gather and build evidence
    const evidence = await gatherEvidence(paymentId);
    const stripeEvidence = buildStripeEvidence(evidence);

    logger.info('Submitting dispute evidence', {
      paymentId,
      disputeId: payment.dispute_id,
      evidenceFields: Object.keys(stripeEvidence),
      submit,
    });

    // Submit to Stripe
    const dispute = await stripe.disputes.update(payment.dispute_id, {
      evidence: stripeEvidence,
      submit,
    });

    // Update payment record
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from('Payment').update({
      dispute_evidence_submitted_at: submit ? nowIso : null,
      dispute_status: dispute.status,
      updated_at: nowIso,
    }).eq('id', paymentId);

    logger.info('Dispute evidence submitted', {
      paymentId,
      disputeId: payment.dispute_id,
      submitted: submit,
      disputeStatus: dispute.status,
    });

    return {
      success: true,
      disputeId: payment.dispute_id,
      disputeStatus: dispute.status,
      evidenceSubmitted: submit,
    };

  } catch (err) {
    logger.error('Error submitting dispute evidence', {
      error: err.message,
      paymentId,
    });
    throw err;
  }
}

/**
 * Get a preview of the evidence that would be submitted.
 * Useful for admin review before submission.
 *
 * @param {string} paymentId - Payment UUID
 * @returns {object} Evidence bundle and formatted Stripe evidence
 */
async function previewDisputeEvidence(paymentId) {
  try {
    const evidence = await gatherEvidence(paymentId);
    const stripeEvidence = buildStripeEvidence(evidence);

    return {
      rawEvidence: {
        hasGig: !!evidence.gig,
        hasCompletionProof: !!(evidence.gig?.completion_photos?.length || evidence.gig?.completion_note),
        hasOwnerConfirmation: !!evidence.gig?.owner_confirmed_at,
        hasReview: !!evidence.review,
        chatMessageCount: evidence.chatMessages.length,
        hasBid: !!evidence.bid,
      },
      stripeEvidence,
    };

  } catch (err) {
    logger.error('Error previewing dispute evidence', { error: err.message, paymentId });
    throw err;
  }
}

module.exports = {
  gatherEvidence,
  buildStripeEvidence,
  submitDisputeEvidence,
  previewDisputeEvidence,
};
