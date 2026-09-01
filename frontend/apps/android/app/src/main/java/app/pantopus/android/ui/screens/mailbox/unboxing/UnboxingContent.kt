@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.unboxing

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.components.OcrFact
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.14 — Unboxing scan-capture render models. Mirrors the iOS
 * `UnboxingContent.swift` shape so cross-platform parity holds. A
 * scan-first surface: you point the camera at a just-delivered item (and
 * its papers), Pantopus reads + classifies it, suggests a drawer, and you
 * Confirm or re-route.
 *
 * The view-model loads the real `MailPackage` row for the routed mail id
 * and projects it via `UnboxingProjection` — there is no OCR /
 * classification route, so the facts list carries only what the package row
 * knows and nothing is invented. [UnboxingSampleData] survives purely as the
 * Paparazzi / preview seam. The `CameraScanner` + `OcrFactsList` primitives
 * (B1.2) render the viewfinder, filmstrip, and facts grid; this screen owns
 * the data.
 */

// MARK: - Phase / state

/** Which frame the screen is showing. */
enum class UnboxingPhase { Capture, Filed }

/**
 * State machine for the Unboxing screen. `Capture` and `Filed` carry the
 * same [UnboxingContent]; only the rendering differs (live capture chrome
 * vs filed summary chrome). `Loading` / `Error` cover the package fetch,
 * and `Unavailable` is the honest frame for the case where the screen was
 * opened without an originating package — nothing can be persisted, so
 * nothing is faked.
 */
sealed interface UnboxingUiState {
    data object Loading : UnboxingUiState

    data class Capture(val content: UnboxingContent) : UnboxingUiState

    data class Filed(val content: UnboxingContent) : UnboxingUiState

    data class Error(val message: String) : UnboxingUiState

    data object Unavailable : UnboxingUiState
}

/** The projected content when the state carries one, else null. */
val UnboxingUiState.contentOrNull: UnboxingContent?
    get() =
        when (this) {
            is UnboxingUiState.Capture -> content
            is UnboxingUiState.Filed -> content
            else -> null
        }

// MARK: - Drawer suggestion

/**
 * The identity-pillar tint behind a drawer chip. Maps to the existing
 * identity-pillar tokens so the suggested / re-route drawers read with
 * their canonical Me / Home / Biz colors.
 */
enum class UnboxingDrawerTint {
    Home,
    Personal,
    Business,
    ;

    val swatch: Color
        get() =
            when (this) {
                Home -> PantopusColors.home
                Personal -> PantopusColors.personal
                Business -> PantopusColors.business
            }

    val swatchBg: Color
        get() =
            when (this) {
                Home -> PantopusColors.homeBg
                Personal -> PantopusColors.personalBg
                Business -> PantopusColors.businessBg
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Home -> PantopusIcon.Home
                Personal -> PantopusIcon.User
                Business -> PantopusIcon.Briefcase
            }
}

/**
 * A candidate filing destination: a drawer (`Home`) and a folder
 * (`Warranties & Receipts`). The suggested drawer carries a [confidence]
 * percent; re-route alternatives leave it `null`.
 */
@Immutable
data class UnboxingDrawer(
    val id: String,
    val drawer: String,
    val folder: String,
    val tint: UnboxingDrawerTint,
    /** `96` for the suggested drawer; `null` for the re-route alternatives. */
    val confidence: Int? = null,
)

// MARK: - Captured shot

/**
 * One captured thumbnail in the filmstrip. The design renders these as
 * dark striped placeholders (never a hand-drawn object), so the stub
 * carries no bitmap — `CameraScanner`'s `CameraScannerShot` placeholder
 * renders the diagonal stripe fill, which is also what snapshots use.
 */
@Immutable
data class UnboxingShot(
    val id: String,
    /** Mono corner tag — `UNIT` / `BOX` / `RECEIPT` / `LABEL`. */
    val tag: String,
    /** Caption under the thumbnail — "The machine" / "Box + barcode" / … */
    val label: String,
    /** The hero shot — gets the accent border + star badge. */
    val isMain: Boolean = false,
)

// MARK: - Content payload

/** Single content payload both phases project off. */
@Immutable
data class UnboxingContent(
    val category: String,
    val timeLabel: String,
    val productTitle: String,
    val productSubtitle: String,
    val shots: List<UnboxingShot>,
    val suggestion: UnboxingDrawer,
    val alternates: List<UnboxingDrawer>,
    val facts: List<OcrFact>,
    /** Filed-banner title — "Home › Warranties". */
    val filedTo: String,
    /** Filed-banner subtitle — "Confirmed by you · Just now". */
    val filedSubtitle: String,
    /** Photo-summary count line — "4 photos saved". */
    val photosSavedLabel: String,
    val classifyElf: AIElfStripContent,
    val filedElf: AIElfStripContent,
)
