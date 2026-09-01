@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

/**
 * Recurrence cadence for a series. Design only specifies Weekly; Daily is
 * removed to match the design's single-option dropdown (recurring-frames.jsx
 * lines 92-103 — RepeatsSelect shows one value + chevron, no Daily option).
 */
enum class RecurrenceRepeat {
    Weekly,
}

/**
 * Per-occurrence status in the preview / after submit.
 * - Open: slot is available (calendar-check icon, green).
 * - Failed: conflict — time is already taken, user can pick another (alert-circle, warn).
 * - Unavailable: host is fully booked for that slot — cannot be resolved by changing
 *   time; row is dimmed 0.6 + strikethrough + calendar-x icon + "Full" badge
 *   (design Frame 3, recurring-frames.jsx lines 203-231).
 */
enum class OccurrenceStatus {
    Open,
    Failed,
    Unavailable,
}

/** One generated session in the series. */
data class RecurrenceOccurrence(
    val startUtc: String,
    val dateLabel: String,
    val timeLabel: String,
    val status: OccurrenceStatus = OccurrenceStatus.Open,
)

/** The recurrence pattern the user is configuring. */
data class RecurringConfig(
    val repeat: RecurrenceRepeat = RecurrenceRepeat.Weekly,
    /** 0 = Sunday … 6 = Saturday. */
    val weekdayIndex: Int = 2,
    /** Minutes from midnight (local). */
    val startMinutes: Int = 14 * 60,
    val count: Int = 6,
    val durationMin: Int = 30,
    /** Whether the Repeats dropdown row is expanded (showing a future sheet/picker). */
    val repeatsDropdownOpen: Boolean = false,
)

/** Loading the user's event type to attach the series to. */
sealed interface RecurringLoadState {
    data object Loading : RecurringLoadState

    data object Empty : RecurringLoadState

    data class Error(val message: String) : RecurringLoadState

    data class Loaded(
        val eventTypeId: String,
        val eventTypeName: String,
        val durationMin: Int,
    ) : RecurringLoadState
}

/** The submit lifecycle for the series. */
sealed interface RecurringSubmitState {
    data object Idle : RecurringSubmitState

    /**
     * Frame 4 — the user tapped "Review N bookings" from the configure step.
     * Shows the series-summary recap (recap header + RecapRow list + total price
     * row + per-row remove buttons) before the final Confirm CTA.
     * [reviewOccurrences] is the live-editable list; items can be removed here.
     */
    data class Reviewing(
        val reviewOccurrences: List<RecurrenceOccurrence>,
    ) : RecurringSubmitState

    data object Saving : RecurringSubmitState

    /** Booked [created] of the requested sessions; [failed] couldn't be booked. */
    data class Result(
        val created: Int,
        val requested: Int,
        val failed: List<RecurrenceOccurrence>,
    ) : RecurringSubmitState

    data class Error(val message: String) : RecurringSubmitState
}
