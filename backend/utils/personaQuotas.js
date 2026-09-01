// Pure quota math for the audience-profile tier ladder.
//
// Audience Profile design v2 §7.3: quota remaining for a (membership,
// capability) is computed by counting non-reverted PersonaQuotaUsage rows
// inside the current [period_start, period_end) window. This module is
// the pure-function side of that calculation — callers fetch the count
// and the tier limit and pass them in. Keeping it pure means every
// serializer / route that needs to render quota state does so from
// already-fetched data, with no DB round-trips inside the renderer.
//
// Returns:
//   null  — tier has no access to this capability (e.g. Follower has
//           no msg_threads quota).
//   -1    — tier supports the capability without a per-period limit.
//           Reserved for future use; v1 has no unlimited quotas
//           (design v2 §1 invariant 2: "no unlimited anywhere").
//   int   — non-negative remaining count.

function computeQuotaRemaining(tierLimit, usageCount) {
  if (tierLimit == null) return null;
  if (tierLimit < 0) return -1;
  const used = Math.max(0, usageCount | 0);
  return Math.max(0, tierLimit - used);
}

module.exports = { computeQuotaRemaining };
