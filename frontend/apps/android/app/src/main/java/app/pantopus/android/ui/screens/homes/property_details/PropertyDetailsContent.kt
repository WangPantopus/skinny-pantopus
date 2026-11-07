@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import app.pantopus.android.data.api.models.homes.FloorPlanLayoutDto
import app.pantopus.android.data.api.models.homes.HouseholdCountyCheckDto
import app.pantopus.android.data.api.models.homes.HouseholdCountyPageDto
import app.pantopus.android.data.api.models.homes.HouseholdFactDto
import app.pantopus.android.data.api.models.homes.HouseholdGroupDto
import app.pantopus.android.data.api.models.homes.HouseholdQuestionDto
import app.pantopus.android.ui.components.SourcePillTone
import app.pantopus.android.ui.theme.PantopusIcon

private const val MAX_LATITUDE = 90.0
private const val MAX_LONGITUDE = 180.0

/** Address and optional static-map coordinate for the property hero. */
data class PropertyAddress(
    val line1: String,
    val line2: String,
    val latitude: Double?,
    val longitude: Double?,
) {
    val hasMapLocation: Boolean
        get() {
            val lat = latitude ?: return false
            val lon = longitude ?: return false
            return lat.isFinite() && lon.isFinite() && lat in -MAX_LATITUDE..MAX_LATITUDE && lon in -MAX_LONGITUDE..MAX_LONGITUDE
        }
}

/** Single read-only fact row shown in the Property / Records sections. */
data class PropertyFactRow(
    val id: String,
    val label: String,
    val value: String,
    val sub: String? = null,
    val mono: Boolean = false,
    val mismatch: Boolean = false,
)

/** One titled card of read-only record rows: the county record's Building, Lot, Parcel & records… sections. */
data class PropertyRecordSection(
    val id: String,
    val title: String,
    val rows: List<PropertyFactRow>,
    /** Caption under the card (the value estimate's "isn't an appraisal"). */
    val note: String? = null,
)

/** What the household has said and can say, as the server sends it. Empty parts draw nothing. */
data class PropertyHouseholdContent(
    /** "From your household", where there's no record to set it beside. */
    val sections: List<PropertyRecordSection> = emptyList(),
    val groups: List<HouseholdGroupDto> = emptyList(),
    val questions: List<HouseholdQuestionDto> = emptyList(),
    val countyPage: HouseholdCountyPageDto? = null,
    /** Link and confirm: "Is this right?" once someone is back from the county's page. */
    val countyCheck: HouseholdCountyCheckDto? = null,
    /** "Is this your layout?", for a unit its building's sheet names. */
    val floorPlan: FloorPlanLayoutDto? = null,
) {
    /** The county's page as a link of its own: not when "Is this right?" draws it in its card. */
    val countyLink: HouseholdCountyPageDto? get() = countyPage?.takeIf { countyCheck == null }

    fun groupForSection(id: String): HouseholdGroupDto? = groups.firstOrNull { it.sectionId == id }

    /** The layout question, if it sits at the foot of this card. */
    fun layoutForSection(id: String): FloorPlanLayoutDto? =
        floorPlan?.takeIf { it.sectionId == id && (it.prompt != null || it.answered != null) }

    /** A card of its own: nothing in the record to sit under. */
    val addDetails: List<HouseholdGroupDto>
        get() = groups.filter { it.sectionId == null }

    fun fact(key: String): HouseholdFactDto? = groups.flatMap { it.facts }.firstOrNull { it.key == key }
}

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
    /** The county record's sections; empty for anyone but a verified owner. */
    val recordSections: List<PropertyRecordSection>,
    /** Where the record came from and when, under its last section. */
    val recordFooter: String? = null,
    val verification: List<VerificationSource>,
    val banner: MismatchBannerData? = null,
    /** Null for anyone the household's facts aren't for, and from a server that doesn't send them. */
    val household: PropertyHouseholdContent? = null,
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
