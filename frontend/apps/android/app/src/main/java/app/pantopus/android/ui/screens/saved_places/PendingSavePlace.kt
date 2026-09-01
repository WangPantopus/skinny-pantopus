@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.saved_places

/**
 * Seed for the Save-place sheet — the place the user is about to save,
 * prefilled from the row / detail it was triggered from.
 */
data class PendingSavePlace(
    val label: String,
    val latitude: Double,
    val longitude: Double,
    val city: String? = null,
    val state: String? = null,
    val geocodePlaceId: String? = null,
    val sourceId: String? = null,
)
