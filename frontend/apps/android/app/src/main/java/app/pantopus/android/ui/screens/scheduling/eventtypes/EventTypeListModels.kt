@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar

/** Active = bookable (`is_active=true`); Hidden = deactivated. */
enum class EventTypeTab(val label: String) {
    Active("Active"),
    Hidden("Hidden"),
}

/**
 * One projected event-type row. Colour is carried as the raw backend hex +
 * a stable seed so the screen resolves the dot [androidx.compose.ui.graphics.Color]
 * (keeps `toColorInt`, which needs the Android graphics layer, out of the
 * JVM-tested view-model).
 */
data class EventTypeRowUi(
    val id: String,
    val name: String,
    val meta: String,
    val colorHex: String?,
    val isActive: Boolean,
    val isSecret: Boolean,
    val priceLabel: String? = null,
    val slug: String? = null,
    /** "N hosts" pill next to the name (design EventRow `hosts`); null hides it. */
    val hostsBadge: String? = null,
)

/**
 * B1 Event Type / Service list. The pillar pill re-scopes the catalog
 * (Personal sky / Business violet priced services / Home green); the
 * Active/Hidden segment filters by `is_active`. Empty resolves to one of three
 * surfaces in the screen using [activeCount]/[hiddenCount].
 */
sealed interface EventTypeListUiState {
    data object Loading : EventTypeListUiState

    data class Content(
        val pillar: SchedulingPillar,
        val tab: EventTypeTab,
        val rows: List<EventTypeRowUi>,
        val activeCount: Int,
        val hiddenCount: Int,
        val canEdit: Boolean,
    ) : EventTypeListUiState

    data class Error(
        val message: String,
    ) : EventTypeListUiState
}
