// ============================================================
// MONTHLY RECEIPT SERVICE — Personalized monthly value summary
// Computes earnings, spending, marketplace, community & reputation
// stats for a given user and month.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const { getEarningsForUser } = require('./earningsService');

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Compute a personalized monthly receipt for a user.
 * @param {string} userId
 * @param {number} year  — e.g. 2026
 * @param {number} month — 1-based (1 = January)
 * @returns {Promise<object>} receipt
 */
async function computeMonthlyReceipt(userId, year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const endDate = new Date(Date.UTC(year, month, 1)).toISOString(); // first instant of next month (exclusive)

  const [
    earningsResult,
    spendingResult,
    gigCategoryResult,
    listingsSoldResult,
    listingsBoughtResult,
    freeClaimedResult,
    postsResult,
    connectionsResult,
    neighborsHelpedResult,
    userResult,
    reviewsThisMonthResult,
    prevMonthReviewsResult,
  ] = await Promise.allSettled([
    // 0 — EARNINGS (worker)
    getEarningsForUser(userId, startDate, endDate),

    // 1 — SPENDING (poster): completed gigs the user posted
    supabaseAdmin
      .from('Gig')
      .select('price')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('owner_confirmed_at', startDate)
      .lt('owner_confirmed_at', endDate),

    // 2 — Top category for gigs worked
    supabaseAdmin
      .from('Gig')
      .select('category')
      .eq('accepted_by', userId)
      .eq('status', 'completed')
      .gte('owner_confirmed_at', startDate)
      .lt('owner_confirmed_at', endDate),

    // 3 — MARKETPLACE: listings sold
    supabaseAdmin
      .from('Listing')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sold')
      .gte('sold_at', startDate)
      .lt('sold_at', endDate),

    // 4 — MARKETPLACE: listings bought (via ListingOffer)
    supabaseAdmin
      .from('ListingOffer')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lt('completed_at', endDate),

    // 5 — MARKETPLACE: free items claimed (via ListingOffer on free listings)
    supabaseAdmin
      .from('ListingOffer')
      .select('id, listing:listing_id(is_free)')
      .eq('buyer_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lt('completed_at', endDate),

    // 6 — COMMUNITY: posts created
    supabaseAdmin
      .from('Post')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lt('created_at', endDate),

    // 7 — COMMUNITY: connections made (accepted in date range)
    supabaseAdmin
      .from('Relationship')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .gte('accepted_at', startDate)
      .lt('accepted_at', endDate),

    // 8 — COMMUNITY: neighbors helped (gigs completed as worker)
    supabaseAdmin
      .from('Gig')
      .select('id', { count: 'exact', head: true })
      .eq('accepted_by', userId)
      .eq('status', 'completed')
      .gte('owner_confirmed_at', startDate)
      .lt('owner_confirmed_at', endDate),

    // 9 — REPUTATION: current user rating
    supabaseAdmin
      .from('User')
      .select('average_rating, review_count')
      .eq('id', userId)
      .single(),

    // 10 — REPUTATION: reviews received this month
    supabaseAdmin
      .from('Review')
      .select('rating')
      .eq('reviewee_id', userId)
      .gte('created_at', startDate)
      .lt('created_at', endDate),

    // 11 — REPUTATION: reviews received previous month (for rating_change)
    (() => {
      const prevStart = new Date(Date.UTC(year, month - 2, 1)).toISOString();
      const prevEnd = startDate; // first instant of current month
      return supabaseAdmin
        .from('Review')
        .select('rating')
        .eq('reviewee_id', userId)
        .gte('created_at', prevStart)
        .lt('created_at', prevEnd);
    })(),
  ]);

  // --- Extract earnings ---
  let earningsTotal = 0;
  let earningsGigCount = 0;
  if (earningsResult.status === 'fulfilled' && earningsResult.value) {
    earningsTotal = earningsResult.value.total_earned_cents || 0;
    earningsGigCount = earningsResult.value.total_payments || 0;
  }

  // --- Top category ---
  let topCategory = null;
  if (gigCategoryResult.status === 'fulfilled' && gigCategoryResult.value?.data) {
    const cats = {};
    for (const row of gigCategoryResult.value.data) {
      if (row.category) {
        cats[row.category] = (cats[row.category] || 0) + 1;
      }
    }
    const entries = Object.entries(cats);
    if (entries.length) {
      topCategory = entries.sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  // --- Spending ---
  let spendingTotal = 0;
  let spendingGigCount = 0;
  if (spendingResult.status === 'fulfilled' && spendingResult.value?.data) {
    const rows = spendingResult.value.data;
    spendingGigCount = rows.length;
    for (const row of rows) {
      spendingTotal += Math.round((Number(row.price) || 0) * 100);
    }
  }

  // --- Marketplace ---
  const listingsSold = listingsSoldResult.status === 'fulfilled'
    ? (listingsSoldResult.value?.count ?? 0) : 0;
  const listingsBought = listingsBoughtResult.status === 'fulfilled'
    ? (listingsBoughtResult.value?.count ?? 0) : 0;

  let freeItemsClaimed = 0;
  if (freeClaimedResult.status === 'fulfilled' && freeClaimedResult.value?.data) {
    freeItemsClaimed = freeClaimedResult.value.data.filter(
      (r) => r.listing?.is_free === true,
    ).length;
  }

  // --- Community ---
  const postsCreated = postsResult.status === 'fulfilled'
    ? (postsResult.value?.count ?? 0) : 0;
  const connectionsMade = connectionsResult.status === 'fulfilled'
    ? (connectionsResult.value?.count ?? 0) : 0;
  const neighborsHelped = neighborsHelpedResult.status === 'fulfilled'
    ? (neighborsHelpedResult.value?.count ?? 0) : 0;

  // --- Reputation ---
  const userData = userResult.status === 'fulfilled' ? userResult.value?.data : null;
  const currentRating = Number(userData?.average_rating || 0);
  const reviewsReceived = reviewsThisMonthResult.status === 'fulfilled'
    ? (reviewsThisMonthResult.value?.data?.length ?? 0) : 0;

  let ratingChange = null;
  if (
    reviewsThisMonthResult.status === 'fulfilled' &&
    prevMonthReviewsResult.status === 'fulfilled'
  ) {
    const thisMonthReviews = reviewsThisMonthResult.value?.data || [];
    const prevMonthReviews = prevMonthReviewsResult.value?.data || [];
    if (thisMonthReviews.length && prevMonthReviews.length) {
      const avg = (arr) => arr.reduce((s, r) => s + (Number(r.rating) || 0), 0) / arr.length;
      ratingChange = Math.round((avg(thisMonthReviews) - avg(prevMonthReviews)) * 100) / 100;
    }
  }

  // --- Highlight ---
  const earningsDollars = Math.round(earningsTotal / 100);
  let highlight;
  if (earningsTotal > 0 && neighborsHelped > 0) {
    highlight = `You earned $${earningsDollars} and helped ${neighborsHelped} neighbor${neighborsHelped === 1 ? '' : 's'}!`;
  } else if (earningsTotal > 0) {
    highlight = `You earned $${earningsDollars} from ${earningsGigCount} gig${earningsGigCount === 1 ? '' : 's'} this month!`;
  } else if (neighborsHelped > 0) {
    highlight = `You helped ${neighborsHelped} neighbor${neighborsHelped === 1 ? '' : 's'} this month!`;
  } else if (postsCreated > 0) {
    highlight = `You stayed connected with ${postsCreated} post${postsCreated === 1 ? '' : 's'}!`;
  } else {
    highlight = 'Welcome to another month on Pantopus!';
  }

  return {
    period: { year, month, label: `${MONTH_LABELS[month - 1]} ${year}` },
    earnings: {
      total_cents: earningsTotal,
      gig_count: earningsGigCount,
      top_category: topCategory,
    },
    spending: {
      total_cents: spendingTotal,
      gig_count: spendingGigCount,
    },
    marketplace: {
      listings_sold: listingsSold,
      listings_bought: listingsBought,
      free_items_claimed: freeItemsClaimed,
    },
    community: {
      posts_created: postsCreated,
      connections_made: connectionsMade,
      neighbors_helped: neighborsHelped,
    },
    reputation: {
      current_rating: currentRating,
      reviews_received: reviewsReceived,
      rating_change: ratingChange,
    },
    highlight,
  };
}

module.exports = { computeMonthlyReceipt };
