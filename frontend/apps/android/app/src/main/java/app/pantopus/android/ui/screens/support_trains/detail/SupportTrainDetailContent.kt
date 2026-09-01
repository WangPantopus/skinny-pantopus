@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.support_trains.detail

import app.pantopus.android.data.api.models.support_trains.SupportTrainContributionMode
import app.pantopus.android.ui.components.SlotCalendarDay

/**
 * A10.9 — Render payloads for the participant-facing Support Train
 * detail screen. Pure value types so the view-model can be fed
 * deterministic stub data ([SupportTrainDetailSampleData]) and every
 * state snapshots reproducibly. Colour is expressed as a semantic
 * [SupportTrainKind]; the screen maps it onto `PantopusColors` so the
 * model stays free of UI types.
 *
 * Two designed variants share this model:
 *   - `populated`     12 / 21 slots covered · 9 open · `signUp` dock.
 *   - `fullyCovered`  21 / 21 covered · celebration banner at top ·
 *                     split `Send a card` / `Join as backup` dock.
 */

/**
 * Per-archetype palette. Drives the type-dates card icon tile + the
 * recipient avatar gradient. Mirrors the iOS `SupportTrainKind` so
 * the list-feed projection lands the same accent on both platforms.
 */
enum class SupportTrainKind { Meals, Rides, Childcare, Petcare, Errands, Visits, Generic }

/** Identity tag for the recipient card (drives the chip + verified disc + avatar gradient). */
enum class RecipientIdentityTag { Home, Personal, Business }

/** Semantic palette swatch for contributor / author discs. */
enum class ContributorTone { Warning, Primary, Business, Success, Error, Personal }

/** Sticky bottom-dock variant. */
sealed interface SupportTrainDock {
    data class SignUp(val label: String) : SupportTrainDock

    data object SendCardAndBackup : SupportTrainDock
}

/** Slot-row presentation state. */
enum class SlotRowState { Open, Covered }

/** A bubble inside the contributor strip (4 avatars + +N overflow). */
data class ContributorBubble(
    val id: String,
    val initials: String,
    val tone: ContributorTone,
)

/** Helper attribution on a covered slot row. */
data class SlotRowAuthor(
    val initials: String,
    val displayName: String,
    val tone: ContributorTone,
)

/** "For" overline + recipient card payload. */
data class RecipientCardContent(
    val initials: String,
    val householdName: String,
    val identityTag: RecipientIdentityTag,
    val verified: Boolean,
    val address: String,
    val proximity: String?,
    val quote: String,
    val quoteAttribution: String?,
)

/** "The train" overline + type-dates card payload. */
data class TypeDatesCardContent(
    val kind: SupportTrainKind,
    val title: String,
    val dateRange: String,
    val daysLeft: Int,
    val slotsFilled: Int,
    val slotsTotal: Int,
    val contributors: List<ContributorBubble>,
    val extraCount: Int,
) {
    val isFullyCovered: Boolean get() = slotsTotal > 0 && slotsFilled >= slotsTotal

    val percentCovered: Int
        get() = if (slotsTotal <= 0) 0 else Math.round(slotsFilled.toFloat() * 100f / slotsTotal.toFloat())
}

/** One slot row, used by both open + covered + mine variants. */
data class SlotRowContent(
    val id: String,
    val dayLabel: String,
    val dateLabel: String,
    val state: SlotRowState,
    val author: SlotRowAuthor? = null,
    val title: String,
    val subtitle: String? = null,
    val mine: Boolean = false,
    /** Backing slot id for `Open` rows — the reserve sheet posts with it. */
    val slotId: String? = null,
    /** Backing reservation id for `mine` rows — leave / mark delivered. */
    val reservationId: String? = null,
    /** `reserved` / `delivered` / `confirmed` for `mine` rows. */
    val reservationStatus: String? = null,
) {
    /**
     * The helper can only leave / mark delivered while the reservation
     * is still `reserved` (`backend/routes/supportTrains.js:3013` and
     * l.3180 both 409 otherwise).
     */
    val canLeaveSlot: Boolean
        get() = mine && reservationId != null && (reservationStatus ?: "reserved") == "reserved"

    val canMarkDelivered: Boolean
        get() = canLeaveSlot
}

/** One pickable open slot inside the reserve sheet. */
data class ReserveSlotOption(
    val id: String,
    /** "Tuesday, June 3" */
    val dateLabel: String,
    /** "Dinner" / "Groceries" … */
    val slotLabel: String,
    /** Time-window caption, when the slot carries one. */
    val windowLabel: String?,
)

/**
 * Everything the reserve sheet needs that isn't per-slot: the enabled
 * contribution lanes plus the recipient's reminders.
 */
data class ReserveSheetContext(
    val enabledModes: List<SupportTrainContributionMode>,
    val restrictionChips: List<String>,
    val contactlessPreferred: Boolean,
)

/**
 * The viewer's relationship to the train, straight off `viewer_level` +
 * `viewer_support_train_role` (`backend/routes/supportTrains.js:3693`).
 * Every affordance is gated on this so no one sees a button the server
 * will reject.
 */
enum class SupportTrainViewerRole {
    PRIMARY_ORGANIZER,
    CO_ORGANIZER,
    RECIPIENT,
    HELPER,
    VIEWER,
    ;

    val isOrganizer: Boolean
        get() = this == PRIMARY_ORGANIZER || this == CO_ORGANIZER
}

/** Organizer footer pinned at the bottom of the body. */
data class HostedByFooter(
    val organizerInitials: String,
    val organizerDisplayName: String,
    val neighborHint: String?,
)

/**
 * One stack of slot rows ("Open slots near you", "Already on the
 * train", "Your commitment", "Next up"). Optional action label
 * surfaces as a trailing `See all N` button.
 */
data class SlotSection(
    val id: String,
    val overline: String,
    val actionLabel: String? = null,
    val rows: List<SlotRowContent>,
)

/** Celebration banner shown above the body in the fully-covered variant. */
data class CelebrationBanner(
    val title: String,
    val body: String,
)

/** Full render payload for the participant-facing Support Train detail. */
data class SupportTrainDetailContent(
    val trainId: String,
    val recipient: RecipientCardContent,
    val typeDates: TypeDatesCardContent,
    /** 28 days in row-major order (week 0 Mon…Sun … week 3 Mon…Sun). */
    val calendarDays: List<SlotCalendarDay>,
    val sections: List<SlotSection>,
    val hostedBy: HostedByFooter,
    val dock: SupportTrainDock,
    val celebrationBanner: CelebrationBanner? = null,
    /** Open slots the viewer can still claim, in date order. */
    val reserveOptions: List<ReserveSlotOption> = emptyList(),
    /** Contribution lanes + recipient reminders for the reserve sheet. */
    val reserveContext: ReserveSheetContext =
        ReserveSheetContext(
            enabledModes = SupportTrainContributionMode.entries.toList(),
            restrictionChips = emptyList(),
            contactlessPreferred = false,
        ),
    /** Gate for every action affordance on this screen. */
    val viewerRole: SupportTrainViewerRole = SupportTrainViewerRole.VIEWER,
    /**
     * Exact address — present only when the server chose to send it
     * (organizer / recipient / a helper the organizer granted). Rendered
     * verbatim, never persisted.
     */
    val exactAddress: String? = null,
    val deliveryInstructions: String? = null,
) {
    val isFullyCovered: Boolean get() = typeDates.isFullyCovered
}

/**
 * Mirrors the iOS [SupportTrainDetailViewModel.State] enum. Four-state
 * contract: loading / loaded / error. Fully-covered is **not** empty
 * — it's a celebrated loaded variant — so the state machine has no
 * `Empty` case.
 */
sealed interface SupportTrainDetailUiState {
    data object Loading : SupportTrainDetailUiState

    data class Loaded(val content: SupportTrainDetailContent) : SupportTrainDetailUiState

    data class Error(val message: String) : SupportTrainDetailUiState
}
