/**
 * feedRanking.js — Utility score computation for Pantopus posts
 *
 * Called by a background job (can run on a cron every 15 minutes).
 * Score range: 0.0 — 10.0
 *
 * Signals:
 *   + Location attached (geo-anchored posts are more trustworthy)
 *   + Has actionable intent (ask/offer/heads_up/event/deal score highest)
 *   + Has media (photos add credibility)
 *   + Engagement: saves > likes (saves = "I found this useful")
 *   + Comments show discussion value
 *   + Marked solved (Ask posts that got answered = high utility)
 *   - Not helpful flags (community down-signals)
 *   - Very old posts (decay after 7 days)
 *   - Visitor posts (slight penalty in home feeds, not travel feeds)
 */

const HIGH_INTENT_PURPOSES = ['ask', 'offer', 'heads_up', 'event', 'deal'];
const MEDIUM_INTENT_PURPOSES = ['recommend', 'learn', 'showcase'];

function computeUtilityScore(post) {
  let score = 3.0; // baseline

  // Intent signal (most important)
  if (HIGH_INTENT_PURPOSES.includes(post.purpose)) score += 2.0;
  else if (MEDIUM_INTENT_PURPOSES.includes(post.purpose)) score += 1.0;

  // Location signal
  if (post.latitude && post.longitude) score += 0.5;

  // Media signal
  if (post.media_urls && post.media_urls.length > 0) score += 0.5;

  // Engagement (saves weighted 3x over likes — saves = "useful")
  const saveScore = Math.min((post.save_count || 0) * 0.3, 1.5);
  const likeScore = Math.min((post.like_count || 0) * 0.1, 0.5);
  const commentScore = Math.min((post.comment_count || 0) * 0.15, 0.75);
  score += saveScore + likeScore + commentScore;

  // Solved bonus
  if (post.state === 'solved') score += 0.75;

  // Not helpful penalty
  const nhPenalty = Math.min((post.not_helpful_count || 0) * 0.5, 3.0);
  score -= nhPenalty;

  // Time decay (posts older than 7 days lose value)
  const createdMs = new Date(post.created_at).getTime();
  const ageHours = Number.isFinite(createdMs) ? (Date.now() - createdMs) / 3600000 : 0;
  if (ageHours > 168) { // > 7 days
    score -= Math.min((ageHours - 168) / 168 * 1.0, 2.0);
  }

  return Math.max(0, Math.min(10, Math.round(score * 100) / 100));
}

module.exports = { computeUtilityScore, HIGH_INTENT_PURPOSES, MEDIUM_INTENT_PURPOSES };
