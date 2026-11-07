@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.page_editor

import app.pantopus.android.data.api.models.businesses.BusinessHoursDto

/**
 * P4.2 — A13.10 Edit Business Page. Render-only data model for the
 * business-profile editor. Mirrors the iOS [EditBusinessPageContent]
 * shape so the same projections work on both platforms.
 */

/** Top-level mode — drives the strip + sticky save bar variants. */
sealed interface EditBusinessPageMode {
    /** Established business mid-edit. */
    data class Published(
        val unsavedCount: Int,
        val lastPublishedLabel: String,
    ) : EditBusinessPageMode

    /** Newly claimed business in setup. */
    data class Setup(
        val done: Int,
        val total: Int,
        val remaining: Int,
        val items: List<EditBusinessPageSetupItem>,
    ) : EditBusinessPageMode
}

/** One chip in the completion strip. */
data class EditBusinessPageSetupItem(
    val id: String,
    val label: String,
    val done: Boolean,
)

/** Per-field edit state — `current` is what the user typed. */
data class EditBusinessPageField(
    val original: String,
    val current: String,
    val placeholder: String = "",
) {
    val isDirty: Boolean
        get() = original != current
}

/** Banner state. */
sealed interface EditBusinessPageBannerState {
    data object Empty : EditBusinessPageBannerState

    data class Filled(
        val dirty: Boolean,
        val palette: BannerPalette = BannerPalette.CafeGoldenHour,
        /** The uploaded banner; the palette shows only while it loads or without one. */
        val imageUrl: String? = null,
    ) : EditBusinessPageBannerState

    enum class BannerPalette { CafeGoldenHour }
}

/** Logo state. */
sealed interface EditBusinessPageLogoState {
    data object Empty : EditBusinessPageLogoState

    data class Filled(
        val initial: String,
        val palette: LogoPalette = LogoPalette.Sunrise,
        /** The uploaded logo; the initial shows only while it loads or without one. */
        val imageUrl: String? = null,
    ) : EditBusinessPageLogoState

    enum class LogoPalette { Sunrise }
}

/** The two images the editor uploads (`POST /api/upload/business-media/:id?type=`). */
enum class EditBusinessMediaKind(val apiType: String) {
    Banner("banner"),
    Logo("logo"),
}

/** One saved interval in the hours card, or a day with none; a split day has a row per interval. */
data class EditBusinessPageHoursRow(
    val id: String,
    val dayLabel: String,
    val state: State,
    val isDirty: Boolean = false,
    /** What the server holds for this row. A save sends it back as it was, notes and seconds included, unless the row changed. */
    val source: BusinessHoursDto? = null,
) {
    sealed interface State {
        /** Open the whole day, in either saved form: 00:00–23:59, or 00:00–24:00 from older saves. */
        val isAllDay: Boolean get() = false

        data class Open(
            val openLabel: String,
            val closeLabel: String,
        ) : State {
            override val isAllDay: Boolean get() = openLabel == MIDNIGHT_LABEL && closeLabel in ALL_DAY_CLOSES
        }

        data object Closed : State

        data object NotSet : State
    }

    companion object {
        /** How a saved `24:00` close reads in a row; only a saved row can hold it. */
        const val END_OF_DAY_LABEL = "24:00"
        const val LAST_MINUTE_LABEL = "11:59 PM"
        const val MIDNIGHT_LABEL = "12:00 AM"
        private val ALL_DAY_CLOSES = setOf(LAST_MINUTE_LABEL, END_OF_DAY_LABEL)
    }
}

/** Hours section state. */
sealed interface EditBusinessPageHoursState {
    val rows: List<EditBusinessPageHoursRow>

    data class Rows(
        override val rows: List<EditBusinessPageHoursRow>,
        val footerHint: String?,
    ) : EditBusinessPageHoursState

    data class QuickApply(
        override val rows: List<EditBusinessPageHoursRow>,
    ) : EditBusinessPageHoursState
}

/** Service chip. */
data class EditBusinessPageServiceChip(
    val id: String,
    val label: String,
    val iconKey: String,
    val isFresh: Boolean = false,
)

sealed interface EditBusinessPageServicesState {
    data class Chips(val chips: List<EditBusinessPageServiceChip>) : EditBusinessPageServicesState

    data class Prompt(val prompt: EditBusinessPagePrompt) : EditBusinessPageServicesState
}

/** One gallery tile. */
data class EditBusinessPageGalleryTile(
    val id: String,
    val palette: Palette,
    val isCover: Boolean = false,
) {
    enum class Palette { Croissant, Coffee, Interior, Bread, Latte, Crowd }
}

data class EditBusinessPageGalleryState(
    val tiles: List<EditBusinessPageGalleryTile>,
    val totalSlots: Int = 20,
    val freshAddTile: Boolean = false,
    val hintLabel: String,
) {
    val isEmpty: Boolean get() = tiles.isEmpty()
}

/** Setup-mode prompt block (Description / Services). */
data class EditBusinessPagePrompt(
    val iconKey: String,
    val title: String,
    val subtitle: String,
    val ctaLabel: String,
)

sealed interface EditBusinessPageDescriptionState {
    data class Field(
        val field: EditBusinessPageField,
        val charLimit: Int,
    ) : EditBusinessPageDescriptionState

    data class Prompt(val prompt: EditBusinessPagePrompt) : EditBusinessPageDescriptionState
}

/**
 * Address + map state. The address travels as its component parts —
 * [address] is the street line that maps 1:1 onto the backend
 * `BusinessLocation.address` column, with [city] / [state] / [zip] in their
 * own columns — so a save never folds the locality back into the street line.
 */
data class EditBusinessPageLocation(
    /** Street line only — never the concatenated display address. */
    val address: EditBusinessPageField,
    /** Suite / unit — the `BusinessLocation.address2` column. */
    val suite: EditBusinessPageField = EditBusinessPageField(original = "", current = ""),
    val city: EditBusinessPageField = EditBusinessPageField(original = "", current = ""),
    val state: EditBusinessPageField = EditBusinessPageField(original = "", current = ""),
    val zip: EditBusinessPageField = EditBusinessPageField(original = "", current = ""),
    val error: String? = null,
    val mapVerified: Boolean,
    val pinDirty: Boolean = false,
) {
    /**
     * `City, ST ZIP` — display-only projection of the locality parts. Never
     * written back to the server.
     */
    val localityLabel: String
        get() {
            var label =
                listOf(city.current, state.current)
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .joinToString(", ")
            val zipValue = zip.current.trim()
            if (zipValue.isNotEmpty()) {
                label = if (label.isEmpty()) zipValue else "$label $zipValue"
            }
            return label
        }

    /** True when any address component carries an unsaved edit. */
    val hasAddressEdits: Boolean
        get() = address.isDirty || suite.isDirty || city.isDirty || state.isDirty || zip.isDirty
}

/** Render-ready payload — mirrors the iOS struct field-by-field. */
data class EditBusinessPageContent(
    val businessId: String,
    val mode: EditBusinessPageMode,
    val banner: EditBusinessPageBannerState,
    val logo: EditBusinessPageLogoState,
    val name: EditBusinessPageField,
    val tagline: EditBusinessPageField,
    val category: EditBusinessPageField,
    val categoryRequired: Boolean,
    val price: EditBusinessPageField,
    val description: EditBusinessPageDescriptionState,
    val hours: EditBusinessPageHoursState,
    val services: EditBusinessPageServicesState,
    val gallery: EditBusinessPageGalleryState,
    val phone: EditBusinessPageField,
    val email: EditBusinessPageField,
    val website: EditBusinessPageField,
    val bookingLink: EditBusinessPageField?,
    val location: EditBusinessPageLocation,
) {
    /** Publishing requires identity; the completeness checklist is advisory. */
    val missingPublishRequirements: Int
        get() = listOf(name.current, category.current).count { it.isBlank() }
}

/**
 * What this person may change in the editor, from `GET /:businessId/me` (mirrors the flags on iOS
 * `EditBusinessPageViewModel`). Each section has its own permission. Nothing is allowed until the first answer, and
 * while [isChecking] nothing can be typed or sent: the last answer is only still drawn, so a quick check doesn't flicker.
 */
data class EditBusinessPageAccess(
    val canEditProfile: Boolean = false,
    val canEditLocation: Boolean = false,
    val canEditHours: Boolean = false,
    val canManageCatalog: Boolean = false,
    val canClose: Boolean = false,
    val isChecking: Boolean = false,
    /** Why editing is off, shown above Save with Retry access. The draft stays either way. */
    val notice: String? = null,
) {
    val canEditAnything: Boolean get() = canEditProfile || canEditLocation || canEditHours

    companion object {
        /** Previews and snapshots, which don't talk to a server. */
        val Full =
            EditBusinessPageAccess(
                canEditProfile = true,
                canEditLocation = true,
                canEditHours = true,
                canManageCatalog = true,
            )
    }
}

/** How one section's fields behave right now. */
enum class EditBusinessFieldMode {
    Editable,

    /** A quick check is running: looks editable, but typing waits for its answer. */
    Held,

    /** Not allowed, or the check is taking long enough to notice. */
    ReadOnly,
}

/** Observed UI state. */
sealed interface EditBusinessPageUiState {
    data object Loading : EditBusinessPageUiState

    data class Loaded(val content: EditBusinessPageContent) : EditBusinessPageUiState

    data object Empty : EditBusinessPageUiState

    data class Error(val message: String) : EditBusinessPageUiState
}

/**
 * Editable field keys for the A13.10 profile form. The address is split into
 * its backend columns — [Address] is the street line only.
 */
enum class EditBusinessPageFieldKey {
    Name,
    Tagline,
    Category,
    Price,
    Description,
    Phone,
    Email,
    Website,
    BookingLink,
    Address,
    Suite,
    City,
    State,
    Zip,
}
