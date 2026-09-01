@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** The four scope pills above the inbox. `All` unions every resolved owner. */
enum class ScopeId { All, Personal, Home, Business }

/** A render-ready scope pill (resolved owner + identity tint). */
data class ScopeChip(
    val id: ScopeId,
    val label: String,
    val accent: Color,
    val showDot: Boolean,
)

/** A resolved owner context with its pillar + display label, built at load time. */
data class OwnerContext(
    val id: ScopeId,
    val owner: SchedulingOwner,
    val pillar: SchedulingPillar,
    val label: String,
)

/** The status segment — maps 1:1 to the backend `?status=` filter. */
enum class BookingSegment(val label: String, val query: String) {
    Upcoming("Upcoming", "upcoming"),
    Pending("Pending", "pending"),
    Past("Past", "past"),
    Cancelled("Cancelled", "cancelled"),
}

/** One booking row in the inbox list. */
data class BookingRowUi(
    val id: String,
    val pillar: SchedulingPillar,
    val ownerLabel: String,
    val initials: String,
    val inviteeName: String,
    val eventName: String,
    val whenLabel: String,
    val pillStatus: SchedulingPillStatus,
    val showOwnerGlyph: Boolean,
    /** Non-null when a host member is assigned; the value is the assignee display label
     *  (e.g. "Priya", "Devon"). Null means no host member is assigned and the chip
     *  is hidden (the design only shows AssignedChip when there is an assignee). */
    val assigneeName: String?,
    val unread: Boolean,
    val quickApprove: Boolean,
)

/** A grouped section ("Today", "Needs your approval", …). */
data class BookingSection(
    val id: String,
    val header: String,
    val dot: Boolean,
    val rows: List<BookingRowUi>,
)

/** Per-segment empty payload. */
data class InboxEmpty(
    val icon: PantopusIcon,
    val headline: String,
    val subcopy: String,
    val ctaTitle: String? = null,
)

/** Inbox lifecycle state. */
sealed interface BookingsInboxUiState {
    data object Loading : BookingsInboxUiState

    data class Content(
        val sections: List<BookingSection>,
        /** True when the viewer is a team member seeing only bookings assigned to them.
         *  Drives the MemberBanner (design Frame 9). Stays false until the backend
         *  exposes a `is_member` field on the bookings list response. */
        val isMember: Boolean = false,
        /** True when the event type uses auto-confirm and the Pending tab should be
         *  hidden (design Frame 8). Stays false until the event-type auto-confirm flag
         *  is surfaced in the bookings list response. */
        val hidePending: Boolean = false,
    ) : BookingsInboxUiState

    data class Empty(val empty: InboxEmpty) : BookingsInboxUiState

    data class Error(val message: String) : BookingsInboxUiState
}

/** Empty copy per segment, mirroring the design's empty frames. */
fun emptyFor(segment: BookingSegment): InboxEmpty =
    when (segment) {
        BookingSegment.Upcoming ->
            InboxEmpty(
                icon = PantopusIcon.CalendarClock,
                headline = "No bookings yet",
                subcopy = "When people book time with you, they show up here.",
                ctaTitle = "Share your booking link",
            )
        BookingSegment.Pending ->
            InboxEmpty(
                icon = PantopusIcon.CheckCircle,
                headline = "All caught up",
                subcopy = "No requests are waiting on your approval.",
            )
        BookingSegment.Past ->
            InboxEmpty(
                icon = PantopusIcon.History,
                headline = "Nothing in your history yet",
                subcopy = "Completed and past bookings collect here once you've met with someone.",
            )
        BookingSegment.Cancelled ->
            InboxEmpty(
                icon = PantopusIcon.CircleSlash,
                headline = "No cancellations",
                subcopy = "Cancelled and declined bookings will show up here.",
            )
    }

/** Accent for the All scope (sky / primary600). */
val ALL_SCOPE_ACCENT: Color = PantopusColors.primary600
