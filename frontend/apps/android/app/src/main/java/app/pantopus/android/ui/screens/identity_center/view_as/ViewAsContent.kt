@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.identity_center.view_as

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.components.ViewerAudience
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * B5.2 (A18.5) — render-only models for the "View as" identity preview.
 * Mirrors iOS `Features/IdentityCenter/ViewAs/ViewAsContent.swift`. The
 * screen renders YOUR profile as a chosen [ViewerAudience] would see it,
 * redacting whatever that audience can't. The visible/redacted matrix is
 * sample-data driven (see [ViewAsSampleData]) mirroring the A14.7 privacy
 * model — real per-field backend resolution is out of scope this pass.
 *
 * Slot vocabulary follows `docs/designs/A18/view-as-frames.jsx`.
 */

/** Banner / context-note tint. */
enum class ViewAsTone {
    /** Sky — "this is what they see". */
    Info,

    /** Amber — "most details are hidden". */
    Restricted,
}

/** How the avatar disc is tinted. `Masked` is the de-identified grey wash. */
enum class ViewAsAvatarTone {
    Personal,
    Home,
    Masked,
    ;

    /** Two-stop gradient behind the initials. All stops are tokens. */
    val gradient: List<Color>
        get() =
            when (this) {
                Personal -> listOf(PantopusColors.primary400, PantopusColors.primary700)
                Home -> listOf(PantopusColors.home, PantopusColors.success)
                Masked -> listOf(PantopusColors.appTextMuted, PantopusColors.appTextSecondary)
            }
}

/** Identity pill rendered under the name (design `idMap`). */
enum class ViewAsIdentityPill(val label: String) {
    Personal("Personal"),
    Home("Home"),
    ;

    val foreground: Color
        get() = if (this == Personal) PantopusColors.personal else PantopusColors.home

    val background: Color
        get() = if (this == Personal) PantopusColors.personalBg else PantopusColors.homeBg
}

/**
 * What the previewed viewer is allowed to see for one field. Mirrors the
 * A14.7 granularity ladder: a precise value, a coarsened value that still
 * reads, or a fully-withheld field rendered behind a `RedactionScrim`.
 */
sealed interface ViewAsFieldDisclosure {
    val shownValue: String?
    val isHidden: Boolean

    data class Visible(val value: String) : ViewAsFieldDisclosure {
        override val shownValue get() = value
        override val isHidden get() = false
    }

    data class Coarse(val value: String) : ViewAsFieldDisclosure {
        override val shownValue get() = value
        override val isHidden get() = false
    }

    data object Hidden : ViewAsFieldDisclosure {
        override val shownValue: String? get() = null
        override val isHidden get() = true
    }
}

/** One labelled row in the preview render. */
@Immutable
data class ViewAsField(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val disclosure: ViewAsFieldDisclosure,
)

/** A verification pill (`VBadge`). */
@Immutable
data class ViewAsBadge(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val isOn: Boolean,
)

/** "Viewing as {x}" banner stamped above the render, with a Live badge. */
@Immutable
data class ViewAsBanner(
    val icon: PantopusIcon,
    val viewerLabel: String,
    val subtitle: String,
    val tone: ViewAsTone,
)

/** The shared-context (info) / restricted (amber) strip below the fields. */
@Immutable
data class ViewAsContextNote(
    val icon: PantopusIcon,
    val text: String,
    val tone: ViewAsTone,
)

/** Avatar + name + handle + identity pill inside the render. */
@Immutable
data class ViewAsHead(
    val name: String,
    val handle: String?,
    val initials: String,
    val avatarTone: ViewAsAvatarTone,
    val identity: ViewAsIdentityPill,
    val verified: Boolean,
)

/**
 * The fully-resolved profile render for one previewed viewer. Switching
 * the picker swaps the whole [ViewAsRender], re-resolving banner tone,
 * badges and field redaction in one shot.
 */
@Immutable
data class ViewAsRender(
    val viewer: ViewerAudience,
    val banner: ViewAsBanner,
    val head: ViewAsHead,
    val badges: List<ViewAsBadge>,
    val fields: List<ViewAsField>,
    val note: ViewAsContextNote,
    /** Privacy-footer copy preceding the bold "Manage privacy" link. */
    val footerText: String,
)

/**
 * Top-level render state. A loading (shimmer) frame and the resolved
 * preview; there's no empty/error path because the data is local sample
 * content, not a fetch.
 */
sealed interface ViewAsUiState {
    data object Loading : ViewAsUiState

    data class Loaded(
        val selected: ViewerAudience,
        val render: ViewAsRender,
    ) : ViewAsUiState
}
