@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar

/** The Upcoming / Past segment on D11. */
enum class MyBookingsTab {
    Upcoming,
    Past,
}

/** Status-pill kind for a booking row (mirrors the A09 status styling). */
enum class BookingPillKind {
    Confirmed,
    Pending,
    Past,
    Cancelled,
    Balance,
    Approve,
}

/**
 * Optional footer affordance on a row (design frames: Past = "Book again",
 * Action-needed = "Pay {balance}"). The lean /my-bookings payload doesn't carry
 * the price/discovery data these need yet, so the VM leaves this null today —
 * the renderer supports it for when the backend joins those fields.
 */
sealed interface BookingRowFooter {
    /** Past-row "Book again" link (rotate-ccw + accent label). */
    data object BookAgain : BookingRowFooter

    /** Action-needed "Pay {balance}" affordance with a "{balance} due at confirm" caption. */
    data class Pay(val balance: String) : BookingRowFooter
}

/** One booking the signed-in user made, projected for the list row. */
data class MyBookingRow(
    val id: String,
    val title: String,
    val subtitle: String,
    val pillar: SchedulingPillar,
    val pill: BookingPillKind,
    val initials: String = "·",
    val dimmed: Boolean = false,
    val manageable: Boolean = true,
    val footer: BookingRowFooter? = null,
)

/** A titled group of rows ("This week", "Needs attention", …). */
data class MyBookingGroup(
    val overline: String,
    val rows: List<MyBookingRow>,
    val attention: Boolean = false,
)

/** The four-state contract for D11. */
sealed interface MyBookingsUiState {
    data object Loading : MyBookingsUiState

    data object Empty : MyBookingsUiState

    data class Loaded(
        val tab: MyBookingsTab,
        val groups: List<MyBookingGroup>,
    ) : MyBookingsUiState

    data class Error(val message: String) : MyBookingsUiState
}
