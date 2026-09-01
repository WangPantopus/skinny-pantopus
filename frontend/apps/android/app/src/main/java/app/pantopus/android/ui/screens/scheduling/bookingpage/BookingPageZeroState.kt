@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * H16 — the shared owner first-run empty state for scheduling surfaces. One
 * shell (the design-system [EmptyState]: 72dp identity-tinted circle + headline
 * + subcopy + a single primary CTA) reused across the booking-link, event-type,
 * bookings-inbox, and availability day-one screens so no surface ships a blank
 * rectangle. The tinted circle + icon take the owning context's pillar hue.
 */
enum class SchedulingZeroKind {
    /** The booking-link / public page itself isn't set up yet. */
    BookingLink,
    EventTypes,
    BookingsInbox,
    AvailabilityNotSet,
}

private data class ZeroCopy(val icon: PantopusIcon, val headline: String, val subcopy: String, val cta: String)

private fun copyFor(kind: SchedulingZeroKind): ZeroCopy =
    when (kind) {
        SchedulingZeroKind.BookingLink ->
            ZeroCopy(
                PantopusIcon.Link,
                "Set up your booking link",
                "Pick a handle and turn on a service, then people can book you with one link.",
                "Set up booking link",
            )
        SchedulingZeroKind.EventTypes ->
            ZeroCopy(
                PantopusIcon.CalendarPlus,
                "Create your first event type",
                "Event types are the things people can book — a 30-minute intro, a home visit. Add one to start taking bookings.",
                "Create event type",
            )
        SchedulingZeroKind.BookingsInbox ->
            ZeroCopy(
                PantopusIcon.Inbox,
                "No bookings yet",
                "When someone books a time, it shows up here. Share your link to get your first one.",
                "Share booking link",
            )
        SchedulingZeroKind.AvailabilityNotSet ->
            ZeroCopy(
                PantopusIcon.Clock,
                "Set your availability",
                "Your personal availability is the source of truth for every booking. Tell us when you're free.",
                "Set availability",
            )
    }

private fun tintFor(pillar: SchedulingPillar): Pair<Color, Color> =
    when (pillar) {
        SchedulingPillar.Personal -> PantopusColors.personalBg to PantopusColors.primary600
        SchedulingPillar.Home -> PantopusColors.homeBg to PantopusColors.home
        SchedulingPillar.Business -> PantopusColors.businessBg to PantopusColors.business
    }

@Composable
fun BookingPageZeroState(
    kind: SchedulingZeroKind,
    onCta: () -> Unit,
    modifier: Modifier = Modifier,
    pillar: SchedulingPillar = SchedulingPillar.Personal,
) {
    val copy = copyFor(kind)
    val (tint, accent) = tintFor(pillar)
    EmptyState(
        icon = copy.icon,
        headline = copy.headline,
        subcopy = copy.subcopy,
        modifier = modifier,
        ctaTitle = copy.cta,
        onCta = onCta,
        tint = tint,
        accent = accent,
    )
}
