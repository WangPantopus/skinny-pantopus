@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.handshake

import androidx.compose.runtime.Immutable

/**
 * Where the wizard currently is. The shell maps this to chrome.
 */
sealed interface HandshakeStep {
    data object HandleEntry : HandshakeStep

    data object TierSelection : HandshakeStep

    data object Submitting : HandshakeStep

    data class OpensCheckout(val subscribeUrl: String) : HandshakeStep

    data object CompletedFree : HandshakeStep

    data object AlreadyMember : HandshakeStep
}

@Immutable
data class HandshakeHandleState(
    val value: String = "",
    val locked: Boolean = false,
    val matchesUsername: Boolean = false,
    val acknowledgedUsingUsername: Boolean = false,
    val error: String? = null,
) {
    val isValid: Boolean
        get() {
            val trimmed = value.trim()
            if (trimmed.length !in 3..40) return false
            return trimmed.matches(Regex("^[A-Za-z0-9_.\\-]+$"))
        }
}

@Immutable
data class HandshakePersonaPreview(
    val id: String,
    val handle: String,
    val displayName: String,
    val avatarUrl: String?,
    val bio: String?,
    val audienceLabel: String,
    val followerCount: Int,
)

@Immutable
data class HandshakeTierOption(
    val id: String,
    val rank: Int,
    val name: String,
    val description: String?,
    val priceCents: Int,
    val currency: String,
) {
    val isFree: Boolean get() = rank == 1 || priceCents == 0

    val priceLabel: String
        get() {
            if (isFree) return "Free"
            val dollars = priceCents / 100
            val cents = priceCents % 100
            val symbol = if (currency.equals("usd", ignoreCase = true)) "$" else ""
            return if (cents == 0) {
                "$symbol$dollars/mo"
            } else {
                "$symbol$dollars.%02d/mo".format(cents)
            }
        }
}

@Immutable
data class HandshakeReadyContent(
    val persona: HandshakePersonaPreview,
    val tierOptions: List<HandshakeTierOption>,
    val step: HandshakeStep,
    val handle: HandshakeHandleState,
    val selectedTierRank: Int,
) {
    val selectedTier: HandshakeTierOption?
        get() = tierOptions.firstOrNull { it.rank == selectedTierRank }
}

sealed interface HandshakeUiState {
    data object Loading : HandshakeUiState

    data class Ready(val content: HandshakeReadyContent) : HandshakeUiState

    data class Error(val message: String) : HandshakeUiState
}
