@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.manage

import app.pantopus.android.data.api.models.support_trains.SupportTrainOrganizerRowDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainSlotDto
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * S1 — presentation rows for the Manage-train organizer surfaces:
 * helper roster, dates, co-organizers, plus the slot-editor and
 * destructive-confirm payloads. Mirrors the iOS
 * `ManageTrainOrganizerActions.swift` models one-for-one.
 */

/** One helper reservation on the Manage roster. */
data class ManageHelperRow(
    val id: String,
    val name: String,
    val slotLabel: String,
    val contribution: String,
    val status: String,
    val isGuest: Boolean,
    val exactAddressShared: Boolean,
) {
    /** Only `reserved` signups can be pulled off a slot (`supportTrains.js:3013`). */
    val canRemove: Boolean get() = status == "reserved"

    /** `POST …/confirm` requires `delivered` (`supportTrains.js:3255`). */
    val canConfirm: Boolean get() = status == "delivered"

    /** The reveal route 409s on canceled reservations (`supportTrains.js:2800`). */
    val canShareAddress: Boolean get() = status != "canceled" && !exactAddressShared
}

/** One editable date on the Manage screen. */
data class ManageSlotRow(
    val id: String,
    val dateLabel: String,
    val metaLabel: String,
    val badge: String,
    val slotDate: String,
    val slotLabel: String,
    val supportMode: String,
    val startTime: String?,
    val endTime: String?,
    val filledCount: Int,
    val status: String,
) {
    /**
     * The backend refuses to move or cancel a slot that already has an
     * active reservation (`supportTrains.js:1005`), so the affordances
     * hide instead of failing. Mirrors RN's `canManageSlotDate`.
     */
    val isEditable: Boolean get() = status == "open" && filledCount == 0
}

/** One co-organizer row. */
data class ManageOrganizerRow(
    val id: String,
    val userId: String?,
    val name: String,
    val role: String,
    val isPrimary: Boolean,
)

/** Add / edit state for the slot editor sheet. */
data class ManageSlotEditorState(
    val slotId: String? = null,
    /** `yyyy-MM-dd`, the shape both slot schemas validate. */
    val slotDate: String,
    val slotLabel: String,
    val supportMode: String,
    /** `HH:mm`. */
    val startTime: String,
    val endTime: String,
) {
    val isEditing: Boolean get() = slotId != null

    companion object {
        /** `slot_label` enum from `customSlotSchema` (`supportTrains.js:405`). */
        val LABELS = listOf("Breakfast", "Lunch", "Dinner", "Groceries", "Custom")

        /** `support_mode` enum from the same schema. */
        val MODES = listOf("meal", "takeout", "groceries")
    }
}

/** A destructive organizer action awaiting confirmation. */
sealed interface ManageConfirmKind {
    data object UnpublishTrain : ManageConfirmKind

    data object ArchiveTrain : ManageConfirmKind

    data object DeleteTrain : ManageConfirmKind

    data object DisableFund : ManageConfirmKind

    data class CancelSlot(val slotId: String) : ManageConfirmKind

    data class RemoveOrganizer(val userId: String) : ManageConfirmKind

    data class RemoveHelper(val reservationId: String) : ManageConfirmKind
}

data class ManageDestructiveConfirm(
    val kind: ManageConfirmKind,
    val title: String,
    val message: String,
    val confirmLabel: String,
)

/** Pure projections shared by the VM and its tests. */
object ManageOrganizerProjection {
    fun helperRows(
        reservations: List<SupportTrainReservationDto>,
        slots: List<ManageSlotRow>,
    ): List<ManageHelperRow> {
        val slotById = slots.associateBy { it.id }
        return reservations.map { reservation ->
            val slot = reservation.slotId?.let { slotById[it] }
            val contribution =
                listOfNotNull(
                    reservation.contributionMode?.replaceFirstChar { it.uppercase() },
                    reservation.dishTitle,
                ).filter { it.isNotBlank() }.joinToString(" · ")
            ManageHelperRow(
                id = reservation.id,
                name = reservation.displayName,
                slotLabel = slot?.let { "${it.slotLabel} · ${it.dateLabel}" } ?: "",
                contribution = contribution,
                status = reservation.status ?: "reserved",
                isGuest = reservation.isGuestSignup,
                exactAddressShared = reservation.exactAddressShared == true,
            )
        }
    }

    fun organizerRows(organizers: List<SupportTrainOrganizerRowDto>): List<ManageOrganizerRow> =
        organizers.map { organizer ->
            ManageOrganizerRow(
                id = organizer.id,
                userId = organizer.userId ?: organizer.user?.id,
                name = organizer.displayName,
                role = organizer.role ?: "co_organizer",
                isPrimary = organizer.isPrimary,
            )
        }

    fun slotRows(slots: List<SupportTrainSlotDto>): List<ManageSlotRow> =
        slots
            .filter { (it.status ?: "open") != "canceled" }
            .map { slot ->
                val date = parseDate(slot.slotDate)
                val window =
                    listOfNotNull(slot.startTime, slot.endTime).filter { it.isNotBlank() }.joinToString(" – ")
                val filled = slot.filledCount ?: 0
                val badge =
                    when {
                        slot.status == "completed" -> "Completed"
                        filled > 0 || slot.status == "full" -> "Reserved"
                        else -> "Open"
                    }
                ManageSlotRow(
                    id = slot.id,
                    dateLabel = date?.let { longDateLabel(it) } ?: (slot.slotDate ?: ""),
                    metaLabel =
                        listOfNotNull(slot.slotLabel, window.takeIf { it.isNotBlank() })
                            .joinToString(" · "),
                    badge = badge,
                    slotDate = slot.slotDate ?: "",
                    slotLabel = slot.slotLabel ?: "Dinner",
                    supportMode = slot.supportMode ?: "meal",
                    startTime = slot.startTime,
                    endTime = slot.endTime,
                    filledCount = filled,
                    status = slot.status ?: "open",
                )
            }

    fun parseDate(value: String?): Date? {
        if (value.isNullOrBlank()) return null
        return runCatching { utc("yyyy-MM-dd").parse(value.take(10)) }.getOrNull()
    }

    fun longDateLabel(date: Date): String = utc("EEEE, MMMM d").format(date)

    /** `yyyy-MM-dd` for `slot_date`. */
    fun isoDate(date: Date): String = utc("yyyy-MM-dd").format(date)

    private fun utc(pattern: String): SimpleDateFormat =
        SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
}
