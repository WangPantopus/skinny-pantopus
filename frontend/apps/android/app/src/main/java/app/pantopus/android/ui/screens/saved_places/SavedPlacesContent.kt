@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.saved_places

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * BLOCK 2E — "Saved places". UI models + the client-side projection that maps
 * [SavedPlaceDto]s into rows, the relative "Saved …" caption, and the
 * filter-chip set (All · Home · Work · Saved). Pure data + logic so it
 * unit-tests on the JVM and mirrors the iOS `SavedPlacesProjection`.
 */

// region Place type

/** The four `place_type` values; `searched` folds into the "Saved" chip. */
enum class SavedPlaceType(
    val icon: PantopusIcon,
    val tileForeground: Color,
    val tileBackground: Color,
    val pillLabel: String?,
    val filterBucket: SavedPlaceFilter,
) {
    Home(PantopusIcon.Home, PantopusColors.home, PantopusColors.homeBg, "Home", SavedPlaceFilter.Home),
    Work(PantopusIcon.Briefcase, PantopusColors.business, PantopusColors.businessBg, "Work", SavedPlaceFilter.Work),
    Saved(PantopusIcon.Bookmark, PantopusColors.primary600, PantopusColors.primary100, null, SavedPlaceFilter.Saved),
    Searched(PantopusIcon.Bookmark, PantopusColors.primary600, PantopusColors.primary100, null, SavedPlaceFilter.Saved),
    ;

    companion object {
        /** Tolerant decode — an unknown `place_type` lands on [Saved]. */
        fun fromWire(raw: String): SavedPlaceType =
            when (raw.lowercase()) {
                "home" -> Home
                "work" -> Work
                "searched" -> Searched
                else -> Saved
            }
    }
}

// endregion

// region Filter chips

enum class SavedPlaceFilter(
    val wire: String,
    val label: String,
) {
    All("all", "All"),
    Home("home", "Home"),
    Work("work", "Work"),
    Saved("saved", "Saved"),
    ;

    /** `savedPlaces.chip.{all|home|work|saved}`. */
    val testTag: String get() = "savedPlaces.chip.$wire"

    /** Does [type] belong under this chip? [All] matches everything. */
    fun matches(type: SavedPlaceType): Boolean = this == All || type.filterBucket == this
}

// endregion

// region Row

data class SavedPlaceRow(
    val id: String,
    val label: String,
    val type: SavedPlaceType,
    val city: String?,
    val state: String?,
    /** "Saved 3 weeks ago" — already prefixed. */
    val savedCaption: String,
    val latitude: Double,
    val longitude: Double,
    val geocodePlaceId: String?,
) {
    /** "{city}, {state}" — collapses gracefully when one or both are missing. */
    val subtitle: String
        get() {
            val parts = listOfNotNull(city?.takeIf { it.isNotBlank() }, state?.takeIf { it.isNotBlank() })
            return if (parts.isEmpty()) "Saved place" else parts.joinToString(", ")
        }

    fun toActionTarget(): SavedPlaceActionTarget =
        SavedPlaceActionTarget(
            id = id,
            label = label,
            subtitle = subtitle,
            type = type,
            latitude = latitude,
            longitude = longitude,
        )
}

data class SavedPlaceActionTarget(
    val id: String,
    val label: String,
    val subtitle: String,
    val type: SavedPlaceType,
    val latitude: Double,
    val longitude: Double,
)

// endregion

// region Undo

/** Seed for the post-removal Undo snackbar. Re-POSTing [dto] restores it. */
data class SavedPlaceUndo(
    val dto: SavedPlaceDto,
    val index: Int,
)

// endregion

// region UI state

sealed interface SavedPlacesUiState {
    data object Loading : SavedPlacesUiState

    /**
     * `filters` is `[All] + present buckets`; the screen shows the chip row
     * only when more than one type is present (i.e. `filters.size > 2`).
     */
    data class Loaded(
        val rows: List<SavedPlaceRow>,
        val filters: List<SavedPlaceFilter>,
        val total: Int,
    ) : SavedPlacesUiState

    data object Empty : SavedPlacesUiState

    data class Error(val message: String) : SavedPlacesUiState
}

// endregion

// region Save-place type chooser

/** The three choices in the Save-place sheet's type picker (`Other` → `saved`). */
enum class SavePlaceTypeChoice(
    val wire: String,
    val label: String,
    val type: SavedPlaceType,
) {
    Home("home", "Home", SavedPlaceType.Home),
    Work("work", "Work", SavedPlaceType.Work),
    Other("saved", "Other", SavedPlaceType.Saved),
    ;

    /** `savePlace.type.{home|work|other}`. */
    val testTag: String get() = "savePlace.type.${name.lowercase()}"
    val icon: PantopusIcon get() = type.icon
    val tileForeground: Color get() = type.tileForeground
    val tileBackground: Color get() = type.tileBackground
}

// endregion

// region Projection

object SavedPlacesProjection {
    /**
     * Present filter chips: [SavedPlaceFilter.All] first, then home / work /
     * saved in that fixed order, but only the buckets that have rows.
     */
    fun presentFilters(dtos: List<SavedPlaceDto>): List<SavedPlaceFilter> {
        val buckets = dtos.map { SavedPlaceType.fromWire(it.placeType).filterBucket }.toSet()
        val ordered = listOf(SavedPlaceFilter.Home, SavedPlaceFilter.Work, SavedPlaceFilter.Saved).filter { it in buckets }
        return listOf(SavedPlaceFilter.All) + ordered
    }

    /** Rows matching [filter], preserving the server's `created_at desc` order. */
    fun rows(
        dtos: List<SavedPlaceDto>,
        filter: SavedPlaceFilter,
        now: Instant,
    ): List<SavedPlaceRow> =
        dtos
            .filter { filter.matches(SavedPlaceType.fromWire(it.placeType)) }
            .map { row(it, now) }

    fun row(
        dto: SavedPlaceDto,
        now: Instant,
    ): SavedPlaceRow =
        SavedPlaceRow(
            id = dto.id,
            label = dto.label,
            type = SavedPlaceType.fromWire(dto.placeType),
            city = dto.city,
            state = dto.state,
            savedCaption = relativeSaved(dto.createdAt, now),
            latitude = dto.latitude,
            longitude = dto.longitude,
            geocodePlaceId = dto.geocodePlaceId,
        )

    /**
     * "Saved 3 weeks ago" — day-granular relative phrasing matching the design
     * captions (today / yesterday / N days / N weeks / last month / N months /
     * N years).
     */
    fun relativeSaved(
        raw: String?,
        now: Instant,
    ): String {
        val date = parseInstant(raw) ?: return "Saved"
        val days = ChronoUnit.SECONDS.between(date, now).coerceAtLeast(0) / 86_400L
        return when {
            days == 0L -> "Saved today"
            days == 1L -> "Saved yesterday"
            days < 7L -> "Saved $days days ago"
            days < 14L -> "Saved 1 week ago"
            days < 30L -> "Saved ${days / 7} weeks ago"
            days < 60L -> "Saved last month"
            days < 365L -> "Saved ${days / 30} months ago"
            else -> {
                val years = days / 365
                "Saved $years year${if (years == 1L) "" else "s"} ago"
            }
        }
    }

    fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrEmpty()) return null
        return runCatching { Instant.parse(raw) }.getOrNull()
    }
}

// endregion
