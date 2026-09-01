@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.identity_center

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** Which of the four identity slots a card belongs to. */
enum class IdentityKind(
    val key: String,
    val label: String,
    val icon: PantopusIcon,
) {
    Local("local", "Local Profile", PantopusIcon.MapPin),
    Personal("personal", "Personal", PantopusIcon.User),
    PublicProfile("publicProfile", "Public profile", PantopusIcon.Star),
    Professional("professional", "Professional", PantopusIcon.Briefcase),
    ;

    val accent: Color
        get() =
            when (this) {
                Local -> PantopusColors.success
                Personal -> PantopusColors.primary600
                PublicProfile -> Color(0xFFDB2777)
                Professional -> PantopusColors.business
            }

    val accentBg: Color
        get() =
            when (this) {
                Local -> PantopusColors.successBg
                Personal -> PantopusColors.primary50
                PublicProfile -> Color(0xFFFCE7F3)
                Professional -> PantopusColors.businessBg
            }
}

sealed interface IdentityStatus {
    data object Active : IdentityStatus

    data class SetupNeeded(val cta: String) : IdentityStatus
}

@Immutable
data class IdentityChip(
    val label: String,
    val tone: Tone,
) {
    enum class Tone { Info, Success, Warning, Business, Neutral }
}

/** Identity card content rendered in the header + switcher. */
@Immutable
data class IdentityCardContent(
    val id: String,
    val kind: IdentityKind,
    val overline: String,
    val name: String,
    val handle: String? = null,
    val stats: String? = null,
    val summary: String? = null,
    val chip: IdentityChip? = null,
    val status: IdentityStatus = IdentityStatus.Active,
    val isOwner: Boolean = true,
)

/** One "Profile links" toggle. */
@Immutable
data class IdentityBridgeRow(
    val id: String,
    val label: String,
    val subtext: String? = null,
    val isOn: Boolean,
)

/** Privacy / Disclosure row. */
@Immutable
data class IdentityRowContent(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val subtext: String? = null,
    val trailing: String? = null,
)

@Immutable
data class IdentityCenterLoaded(
    val identities: List<IdentityCardContent>,
    val bridges: List<IdentityBridgeRow>,
    val privacyRows: List<IdentityRowContent>,
    val disclosureRows: List<IdentityRowContent>,
    val setupRemainingCount: Int = 0,
)

sealed interface IdentityCenterUiState {
    data object Loading : IdentityCenterUiState

    data class Loaded(val content: IdentityCenterLoaded) : IdentityCenterUiState

    data class Error(val message: String) : IdentityCenterUiState
}
