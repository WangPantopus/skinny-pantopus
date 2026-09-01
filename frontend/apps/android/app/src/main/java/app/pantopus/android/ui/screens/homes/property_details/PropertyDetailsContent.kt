@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import app.pantopus.android.ui.components.SourcePillTone
import app.pantopus.android.ui.theme.PantopusIcon

/** Address and static-map coordinate for the property hero. */
data class PropertyAddress(
    val line1: String,
    val line2: String,
    val latitude: Double,
    val longitude: Double,
)

/** Single read-only fact row shown in the Property / Records sections. */
data class PropertyFactRow(
    val id: String,
    val label: String,
    val value: String,
    val sub: String? = null,
    val mono: Boolean = false,
    val mismatch: Boolean = false,
)

/** Status pill configuration for one verification source. */
data class SourcePillSpec(
    val label: String,
    val tone: SourcePillTone,
    val icon: PantopusIcon? = null,
)

/** Single row in the Verification section. */
data class VerificationSource(
    val id: String,
    val title: String,
    val detail: String,
    val pill: SourcePillSpec,
)

/** Expandable banner shown only when records disagree. */
data class MismatchBannerData(
    val summary: String,
    val detail: String,
)

/** Full projection backing Property Details. */
data class PropertyDetailsContent(
    val address: PropertyAddress,
    val propertyFacts: List<PropertyFactRow>,
    val records: List<PropertyFactRow>,
    val verification: List<VerificationSource>,
    val banner: MismatchBannerData? = null,
)

/** Observed state for the screen. */
sealed interface PropertyDetailsUiState {
    data object Loading : PropertyDetailsUiState

    data class Clean(
        val content: PropertyDetailsContent,
    ) : PropertyDetailsUiState

    data class Mismatch(
        val content: PropertyDetailsContent,
    ) : PropertyDetailsUiState

    data class Error(
        val message: String,
    ) : PropertyDetailsUiState
}
