@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.token_accept

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon

enum class InviteType(val key: String) {
    HomeInvite("home_invite"),
    BusinessSeat("business_seat"),
    GuestPass("guest_pass"),
}

@Immutable
data class IdentityChipContent(
    val label: String,
    val handle: String? = null,
)

@Immutable
data class SafetyBand(
    val icon: PantopusIcon,
    val text: String,
)

@Immutable
data class TokenAcceptOffer(
    val invitationId: String?,
    val inviteType: InviteType,
    val title: String,
    val sender: String,
    val roleOffered: String,
    val venue: String,
    val benefits: List<String>,
    val expiry: String?,
    val safetyBand: SafetyBand,
    val primaryCtaLabel: String,
    val secondaryCtaLabel: String,
    val identityChip: IdentityChipContent,
)

sealed interface TokenAcceptUiState {
    data object Loading : TokenAcceptUiState

    data class Ready(val offer: TokenAcceptOffer) : TokenAcceptUiState

    data class Accepting(val offer: TokenAcceptOffer) : TokenAcceptUiState

    data class Accepted(val offer: TokenAcceptOffer, val message: String) : TokenAcceptUiState

    data object Declined : TokenAcceptUiState

    data class Expired(val message: String) : TokenAcceptUiState

    data class Error(val message: String) : TokenAcceptUiState
}
