@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.you.me

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** Three identity bindings for the Me tab. */
enum class MeIdentity(val key: String, val label: String, val icon: PantopusIcon) {
    Personal("personal", "Personal", PantopusIcon.User),
    Home("home", "Home", PantopusIcon.Home),
    Business("business", "Business", PantopusIcon.ShoppingBag),
    ;

    /** Header gradient + action-grid accent color. */
    val accent: Color
        get() =
            when (this) {
                Personal -> PantopusColors.primary600
                Home -> PantopusColors.home
                Business -> PantopusColors.business
            }

    /** Soft tint for the pill background + scaffolding. */
    val accentBg: Color
        get() =
            when (this) {
                Personal -> PantopusColors.primary50
                Home -> PantopusColors.homeBg
                Business -> PantopusColors.businessBg
            }

    /**
     * 3-stop gradient for the header card (per T6.2b design — sky gets
     * `primary600 → primary500 → primary700`; home and business mirror
     * with opacity-shifted accents since the theme doesn't expose
     * 500 / 700 ramps for those identities).
     */
    val headerGradient: List<Color>
        get() =
            when (this) {
                Personal -> listOf(PantopusColors.primary600, PantopusColors.primary500, PantopusColors.primary700)
                Home -> listOf(PantopusColors.home, PantopusColors.home.copy(alpha = 0.86f), PantopusColors.home)
                Business -> listOf(PantopusColors.business, PantopusColors.business.copy(alpha = 0.86f), PantopusColors.business)
            }

    companion object {
        fun fromKey(key: String): MeIdentity = entries.firstOrNull { it.key == key } ?: Personal
    }
}

/** One cell in the stats row. */
@Immutable
data class MeStat(
    val id: String,
    val value: String,
    val label: String,
)

/** One tile in the 2×3 action grid. */
@Immutable
data class MeActionTile(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val badge: Int? = null,
    val routeKey: String,
    /**
     * Optional per-route arguments (e.g. `mapOf("homeId" to "abc-123")`).
     * Carries the primary home id on home-context tiles so the host can
     * construct BillsListScreen etc. without re-introspecting the VM.
     */
    val routeArgs: Map<String, String> = emptyMap(),
)

/** One row in a section group. */
@Immutable
data class MeSectionRow(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val value: String? = null,
    val routeKey: String,
    val routeArgs: Map<String, String> = emptyMap(),
    val testTag: String? = null,
)

/** A grouped section in the lower stack (Profile & Privacy · Activity · Help & Legal). */
@Immutable
data class MeSection(
    val id: String,
    val header: String,
    val rows: List<MeSectionRow>,
)

/** VM-prepared bundle for a single identity binding. */
@Immutable
data class MeIdentityContent(
    val identity: MeIdentity,
    val displayName: String,
    val initials: String,
    val handle: String,
    val locality: String?,
    /** Short bio / one-liner under the name. */
    val tagline: String?,
    val verified: Boolean,
    val stats: List<MeStat>,
    val actionTiles: List<MeActionTile>,
    val sections: List<MeSection>,
    val isUnbound: Boolean = false,
)
