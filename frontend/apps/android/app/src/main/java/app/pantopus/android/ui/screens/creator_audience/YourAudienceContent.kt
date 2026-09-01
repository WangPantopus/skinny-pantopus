@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.creator_audience

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.audience.AudienceCountsDto
import app.pantopus.android.data.api.models.audience.FanDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

// ──
//  A22.2 "Your audience" — creator-side member management models.
//  Wire DTOs (AudienceListResponse / FanDto) are decoded by the shared
//  AudienceProfile networking layer; these are the projections the
//  screen renders. Sibling of A22.1 Audience (the broadcast hub).
// ──

/** Scope chip. Selecting one re-fetches with the matching query params;
 *  counts are computed by the backend before filtering, so chips always
 *  show full totals. */
sealed interface AudienceFilter {
    data object All : AudienceFilter

    data object Pending : AudienceFilter

    data class Tier(val rank: Int) : AudienceFilter

    val statusParam: String?
        get() = if (this is Pending) "pending" else null

    val tierRankParam: Int?
        get() = (this as? Tier)?.rank

    val showsPendingSection: Boolean
        get() = this is All || this is Pending

    val showsTierGroups: Boolean
        get() = this is All || this is Tier
}

/** Owner-side member actions. `wire` matches `audienceMemberActionSchema`
 *  (`backend/routes/personas.js:104`). */
enum class AudienceMemberAction(val wire: String) {
    Approve("approve"),
    Decline("decline"),
    Remove("remove"),
    Mute("mute"),
    Unmute("unmute"),
}

/** Order the audience list is fetched in. `wire` matches the backend's
 *  `audienceSortValues` (`backend/routes/personas.js:101`); the header
 *  control cycles them in declaration order, matching RN's
 *  `src/app/audience/members.tsx:216-219`. */
enum class AudienceSort(val wire: String, val label: String) {
    Recent("recent", "Newest first"),
    Tenure("tenure", "Longest-tenured first"),
    Tier("tier", "Highest tier first"),
    Alpha("alpha", "Alphabetical"),
    ;

    /** Next entry in the cycle (wraps back to [Recent]). */
    fun next(): AudienceSort {
        val all = entries
        return all[(ordinal + 1) % all.size]
    }
}

// ── Tier styling (rank → semantic token) ──
// Mirrors AudienceProfile's rank→token mapping so A22.2 reads identically
// to its A22.1 sibling and to the iOS build. Tokens only — the design's
// "VIP gold / Insiders silver" render through the existing palette, never
// a literal gold/silver hex (CI hex-grep guard).

internal fun audienceTierColor(rank: Int): Color =
    when (rank) {
        4 -> PantopusColors.business
        3 -> PantopusColors.warning
        2 -> PantopusColors.success
        1 -> PantopusColors.primary600
        else -> PantopusColors.appTextSecondary
    }

internal fun audienceTierBg(rank: Int): Color =
    when (rank) {
        4 -> PantopusColors.businessBg
        3 -> PantopusColors.warningBg
        2 -> PantopusColors.successBg
        1 -> PantopusColors.primary50
        else -> PantopusColors.appSurfaceSunken
    }

internal fun audienceTierIcon(rank: Int): PantopusIcon =
    when (rank) {
        4 -> PantopusIcon.Crown
        3 -> PantopusIcon.Star
        2 -> PantopusIcon.Heart
        else -> PantopusIcon.Users
    }

internal fun audienceTierDefaultName(rank: Int): String = if (rank in 1..4) "Tier $rank" else "Members"

// ── UI models ──

data class AudienceMember(
    val membershipId: String,
    val displayName: String,
    val handle: String,
    val avatarUrl: String?,
    val tierRank: Int,
    val tierName: String,
    val verifiedLocal: Boolean,
    val status: String,
    val joinedMonth: String?,
    val tenureMonths: Int,
) {
    val isPending: Boolean get() = status == "pending"
    val isMuted: Boolean get() = status == "muted"
}

/** Maps the creator-side wire DTO to a UI member, or null when it lacks a
 *  membership id (can't be acted on). */
fun FanDto.toAudienceMember(): AudienceMember? {
    val identifier = (membershipId ?: fanHandle).orEmpty()
    if (identifier.isEmpty()) return null
    val rawHandle = fanHandle.orEmpty()
    val normalizedHandle = if (rawHandle.startsWith("@")) rawHandle else "@$rawHandle"
    val rank = tier?.rank ?: 1
    return AudienceMember(
        membershipId = identifier,
        displayName = fanDisplayName ?: rawHandle.ifEmpty { "Member" },
        handle = normalizedHandle,
        avatarUrl = fanAvatarUrl,
        tierRank = rank,
        tierName = tier?.name ?: audienceTierDefaultName(rank),
        verifiedLocal = verifiedLocal ?: false,
        status = status ?: "active",
        joinedMonth = joinedMonth,
        tenureMonths = tenureMonths ?: 0,
    )
}

/** Counts computed before filtering, so chips show full totals always. */
data class AudienceCounts(
    val totalActive: Int = 0,
    val pending: Int = 0,
    val byTier: Map<Int, Int> = emptyMap(),
) {
    companion object {
        fun from(dto: AudienceCountsDto): AudienceCounts =
            AudienceCounts(
                totalActive = dto.totalActive ?: 0,
                pending = dto.pending ?: 0,
                byTier =
                    dto.byTier.orEmpty()
                        .mapNotNull { (key, value) -> key.toIntOrNull()?.let { it to value } }
                        .toMap(),
            )
    }
}

data class AudienceTierChip(val rank: Int, val name: String, val count: Int)

data class AudienceTierGroup(
    val rank: Int,
    val name: String,
    val members: List<AudienceMember>,
)

data class AudienceLoaded(
    val counts: AudienceCounts,
    val pending: List<AudienceMember>,
    val tierGroups: List<AudienceTierGroup>,
)

/**
 * A destructive action (decline / remove) held open in its undo window. RN
 * removes the row immediately, shows a 5-second "Tap to undo" toast, and
 * only fires the `PATCH` once the window closes
 * (`src/app/audience/members.tsx:95-121`).
 */
data class PendingAudienceUndo(
    val membershipId: String,
    /** "Removed @jane · Tap to undo". */
    val message: String,
)

/** Single source of truth for the screen body. */
sealed interface YourAudienceUiState {
    data object Loading : YourAudienceUiState

    data class Loaded(val loaded: AudienceLoaded) : YourAudienceUiState

    /** Full empty — no members and no pending requests at all. */
    data object Empty : YourAudienceUiState

    data class Error(val message: String) : YourAudienceUiState
}

// ── Pure derivations (testable without a view-model) ──

fun audienceCountLine(counts: AudienceCounts): String {
    if (counts.totalActive == 0 && counts.pending == 0) return "0 members"
    val memberWord = if (counts.totalActive == 1) "member" else "members"
    return "${counts.totalActive} $memberWord · ${counts.pending} pending"
}

/** One chip per tier with a non-zero count, premium first (matches the
 *  design's VIP-before-Insiders order). */
fun audienceTierChips(
    counts: AudienceCounts,
    tierNames: Map<Int, String>,
): List<AudienceTierChip> =
    counts.byTier
        .filterValues { it > 0 }
        .keys
        .sortedDescending()
        .map { rank ->
            AudienceTierChip(
                rank = rank,
                name = tierNames[rank] ?: audienceTierDefaultName(rank),
                count = counts.byTier[rank] ?: 0,
            )
        }

fun groupMembersByTier(
    members: List<AudienceMember>,
    tierNames: Map<Int, String>,
): List<AudienceTierGroup> =
    members.groupBy { it.tierRank }
        .map { (rank, group) ->
            AudienceTierGroup(
                rank = rank,
                name = tierNames[rank] ?: group.firstOrNull()?.tierName ?: audienceTierDefaultName(rank),
                members = group,
            )
        }
        .sortedByDescending { it.rank }

// ── Formatting ──

object AudienceFormat {
    private val MONTHS =
        listOf(
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        )

    /** "2025-05" → "May 2025". Month granularity is all the privacy
     *  serializer exposes. */
    fun monthLabel(value: String?): String? =
        value
            ?.split("-")
            ?.takeIf { it.size == 2 }
            ?.let { parts ->
                val year = parts[0].toIntOrNull()
                val month = parts[1].toIntOrNull()
                if (year != null && month != null && month in 1..12) {
                    "${MONTHS[month - 1]} $year"
                } else {
                    null
                }
            }

    fun requestedLabel(month: String?): String = monthLabel(month)?.let { "requested $it" } ?: "requested recently"

    fun memberSinceLabel(month: String?): String? = monthLabel(month)?.let { "Member since $it" }
}
