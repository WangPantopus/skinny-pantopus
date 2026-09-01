@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.hub

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.scheduling.BookingSummaryResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusIcon

/** Phase state for the Scheduling Hub content (the pill row is rendered above this regardless of phase). */
@Immutable
sealed interface SchedulingHubUiState {
    data object Loading : SchedulingHubUiState

    /** First-run: no event types yet → setup CTA + dashed destination preview. */
    data class Empty(
        val pillar: SchedulingPillar,
        val canEdit: Boolean,
    ) : SchedulingHubUiState

    data class Loaded(
        val pillar: SchedulingPillar,
        val canEdit: Boolean,
        val isPaused: Boolean,
        val handle: String,
        val shareUrl: String,
        val displayName: String,
        val displayRole: String,
        val isComposed: Boolean,
        val summary: HubSummaryUi?,
        val summaryFailed: Boolean,
        /** True while a summary-card Retry refetch is in flight — the card renders its own shimmer. */
        val summaryRetrying: Boolean = false,
        val agenda: List<HubAgendaSection>,
        val manageRows: List<HubManageItem>,
    ) : SchedulingHubUiState

    data class Error(
        val message: String,
    ) : SchedulingHubUiState
}

/** A5 Summary Card view data (also rendered embedded at the top of the hub). */
@Immutable
data class HubSummaryUi(
    val bookings: Int,
    val deltaPct: Int?,
    val upcoming: Int,
    val noShows: Int,
    val sparkCounts: List<Int>,
    val breakdown: List<HubBreakdownChip>,
) {
    val isEmpty: Boolean get() = bookings == 0 && upcoming == 0 && breakdown.isEmpty()

    companion object {
        fun from(
            summary: BookingSummaryResponse,
            eventTypes: List<EventTypeDto>,
        ): HubSummaryUi {
            val names = eventTypes.associate { it.id to it.name }
            return HubSummaryUi(
                bookings = summary.bookingsThisMonth,
                deltaPct = summary.deltaPct.takeIf { summary.bookingsLastMonth > 0 || it != 0 },
                upcoming = summary.upcomingCount,
                noShows = summary.noShowCount,
                sparkCounts = summary.sparkline.map { it.count },
                breakdown =
                    summary.byEventType.take(3).map {
                        HubBreakdownChip(label = names[it.eventTypeId] ?: "Other", count = it.count)
                    },
            )
        }
    }
}

@Immutable
data class HubBreakdownChip(
    val label: String,
    val count: Int,
)

@Immutable
data class HubAgendaSection(
    val key: String,
    val header: String,
    val sub: String,
    val rows: List<HubBookingRowUi>,
)

@Immutable
data class HubBookingRowUi(
    val id: String,
    val kind: HubBookingKind,
    val title: String,
    val timeLabel: String,
    val metaLabel: String,
    val bookerName: String,
    val bookerInitials: String,
    val bookerTone: HubAvatarTone,
    val status: String,
    /**
     * Host first name for cross-owner attribution on composed hubs (which
     * member a booking belongs to) — rendered as an 11dp user glyph + name
     * after the duration (scheduling-hub-frames.jsx:440-444). Null on
     * personal hubs or when the host can't be resolved.
     */
    val hostName: String? = null,
)

@Immutable
data class HubManageItem(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val value: String?,
    val alert: Boolean = false,
    val route: String,
)

/** Semantic meeting-kind colours for the agenda type tile (NOT recolored by pillar). */
enum class HubBookingKind { Video, Phone, InPerson, Consult }

/** Booker avatar tone cycle for the agenda rows. */
enum class HubAvatarTone { Blue, Green, Amber, Rose, Violet }
