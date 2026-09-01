@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_day

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A13.16 — My Mail Day render models. Mirrors the iOS
 * `MailDayContent.swift` shape so cross-platform parity holds.
 *
 * `MailThumb` (the bespoke faux-photo of a mail piece) lives in
 * `components/UnreviewedItem.kt` and is rendered at 56dp (Unreviewed
 * card) and 36dp (Reviewed row).
 */

// MARK: - State

sealed interface MailDayUiState {
    data object Loading : MailDayUiState

    data class Populated(
        val content: MailDayContent,
    ) : MailDayUiState

    data class Empty(
        val content: MailDayContent,
    ) : MailDayUiState

    data class Error(
        val message: String,
    ) : MailDayUiState
}

/** Composed content shared by both frames. */
@Immutable
data class MailDayContent(
    val dateLabel: String,
    val streakDays: Int,
    val lastScanLabel: String,
    val unreviewed: List<UnreviewedMailDayItem>,
    val reviewed: List<ReviewedMailDayItem>,
    val yesterdayRecap: YesterdayRecap?,
    val setupNudges: List<MailDaySetupNudge>,
)

@Immutable
data class UnreviewedMailDayItem(
    val id: String,
    val kind: MailDayKind,
    val label: String,
    val sender: String,
    val suggestedName: String,
    val suggestedAvatar: MailDaySuggestedAvatar,
    val confidencePercent: Int,
    val secondaryLabel: String,
)

@Immutable
data class ReviewedMailDayItem(
    val id: String,
    val kind: MailDayKind,
    val label: String,
    val action: ReviewedMailAction,
    val routedTo: String?,
    val routedTint: MailDayRoutedTint?,
    val whenLabel: String,
    val undoCountdown: Int?,
)

enum class ReviewedMailAction { Routed, Junked, Returned }

enum class MailDayRoutedTint(
    val background: Color,
) {
    PersonPrimary(PantopusColors.primary100),
    HouseholdHome(PantopusColors.homeBg),
}

enum class MailDaySuggestedAvatar(
    val background: Color,
) {
    PersonalSky(PantopusColors.primary700),
    HouseholdGreen(PantopusColors.home),
}

@Immutable
data class YesterdayRecap(
    val dateLabel: String,
    val pieces: Int,
    val closedAtLabel: String,
    val segments: List<Segment>,
) {
    @Immutable
    data class Segment(
        val id: String,
        val percent: Float,
        val label: String,
        val tint: SegmentTint,
    )

    enum class SegmentTint(
        val color: Color,
    ) {
        PersonPrimary(PantopusColors.primary600),
        Household(PantopusColors.home),
        Junked(PantopusColors.error),
        Returned(PantopusColors.appTextMuted),
    }
}

@Immutable
data class MailDaySetupNudge(
    val id: String,
    val icon: PantopusIcon,
    val tint: NudgeTint,
    val title: String,
    val subtitle: String,
) {
    enum class NudgeTint(
        val foreground: Color,
        val background: Color,
    ) {
        Primary(PantopusColors.primary600, PantopusColors.primary50),
        Home(PantopusColors.home, PantopusColors.homeBg),
    }
}

/**
 * Faux-photo treatment for a piece of mail. Distinct from the 19-case
 * backend `MailItemCategory` — those drive list-row tile glyphs, these
 * drive the textured paper preview.
 */
enum class MailDayKind { Envelope, Magazine, Postcard, Bill, Package, Flyer }
