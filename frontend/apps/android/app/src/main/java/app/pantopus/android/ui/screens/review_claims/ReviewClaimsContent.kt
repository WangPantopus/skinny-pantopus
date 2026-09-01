@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.review_claims

import app.pantopus.android.data.api.models.admin.AdminClaimBucket
import app.pantopus.android.data.api.models.admin.AdminClaimDto
import app.pantopus.android.data.api.models.admin.AdminClaimHomeDto
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Helper types + projections shared by `ReviewClaimsViewModel` and
 * `ReviewClaimDetailViewModel`. Mirrors iOS `ReviewClaimsContent.swift`
 * — same chip / method / evidence-label vocabulary so the same words
 * surface across iOS, Android, and web.
 */

/** Reviewer-facing label for a claim's `method` field. */
object AdminClaimMethodLabel {
    fun display(method: String?): String =
        when (method) {
            "doc_upload" -> "Document Upload"
            "escrow_agent" -> "Escrow/Title Agent"
            "property_data_match" -> "ID Verification"
            "invite" -> "Invited"
            "vouch" -> "Vouched"
            "landlord_portal" -> "Landlord Portal"
            null -> "Unknown method"
            else -> humanize(method)
        }

    private fun humanize(snake: String): String =
        snake
            .replace('_', ' ')
            .split(' ')
            .joinToString(" ") { word ->
                word.replaceFirstChar { it.uppercase() }
            }
}

/** Reviewer-facing label for a piece of `HomeVerificationEvidence`. */
object AdminClaimEvidenceLabel {
    fun display(type: String): String =
        when (type) {
            "deed" -> "Deed"
            "closing_disclosure" -> "Closing Disclosure"
            "tax_bill" -> "Tax Bill"
            "utility_bill" -> "Utility Bill"
            "lease" -> "Lease Agreement"
            "escrow_attestation" -> "Escrow Attestation"
            "title_match" -> "Title Match"
            "idv" -> "ID Verification"
            else ->
                type
                    .replace('_', ' ')
                    .split(' ')
                    .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }
        }
}

/**
 * Six-stop avatar gradient palette keyed by a stable hash of the
 * claimant id. Drawn from [PantopusColors] tokens — no hex literals
 * here.
 */
object AdminClaimAvatarGradient {
    private val palette: List<GradientPair> =
        listOf(
            GradientPair(PantopusColors.primary500, PantopusColors.primary700),
            GradientPair(PantopusColors.error, PantopusColors.business),
            GradientPair(PantopusColors.warning, PantopusColors.handyman),
            GradientPair(PantopusColors.success, PantopusColors.home),
            GradientPair(PantopusColors.business, PantopusColors.primary700),
            GradientPair(PantopusColors.primary600, PantopusColors.primary500),
        )

    fun gradient(seed: String): GradientPair {
        var hash = 0
        for (ch in seed) hash += ch.code
        val idx = (hash % palette.size + palette.size) % palette.size
        return palette[idx]
    }
}

/** Triage chip descriptor — text + icon + variant. */
data class AdminClaimChipDescriptor(
    val text: String,
    val icon: PantopusIcon,
    val variant: StatusChipVariant,
)

/** Build the triage / terminal chip for a row given its bucket + state. */
object AdminClaimChip {
    private const val SECONDS_PER_DAY = 86_400L
    private const val AGING_THRESHOLD_DAYS = 7L

    fun descriptor(
        claim: AdminClaimDto,
        bucket: AdminClaimBucket,
        referenceInstant: Instant = Instant.now(),
    ): AdminClaimChipDescriptor =
        when (bucket) {
            AdminClaimBucket.Approved ->
                AdminClaimChipDescriptor(
                    text = "Approved",
                    icon = PantopusIcon.CheckCircle,
                    variant = StatusChipVariant.Success,
                )
            AdminClaimBucket.Rejected ->
                AdminClaimChipDescriptor(
                    text = "Rejected",
                    icon = PantopusIcon.CircleSlash,
                    variant = StatusChipVariant.ErrorVariant,
                )
            AdminClaimBucket.Pending -> pendingDescriptor(claim, referenceInstant)
        }

    private fun pendingDescriptor(
        claim: AdminClaimDto,
        referenceInstant: Instant,
    ): AdminClaimChipDescriptor {
        if (claim.state == "disputed") {
            return AdminClaimChipDescriptor(
                text = "Conflict",
                icon = PantopusIcon.AlertTriangle,
                variant = StatusChipVariant.ErrorVariant,
            )
        }
        if (claim.state == "needs_more_info") {
            return AdminClaimChipDescriptor(
                text = "Awaiting docs",
                icon = PantopusIcon.Hourglass,
                variant = StatusChipVariant.Neutral,
            )
        }
        val ageDays = ageDays(claim.createdAt, referenceInstant)
        return if (ageDays != null && ageDays >= AGING_THRESHOLD_DAYS) {
            AdminClaimChipDescriptor(
                text = "Aging · ${ageDays}d",
                icon = PantopusIcon.Clock,
                variant = StatusChipVariant.Warning,
            )
        } else {
            AdminClaimChipDescriptor(
                text = "New",
                icon = PantopusIcon.Sparkles,
                variant = StatusChipVariant.Info,
            )
        }
    }

    private fun ageDays(
        iso: String,
        referenceInstant: Instant,
    ): Long? =
        parseInstant(iso)?.let { created ->
            val seconds = (referenceInstant.epochSecond - created.epochSecond).coerceAtLeast(0)
            seconds / SECONDS_PER_DAY
        }
}

/** Human-readable "filed Xago" — short units to match the web row. */
object AdminClaimTimeFormat {
    private const val SECONDS_PER_MINUTE = 60L
    private const val SECONDS_PER_HOUR = 3_600L
    private const val SECONDS_PER_DAY = 86_400L

    fun submittedAgo(
        iso: String,
        referenceInstant: Instant = Instant.now(),
    ): String {
        val instant = parseInstant(iso) ?: return ""
        val seconds = (referenceInstant.epochSecond - instant.epochSecond).coerceAtLeast(0)
        return when {
            seconds < SECONDS_PER_MINUTE -> "filed just now"
            seconds < SECONDS_PER_HOUR -> "filed ${seconds / SECONDS_PER_MINUTE}m ago"
            seconds < SECONDS_PER_DAY -> "filed ${seconds / SECONDS_PER_HOUR}h ago"
            else -> "filed ${seconds / SECONDS_PER_DAY}d ago"
        }
    }

    /** Format the banner's oldest-in-queue subtitle. */
    fun oldestAge(seconds: Int?): String {
        if (seconds == null) return "no claims"
        return when {
            seconds < SECONDS_PER_MINUTE -> "${seconds}s"
            seconds < SECONDS_PER_HOUR -> "${seconds / SECONDS_PER_MINUTE} min"
            seconds < SECONDS_PER_DAY -> "${seconds / SECONDS_PER_HOUR}h"
            else -> "${seconds / SECONDS_PER_DAY}d"
        }
    }

    /** Format an ISO date as "Mar 4, 2026". */
    fun longDate(iso: String): String {
        val instant = parseInstant(iso) ?: return iso
        return runCatching {
            LONG_DATE_FMT.format(instant.atZone(ZoneId.systemDefault()))
        }.getOrDefault(iso)
    }

    private val LONG_DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
}

/** Address line projection for the row subtitle + detail header. */
object AdminClaimAddressFormat {
    fun full(home: AdminClaimHomeDto?): String {
        if (home == null) return "Unknown address"
        val head = home.name?.takeIf { it.isNotEmpty() } ?: home.address
        val parts =
            listOfNotNull(
                head?.takeIf { it.isNotEmpty() },
                home.city?.takeIf { it.isNotEmpty() },
                home.state?.takeIf { it.isNotEmpty() },
            )
        return if (parts.isEmpty()) "Unknown address" else parts.joinToString(", ")
    }
}

/** Parse common ISO-8601 variants (with / without fractional seconds, with / without offset). */
internal fun parseInstant(iso: String): Instant? {
    if (iso.isBlank()) return null
    runCatching { return Instant.parse(iso) }
    // Naive timestamps (no trailing offset) — assume UTC.
    runCatching { return Instant.parse(iso + "Z") }
    return null
}
