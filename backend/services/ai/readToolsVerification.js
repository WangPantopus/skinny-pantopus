/**
 * "Where things stand": the person's own home claims, address verification and
 * verification postcard, read through the services their screens use, with what happens
 * next in those screens' own words (AI expansion, phase 1).
 *
 * The claim waiting room reads the person's claims (GET /api/homes/my-ownership-claims,
 * homeOwnershipClaimListService) and, without a claim, their verification at the home
 * (GET /api/homes/:id/dashboard-access, homeDashboardService.readAuthority). The postcard
 * screen reads the postcard (GET /api/homes/:id/postcard-status, homePostcardRequestService)
 * and the residency progress under it (GET /api/homes/:id/my-residency). The words below
 * are those screens' (iOS WaitingRoomContent, HomeVerificationContent, HomePostalMessages,
 * HomeResidencyProgress; Android mirrors them).
 *
 * Only the person's own: claim states are masked for the claimant, so nothing here says
 * whether anyone else claimed the same home, and no street address, code or claim number
 * reaches the model.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { listOwnClaims } = require('../homeOwnershipClaimListService');
const homeDashboardService = require('../homeDashboardService');
const postcardRequests = require('../homePostcardRequestService');
const residencyProgress = require('../homeResidencyProgressService');
const { isUuid, homesOf, dayLabel } = require('./assistantKit');

const MAX_HOMES = 5;

const verificationReadToolDefinitions = [
  {
    name: 'get_home_verification',
    description: "Where the person's own home claims and address verification stand, as their claim and postcard screens show them: each claim they made on a home (ownership, or a renter's residency documents) and whether it is under review or decided, their verification and residency request at each home, and their verification postcard (requested, sent, code expired, verified), each with what happens next. Use it for \"did my postcard go out?\", \"why is my claim still pending?\" or \"am I verified yet?\". It covers only their own claims, so never guess about anyone else's. Pantopus promises no review time: never give one. Read it again each time they ask, even when you answered before in this conversation: claims and postcards change. Link to the screens it names with show_link (home_claim_status is the claim's waiting room, home_verify_postcard the postcard screen) and the home_id it gives.",
    input_schema: {
      type: 'object',
      properties: { home_id: { type: ['string', 'null'], description: 'One home, or null for all of theirs.' } },
      required: ['home_id'],
      additionalProperties: false,
    },
  },
];

// ─── The screens' words ────────────────────────────────────────────────────

// The claim waiting room (WaitingRoomContent.active and its notices; My Claims for decided claims).
function claimForModel(claim, zone, hasAccess = false) {
  const residency = claim.claim_type === 'resident';
  const decided = claim.status !== 'under_review';
  let status;
  let screen;
  if (claim.status === 'under_review' && claim.has_evidence === false) {
    status = 'Add your documents';
    screen = `${residency
      ? 'Upload a lease or utility bill with your name and this address so a Pantopus reviewer can check that you live here.'
      : 'Upload a deed, closing disclosure or property tax bill so a Pantopus reviewer can check ownership.'} The review starts after you upload documents.`;
  } else if (claim.status === 'under_review') {
    status = 'Under review';
    screen = "Your documents are waiting for a Pantopus reviewer. We'll notify you when it's decided.";
  }
  // Without access to the home their address there isn't verified, and the room offers mail verification;
  // the postcard screen adds that it confirms an address, not ownership (HomeResidencyProgress).
  if (claim.status === 'under_review' && !hasAccess) {
    screen += residency
      ? ' Meanwhile, you can verify your address by mail.'
      : " Meanwhile, you can verify your address by mail. Ownership has its own review: verifying your address by mail doesn't make you an owner.";
  } else if (claim.status === 'approved') {
    status = 'Verified';
    screen = residency ? "Your residency claim was approved: you're verified as living here." : "Your ownership claim was approved: you're the owner.";
  } else {
    status = claim.status === 'rejected' ? 'Not approved' : 'Revoked';
    screen = `Your ${residency ? 'residency' : 'ownership'} claim has been decided. Check My Claims for the outcome.`;
  }
  return {
    kind: residency ? 'residency documents' : 'ownership',
    status,
    submitted: dayLabel(claim.created_at, zone),
    ...(decided ? { decided: dayLabel(claim.updated_at, zone) } : {}),
    screen_says: screen,
  };
}

// The waiting room's Verification Center, shown when there is no claim (HomeVerificationContent).
const VERIFICATION_SCREEN = {
  pending_postcard: ['Check your mailbox', 'A verification code has been mailed to this address. Enter the code to complete verification.'],
  provisional_bootstrap: ['Limited access', 'You have provisional access with limited features. Verify your address to unlock full home management.'],
  pending_approval: ['Waiting for approval', 'A household member needs to approve your request. Reopen this screen to check for updates.'],
  pending_doc: ['Document under review', 'Your uploaded documents are waiting for a Pantopus reviewer. Meanwhile, you can verify your address by mail.'],
  provisional: ['Provisional access', 'Verify your address to unlock full home management features.'],
  suspended_challenged: ['Access suspended', 'Your access has been challenged by a household member. Contact support if you believe this is an error.'],
  unverified: ['Verification required', 'Complete verification to access this home.'],
};

function verificationForModel(authority) {
  if (!authority?.verification_required) return null;
  const [status, screen] = VERIFICATION_SCREEN[authority.verification_status] || VERIFICATION_SCREEN.unverified;
  return { kind: authority.verification_kind === 'ownership' ? 'ownership' : 'residency', status, screen_says: screen };
}

// The residency progress the postcard screen shows under it (HomeResidencyProgress).
const RESIDENCY_SCREEN = {
  home: ["You're part of this household", 'Open the Home to see your household. What you can see and change depends on your role.'],
  household_review: ['Waiting for household review', "Someone in the household will review your request. You don't need to upload any documents. Check back here for their answer."],
  address_verification: ["Your address isn't verified yet", 'Your request is saved. To finish, verify your address by mail: request a postcard, then enter the code printed on it.'],
  resubmit: ['Send your request again', 'Check the street, apartment and how you live here, then send your request again.'],
  access_review: ["You don't have household access", 'To come back, add this Home again or ask someone in the household to invite you.'],
  ownership_verification: ['Continue ownership verification', "Ownership has its own review. Verifying your address by mail doesn't make you an owner."],
  unavailable: ["This Home can't be verified right now", "This Home isn't accepting changes right now. Your request is still saved."],
};
const NO_REQUEST_YET = ['Confirm your address', "Check this Home's address, apartment and how you live here, then send your request. We don't mail anything until you ask for a postcard."];

function residencyForModel(progress) {
  if (!progress) return null;
  const words = progress.next_step === 'address_verification' && !progress.request
    ? NO_REQUEST_YET
    : RESIDENCY_SCREEN[progress.next_step];
  if (!words) return null;
  return { status: words[0], screen_says: words[1] };
}

// The postcard screen (HomePostalMessages).
const DELIVERY = {
  not_started: "Your postcard hasn't been sent yet",
  accepted: 'Your postcard is on its way',
  unknown: "We couldn't confirm your postcard was sent",
  rejected: "The mail service couldn't send your postcard",
};

// Whether it went out, from how it travelled (the screen's delivery line), also once it has ended.
const SENT = {
  accepted: 'yes',
  not_started: 'not yet',
  unknown: "couldn't be confirmed",
  rejected: "no: the mail service couldn't send it",
};

function postcardHeadline(card) {
  if (card.status === 'verified') return 'Address verified by mail';
  // A code also expires when its tries are used up.
  if (card.status === 'expired') return card.attempts_remaining === 0 ? 'No tries left for this postcard' : 'Postcard code expired';
  if (card.status === 'cancelled') return 'Postcard no longer active';
  return DELIVERY[card.delivery] || 'Postcard status unavailable';
}

/** What to do next about the postcard, from what the postcard screen offers. */
function postcardNext(status, zone) {
  const card = status.postcard;
  const again = status.can_request ? ' You can request a new one on the postcard screen.' : '';
  if (!card) {
    return status.can_request ? "You haven't requested a postcard yet. You can request one on the postcard screen; one takes about 3 to 7 days to arrive." : null;
  }
  if (card.status === 'verified') return 'Your address is verified by mail; nothing more to do with the postcard.';
  if (card.status === 'expired' || card.status === 'cancelled') {
    const why = card.delivery === 'rejected' ? "The mail service couldn't send it, so it" : 'This postcard';
    return `${why} can't be used anymore.${again}`;
  }
  if (card.delivery === 'accepted') {
    const by = dayLabel(card.expires_at, zone);
    return `It was sent. A postcard takes about 3 to 7 days to arrive; when it comes, enter its code on the postcard screen${by ? ` by ${by}` : ''}.`;
  }
  if (card.delivery === 'not_started') {
    return status.can_resume ? "Your request is saved, but the postcard hasn't been sent: on the postcard screen, tap Send the postcard." : "The postcard hasn't been sent yet.";
  }
  if (card.delivery === 'unknown') return "Pantopus couldn't confirm it was sent. Check the postcard screen again later.";
  return `The mail service couldn't send it.${again}`;
}

function postcardForModel(status, zone) {
  const card = status.postcard;
  const can = [
    status.can_verify ? 'enter the code' : null,
    status.can_resume ? 'send the saved request' : null,
    status.can_request ? 'request a postcard' : null,
  ].filter(Boolean);
  return {
    status: card ? postcardHeadline(card) : "You haven't requested a postcard yet.",
    ...(card ? { requested: dayLabel(card.requested_at, zone), sent: SENT[card.delivery] || null } : {}),
    ...(card?.status === 'pending' ? { code_expires: dayLabel(card.expires_at, zone), tries_left: card.attempts_remaining } : {}),
    ...(can.length ? { you_can_there: can } : {}),
    ...(status.restriction_message ? { screen_says: status.restriction_message } : {}),
  };
}

// ─── The tool ──────────────────────────────────────────────────────────────

const quietly = (promise, what, ctx) => promise.catch((err) => {
  // Not found is an answer (nothing of that kind at this home); anything else couldn't be read.
  if (err?.statusCode === 404 || err?.code === 'RESIDENCY_PROGRESS_NOT_FOUND') return null;
  logger.warn('assistant verification read failed', { what, userId: ctx.userId, error: err?.message, code: err?.code });
  return { unreadable: true };
});

async function placesOf(homeIds) {
  if (!homeIds.length) return new Map();
  const { data } = await supabaseAdmin.from('Home').select('id, city, state').in('id', homeIds);
  return new Map((data || []).map((home) => [home.id, home]));
}

async function getHomeVerification(args, ctx) {
  const userId = ctx.userId;
  const zone = ctx.timeZone;
  const [claims, mine, requests] = await Promise.all([
    listOwnClaims(userId),
    homesOf(userId),
    residencyProgress.list(userId).then((page) => page.requests).catch(() => []),
  ]);
  // Their claims' homes first (newest first), then the homes they're joining or live in.
  const ids = [...new Set([
    ...claims.map((claim) => claim.home_id),
    ...requests.map((request) => request.home_id),
    ...mine.homes.map((home) => home.id),
  ].filter(isUuid))];
  const chosen = isUuid(args.home_id) ? ids.filter((id) => id === args.home_id) : ids;
  if (!chosen.length) {
    return {
      homes: [],
      note: isUuid(args.home_id)
        ? 'They have no claim, residency request or verification at that home.'
        : 'They have no home claims, residency requests or homes in Pantopus yet. Adding a home starts on the Place tab.',
    };
  }
  const places = await placesOf(chosen.filter((id) => !mine.homes.some((home) => home.id === id)));
  const homes = await Promise.all(chosen.slice(0, MAX_HOMES).map(async (homeId) => {
    const [authority, postcard, progress] = await Promise.all([
      quietly(homeDashboardService.readAuthority({ homeId, actorId: userId }), 'dashboard-access', ctx),
      quietly(postcardRequests.current({ homeId, actorId: userId }), 'postcard-status', ctx),
      quietly(residencyProgress.read(homeId, userId), 'my-residency', ctx),
    ]);
    const claim = claims.find((row) => row.home_id === homeId) || null;
    const listed = mine.homes.find((home) => home.id === homeId);
    const place = listed || claim?.home || places.get(homeId) || {};
    let verification = authority?.unreadable ? null : verificationForModel(authority);
    // The postcard counts when there is one or the postcard screen offers something; its refusal
    // ("use ownership verification") only while a claim or a verification is pending.
    const mail = postcard && !postcard.unreadable ? postcard : null;
    const mailOffered = Boolean(mail && (mail.postcard || mail.can_request || mail.can_verify || mail.can_resume));
    const mailShown = mailOffered || Boolean(mail?.restriction_message && (claim?.status === 'under_review' || verification));
    // The waiting room's "a code has been mailed" is the postcard screen's to say: it knows whether one was.
    if (verification && authority.verification_status === 'pending_postcard' && mailOffered) {
      verification = { kind: verification.kind, status: verification.status };
    }
    const parts = {
      claim: claim ? claimForModel(claim, zone, Boolean(authority?.hasAccess)) : null,
      verification,
      residency_request: progress?.unreadable ? null : residencyForModel(progress),
      postcard: mailShown ? postcardForModel(mail, zone) : null,
    };
    const next = [
      parts.claim && parts.claim.status !== 'Verified' ? parts.claim.screen_says : null,
      mailOffered ? postcardNext(mail, zone) : null,
      !parts.claim && verification?.screen_says ? verification.screen_says : null,
    ].filter(Boolean);
    const unread = [authority, postcard, progress].some((read) => read?.unreadable);
    const screens = [
      claim || verification ? 'home_claim_status' : null,
      mailOffered ? 'home_verify_postcard' : null,
    ].filter(Boolean);
    return {
      home_id: homeId,
      place: [place.city, place.state].filter(Boolean).join(', ') || null,
      ...(listed ? { your_role: listed.role, shown_on_today: listed.is_default } : {}),
      ...Object.fromEntries(Object.entries(parts).filter(([, value]) => value)),
      what_happens_next: next,
      ...(unread ? { not_checked: 'Part of this home\'s status couldn\'t be read just now; say so rather than guessing.' } : {}),
      screens,
    };
  }));
  return {
    note: 'Their own claims and verification only, as their screens show them. Use the screens\' words; never guess a review time or anything about other people. Before you answer, add a show_link button for each screen a home lists in `screens` (with its home_id), every time you read this.',
    homes,
    ...(chosen.length > MAX_HOMES ? { more_homes: chosen.length - MAX_HOMES } : {}),
  };
}

async function runVerificationReadTool(name, args, ctx) {
  if (name !== 'get_home_verification') return null;
  try {
    return await getHomeVerification(args || {}, ctx);
  } catch (err) {
    logger.warn('assistant read tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

module.exports = { verificationReadToolDefinitions, runVerificationReadTool, getHomeVerification };
