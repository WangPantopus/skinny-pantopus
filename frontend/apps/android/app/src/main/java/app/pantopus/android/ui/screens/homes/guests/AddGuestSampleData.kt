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

    /** Multi-select "Allowed areas" chips with their leading icons. */
    val areaOptions: List<ChipPickerOption> =
        listOf(
            ChipPickerOption("front_door", "Front door", PantopusIcon.DoorOpen),
            ChipPickerOption("garage", "Garage", PantopusIcon.Car),
            ChipPickerOption("mailroom", "Mailroom", PantopusIcon.Mailbox),
            ChipPickerOption("backyard", "Backyard", PantopusIcon.Trees),
            ChipPickerOption("garden_shed", "Garden shed", PantopusIcon.Warehouse),
        )

    /** House-context strip ("which home is this pass for"). */
    data class HomeContext(
        val title: String,
        val subtitle: String,
    )

    // Keyed by home id so previews stay deterministic; a real build would
    // resolve this from the loaded home.
    @Suppress("UnusedParameter")
    fun homeContext(homeId: String): HomeContext = HomeContext(title = "412 Elm St · Apt 3B", subtitle = "Kovács household")

    /** FILLED frame — Sasha, Weekend, Front door + Garage, welcome note. */
    object Filled {
        const val NAME = "Sasha Petrov"
        const val CONTACT = "sasha@petrov.co"
        const val DURATION_ID = "weekend"
        val AREA_IDS = setOf("front_door", "garage")
        const val WELCOME =
            "Hey Sasha — plants twice this weekend, water bowl is in the kitchen. " +
                "Pass also opens the garage if you park inside."
    }
}
