@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A11.4 Mailbox map — content models. Inherits the A11 map+list hybrid
 * archetype (the screen reuses `MapListHybridDetent`) but swaps gigs
 * vocabulary for civic / postal venues. No backend — the view-model
 * projects [MailboxMapSampleData] into these shapes.
 */

/** A service offered at a mailbox spot — drives the detail-panel grid and rail-card chips. */
enum class MailboxServiceType(
    val label: String,
    val chipLabel: String,
    val icon: PantopusIcon,
) {
    Stamps("Stamps & postage", "Stamps", PantopusIcon.Stamp),
    Shipping("Package shipping", "Shipping", PantopusIcon.Package), // closest token to lucide "package-2"
    PoBoxes("PO boxes", "PO box", PantopusIcon.Inbox),
    Passport("Passport (appt)", "Passport", PantopusIcon.IdCard), // closest token to lucide "book-user"
    Pickup("Package pickup", "Pickup", PantopusIcon.Archive),
    Printing("Print & copy", "Print", PantopusIcon.Printer),
    Atm("ATM", "ATM", PantopusIcon.DollarSign),
    DropOff("Mail drop-off", "Drop-off", PantopusIcon.Mailbox),
}

/**
 * One day in the week-hour strip. [weekday] uses the `java.util.Calendar`
 * convention (1 = Sunday … 7 = Saturday) so the view can highlight the
 * current day; the list is ordered Monday-first to match the design.
 */
data class MailboxDayHours(
    val weekday: Int,
    val label: String,
    val hours: String,
)

/** One mailbox spot — one pin, one rail card, one detail panel. */
data class MailboxSpot(
    val id: String,
    val kind: MailboxSpotKind,
    val name: String,
    val address: String,
    val isOpen: Boolean,
    val hoursLabel: String,
    val statusLabel: String,
    val walkLabel: String,
    val lastPickupLabel: String?,
    val services: List<MailboxServiceType>,
    val weekHours: List<MailboxDayHours>,
    /** Pin position as a 0…1 fraction of the map canvas. */
    val mapX: Float,
    val mapY: Float,
)

/**
 * Render state for the Mailbox map. The screen has no designed empty
 * state — its complement is the [Selected] pin-detail state — so an
 * empty spot list renders an inline note inside the populated sheet.
 */
sealed interface MailboxMapUiState {
    data object Loading : MailboxMapUiState

    data class Populated(val spots: List<MailboxSpot>) : MailboxMapUiState

    data class Selected(
        val spot: MailboxSpot,
        val spots: List<MailboxSpot>,
    ) : MailboxMapUiState

    data class Error(val message: String) : MailboxMapUiState
}
