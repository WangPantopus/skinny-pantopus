package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.status.waiting_room.WaitingRoomApproval
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

// My Homes' "Verification in progress" rows: the person's claims in review for a Home the list doesn't show (a claim
// makes a Home theirs only once it's approved), as web My Homes shows them. Each opens the claim's Waiting Room, where
// its checklist, documents and withdraw are. Parity twin of the claim rows in iOS `MyHomesListViewModel`.

/** "Ownership claim", or "Residency claim" for a renter's residency document. */
internal val OwnershipClaimDto.kindLabel: String
    get() = if (claimType == "resident") "Residency claim" else "Ownership claim"

/** A Pantopus reviewer asked for more and no document answered it yet (the web and iOS say the same). */
internal const val CLAIM_INFO_REQUEST_LABEL = "Pantopus asked for more"

/** What the claim waits on, as web My Homes says it. */
internal val OwnershipClaimDto.waitingLabel: String
    get() =
        when {
            openInfoRequest != null -> CLAIM_INFO_REQUEST_LABEL
            approval != null -> WaitingRoomApproval.summary(approval)
            hasEvidence == false -> "Document needed"
            hasEvidence == true -> "Under review"
            else -> "Check document status"
        }

/** Claims in review for a Home the list doesn't show already. A private setup is not a verification receipt (web). */
internal fun claimsInReview(
    claims: List<OwnershipClaimDto>,
    homes: List<MyHome>,
): List<OwnershipClaimDto> {
    val listed = homes.filter { it.accessKind != "private_setup" }.map { it.id }.toSet()
    return claims.filter { it.isInReview && it.homeId !in listed }
}

/**
 * My Homes' claims: the stored list shows at once; a read replaces it, or keeps it and says the check failed. A claim is
 * the person's own request, so its stored copy may show before the re-check (founder, 2026-10-27).
 */
internal class MyHomesClaims {
    var claims: List<OwnershipClaimDto> = emptyList()
        private set
    var error: String? = null
        private set

    fun showStored(repo: HomesRepository) {
        if (claims.isEmpty()) claims = repo.myClaimsCopy()?.claims.orEmpty()
    }

    suspend fun read(
        repo: HomesRepository,
        force: Boolean,
    ) {
        val stored = repo.myClaimsStored(force).data
        if (stored != null) claims = stored.claims
        error = if (stored == null) "Your claims could not be checked. Retry." else null
    }

    fun clearError() {
        error = null
    }

    fun clear() {
        claims = emptyList()
        error = null
    }
}

/** "Verification in progress" comes first, as on web My Homes. Its actions do nothing once [isCurrent] is false. */
internal fun claimsSection(
    claims: List<OwnershipClaimDto>,
    error: String?,
    isCurrent: () -> Boolean,
    open: (String) -> Unit,
    retry: () -> Unit,
): RowSection? {
    val rows =
        claims.map { claim -> claimRow(claim) { if (isCurrent()) open(claim.homeId) } } +
            listOfNotNull(error?.let { homeResidencyRecoveryRow("claims-retry", it, "Retry claims") { if (isCurrent()) retry() } })
    return if (rows.isEmpty()) null else RowSection(id = "claims", header = "Verification in progress", rows = rows)
}

/** The address claimed, the claim's kind and what it waits on. */
private fun claimRow(
    claim: OwnershipClaimDto,
    open: () -> Unit,
): RowModel =
    RowModel(
        id = "claim_${claim.id}",
        title = claim.home?.street ?: "Home",
        subtitle = listOfNotNull(claim.kindLabel, claim.home?.locality).joinToString(" · "),
        template = RowTemplate.AvatarKebab,
        leading = RowLeading.TypeIcon(PantopusIcon.Home, PantopusColors.homeBg, PantopusColors.home),
        trailing = RowTrailing.Chevron,
        onTap = open,
        body = "This claim does not grant household access.",
        chips = listOf(RowChip(claim.waitingLabel, PantopusIcon.Clock, RowChip.Tint.Status(StatusChipVariant.Warning))),
        wrapChips = true,
        footer =
            RowFooter(
                listOf(
                    RowFooterAction(
                        title = "Check claim status",
                        icon = PantopusIcon.ArrowRight,
                        variant = CompactButtonVariant.Primary,
                        testTag = "myHomes.claim_${claim.id}.continue",
                        onClick = open,
                    ),
                ),
            ),
    )
