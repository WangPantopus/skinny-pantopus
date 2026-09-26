@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.guests

import app.pantopus.android.ui.components.ChipPickerOption
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A13.1 — Deterministic seed data for the Add Guest form. Mirrors iOS
 * `AddGuestSampleData`. The backend has been removed from the repo, so
 * the chip option lists, the home-context strip copy, and the two design
 * frames (FILLED / INITIAL) all live here so previews + snapshot
 * baselines render the same shape every time.
 */
object AddGuestSampleData {
    /** Stable id for the "Custom…" duration chip — opens the date-range sheet. */
    const val DURATION_CUSTOM_ID = "custom"

    /** Maximum welcome-message length (characters). */
    const val WELCOME_MAX_LENGTH = 280

    /** Single-select duration chips (radio). */
    val durationOptions: List<ChipPickerOption> =
        listOf(
            ChipPickerOption("2h", "2 hours"),
            ChipPickerOption("today", "Today"),
            ChipPickerOption("weekend", "Weekend"),
            ChipPickerOption(DURATION_CUSTOM_ID, "Custom…"),
        )

    /**
     * Multi-select "What they can see" chips: the guest page sections the pass
     * includes (`included_sections`), with the web's keys and labels.
     */
    val sectionOptions: List<ChipPickerOption> =
        listOf(
            ChipPickerOption("wifi", "WiFi", PantopusIcon.Wifi),
            ChipPickerOption("entry_instructions", "Entry Instructions", PantopusIcon.DoorOpen),
            ChipPickerOption("house_rules", "House Rules", PantopusIcon.ClipboardList),
            ChipPickerOption("parking", "Parking", PantopusIcon.Car),
            ChipPickerOption("trash_day", "Trash Day", PantopusIcon.Trash),
            ChipPickerOption("local_tips", "Local Tips", PantopusIcon.MapPin),
            ChipPickerOption("emergency", "Emergency Info", PantopusIcon.Siren),
        )

    /** Preselected sections, as in the web's Guest Pass template. */
    val DEFAULT_SECTION_IDS = setOf("wifi", "entry_instructions", "house_rules", "parking")

    /** House-context strip ("which home is this pass for"). */
    data class HomeContext(
        val title: String,
        val subtitle: String,
    )

    // Previews and snapshots only; the form loads the real Home
    // (AddGuestFormViewModel).
    @Suppress("UnusedParameter")
    fun homeContext(homeId: String): HomeContext = HomeContext(title = "412 Elm St · Apt 3B", subtitle = "Kovács household")

    /** FILLED frame — Sasha, Weekend, WiFi + Entry Instructions + Parking, welcome note. */
    object Filled {
        const val NAME = "Sasha Petrov"
        const val CONTACT = "sasha@petrov.co"
        const val DURATION_ID = "weekend"
        val SECTION_IDS = setOf("wifi", "entry_instructions", "parking")
        const val WELCOME =
            "Hey Sasha — plants twice this weekend, water bowl is in the kitchen. " +
                "Park in the driveway."
    }
}
