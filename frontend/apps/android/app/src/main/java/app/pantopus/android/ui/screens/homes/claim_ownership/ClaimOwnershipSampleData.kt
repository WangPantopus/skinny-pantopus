@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_ownership

/** Deterministic fixture data for the Claim Ownership wizard start step. */
data class ClaimOwnershipStartContent(
    val homeLabel: String,
    val contestedClaim: ClaimOwnershipContestedClaim? = null,
) {
    val isContested: Boolean get() = contestedClaim != null
}

data class ClaimOwnershipContestedClaim(
    val title: String,
    val body: String,
    val claimantInitials: String,
    val claimantName: String,
    val filedLabel: String,
    val statusLabel: String,
)

/**
 * Verdict of the per-file address check surfaced on each populated upload
 * slot. [detail] is the supporting copy shown after the bold lead.
 */
sealed interface ClaimAddressMatch {
    val detail: String

    data class Matches(override val detail: String) : ClaimAddressMatch

    data class Differs(override val detail: String) : ClaimAddressMatch
}

object ClaimOwnershipSampleData {
    fun startContent(homeId: String): ClaimOwnershipStartContent =
        if (homeId.contains("contested", ignoreCase = true)) {
            contestedStart
        } else {
            canonicalStart
        }

    /**
     * Sample-data heuristic standing in for real server-side OCR address
     * extraction. A document "matches" when its filename carries the home's
     * street number; otherwise we surface a soft, non-blocking mismatch the
     * reviewer resolves at review time. Swap for the OCR result once the
     * evidence pipeline returns a parsed address.
     */
    fun addressMatch(
        filename: String,
        homeLabel: String,
    ): ClaimAddressMatch {
        val streetNumber = homeLabel.takeWhile { it.isDigit() }
        val haystack = filename.lowercase()
        return if (streetNumber.isNotEmpty() && haystack.contains(streetNumber)) {
            ClaimAddressMatch.Matches("\"$homeLabel\" matches the address on your account.")
        } else {
            ClaimAddressMatch.Differs(
                "We couldn't confirm $homeLabel on this document. " +
                    "You can still submit — the reviewer will resolve it.",
            )
        }
    }

    val canonicalStart =
        ClaimOwnershipStartContent(
            homeLabel = "412 Elm St",
        )

    val contestedStart =
        ClaimOwnershipStartContent(
            homeLabel = "412 Elm St",
            contestedClaim =
                ClaimOwnershipContestedClaim(
                    title = "Another claim is already in review",
                    body =
                        "A verified resident at this address filed an ownership claim 3 days ago. " +
                            "You can still claim; both claims will be reviewed together.",
                    claimantInitials = "JR",
                    claimantName = "J. R.",
                    filedLabel = "Filed Oct 9",
                    statusLabel = "Under review",
                ),
        )
}
