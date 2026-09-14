@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import app.pantopus.android.data.api.models.homes.HomeRelationshipAction
import app.pantopus.android.data.api.models.homes.HomeRelationshipReview
import app.pantopus.android.data.homes.PendingHomeRelationship

data class HomeRelationshipUiState(
    val actorId: String,
    val requestedClaim: String?,
    val action: HomeRelationshipAction,
    val visible: Boolean = false,
    val active: Boolean = false,
    val busy: Boolean = false,
    val retired: Boolean = false,
    val review: HomeRelationshipReview? = null,
    val pending: PendingHomeRelationship? = null,
    val note: String = "",
    val reviewed: Boolean = false,
    val error: String? = null,
    val canDismiss: Boolean = false,
    val empty: Boolean = false,
) {
    val interactive get() = active && visible && !retired
    val canEdit get() = active && visible && !busy && !retired && pending == null && review?.claim?.canDecide(actorId) == true
    val canSubmit get() = canEdit && reviewed && note.trim().length <= 1000
    val recoveringAnotherClaim get() = pending != null && requestedClaim != null && pending.claimId != requestedClaim
}
