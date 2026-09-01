@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import app.pantopus.android.ui.components.SourcePillTone
import app.pantopus.android.ui.theme.PantopusIcon

/** Deterministic local fixtures for Property Details; no backend calls. */
object PropertyDetailsSampleData {
    val address =
        PropertyAddress(
            line1 = "412 Elm St · Apt 3B",
            line2 = "Elm Park, NY 10013",
            latitude = 40.7128,
            longitude = -74.0058,
        )

    private val records =
        listOf(
            PropertyFactRow(id = "parcel", label = "Parcel ID", value = "NY-013-0042-019", mono = true),
            PropertyFactRow(
                id = "class",
                label = "Property class",
                value = "Residential",
                sub = "Multi-family · 4-6 unit",
            ),
            PropertyFactRow(id = "zoning", label = "Zoning", value = "R5", mono = true),
            PropertyFactRow(
                id = "assessed",
                label = "Last assessed",
                value = "\$1.24M",
                sub = "2025 county roll",
                mono = true,
            ),
        )

    /** FRAME 1 — all sources agree. */
    val clean =
        PropertyDetailsContent(
            address = address,
            propertyFacts =
                listOf(
                    PropertyFactRow(id = "type", label = "Type", value = "Apartment"),
                    PropertyFactRow(id = "year", label = "Year built", value = "1924", mono = true),
                    PropertyFactRow(id = "beds", label = "Bedrooms", value = "2", mono = true),
                    PropertyFactRow(id = "baths", label = "Bathrooms", value = "1", mono = true),
                    PropertyFactRow(id = "interior", label = "Interior", value = "845 sq ft", mono = true),
                    PropertyFactRow(id = "lot", label = "Lot share", value = "1/6", sub = "6-unit building", mono = true),
                ),
            records = records,
            verification =
                listOf(
                    VerificationSource(
                        id = "county",
                        title = "County records",
                        detail = "Last synced Apr 4, 2026 · auto-refresh quarterly",
                        pill = SourcePillSpec("Verified", SourcePillTone.Success, PantopusIcon.Check),
                    ),
                    VerificationSource(
                        id = "mls",
                        title = "MLS",
                        detail = "Listing data refreshed Apr 2, 2026",
                        pill = SourcePillSpec("Verified", SourcePillTone.Success, PantopusIcon.CheckCircle),
                    ),
                    VerificationSource(
                        id = "owner",
                        title = "Owner confirmation",
                        detail = "You confirmed every field Apr 4, 2026",
                        pill = SourcePillSpec("You", SourcePillTone.Success, PantopusIcon.UserRound),
                    ),
                ),
        )

    /** FRAME 2 — county vs owner-confirmed disagree on bedrooms. */
    val mismatch =
        PropertyDetailsContent(
            address = address,
            propertyFacts =
                listOf(
                    PropertyFactRow(id = "type", label = "Type", value = "Apartment"),
                    PropertyFactRow(id = "year", label = "Year built", value = "1924", mono = true),
                    PropertyFactRow(
                        id = "beds",
                        label = "Bedrooms",
                        value = "2 · county says 3",
                        sub = "Edited Apr 4, 2026",
                        mono = true,
                        mismatch = true,
                    ),
                    PropertyFactRow(id = "baths", label = "Bathrooms", value = "1", mono = true),
                    PropertyFactRow(id = "interior", label = "Interior", value = "845 sq ft", mono = true),
                    PropertyFactRow(id = "lot", label = "Lot share", value = "1/6", sub = "6-unit building", mono = true),
                ),
            records = records,
            verification =
                listOf(
                    VerificationSource(
                        id = "county",
                        title = "County records",
                        detail = "Last synced Apr 4, 2026 · county lists 3 bedrooms",
                        pill = SourcePillSpec("Verified", SourcePillTone.Success, PantopusIcon.Check),
                    ),
                    VerificationSource(
                        id = "mls",
                        title = "MLS",
                        detail = "Listing data refreshed Apr 2, 2026",
                        pill = SourcePillSpec("Verified", SourcePillTone.Success, PantopusIcon.CheckCircle),
                    ),
                    VerificationSource(
                        id = "owner",
                        title = "Owner confirmation",
                        detail = "You confirmed 2 bedrooms Apr 4, 2026",
                        pill = SourcePillSpec("Needs review", SourcePillTone.Warning, PantopusIcon.AlertTriangle),
                    ),
                ),
            banner =
                MismatchBannerData(
                    summary = "County and owner-confirmed records disagree on bedrooms.",
                    detail = "County records list 3 bedrooms. Owner confirmation says 2 after the 2022 renovation.",
                ),
        )

    fun contentFor(homeId: String): PropertyDetailsContent {
        @Suppress("UNUSED_VARIABLE")
        val ignored = homeId
        return mismatch
    }
}
