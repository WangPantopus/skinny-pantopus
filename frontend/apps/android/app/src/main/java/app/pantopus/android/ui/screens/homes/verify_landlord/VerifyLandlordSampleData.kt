@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

/** Identity chip shown at the top of A12.5. */
data class VerifyLandlordHomeChip(val label: String)

/** Existing landlord chip surfaced in the fast-track Start variant. */
data class VerifyLandlordExistingLandlord(
    val name: String,
    val verifiedAt: String,
    val contactName: String,
    val otherTenantsCount: Int,
)

/** Aggregate payload powering A12.5. */
data class VerifyLandlordStartContent(
    val variant: VerifyLandlordVariant,
    val homeChip: VerifyLandlordHomeChip,
    val existingLandlord: VerifyLandlordExistingLandlord? = null,
) {
    val isFastTrack: Boolean get() = variant == VerifyLandlordVariant.FastTrack
}

object VerifyLandlordSampleData {
    fun startContent(homeId: String): VerifyLandlordStartContent =
        if (
            homeId.contains("fast-track", ignoreCase = true) ||
            homeId.contains("fasttrack", ignoreCase = true)
        ) {
            fastTrack
        } else {
            canonical
        }

    /**
     * Default form seed: registered unit drives the lease-unit-match
     * validation. Populated frame fills everything; the error frame
     * is derived via [errorForm] for snapshot tests.
     */
    @Suppress("UNUSED_PARAMETER")
    fun formSeed(homeId: String): VerifyLandlordForm = VerifyLandlordForm(registeredUnit = "Apt 3B")

    val canonical: VerifyLandlordStartContent =
        VerifyLandlordStartContent(
            variant = VerifyLandlordVariant.Canonical,
            homeChip = VerifyLandlordHomeChip(label = "Renting · 412 Elm St, Apt 3B"),
        )

    val fastTrack: VerifyLandlordStartContent =
        VerifyLandlordStartContent(
            variant = VerifyLandlordVariant.FastTrack,
            homeChip = VerifyLandlordHomeChip(label = "Renting · 412 Elm St, Apt 3B"),
            existingLandlord =
                VerifyLandlordExistingLandlord(
                    name = "Elm Street Holdings LLC",
                    verifiedAt = "Verified May 2025",
                    contactName = "M. Patel, owner",
                    otherTenantsCount = 2,
                ),
        )

    val populatedForm: VerifyLandlordForm =
        VerifyLandlordForm(
            ownerName = "Elm Street Holdings LLC",
            contactName = "Mira Patel",
            email = "mira@elmstholdings.com",
            phone = "(415) 555-0148",
            lease =
                VerifyLandlordLeaseFile(
                    filename = "lease_apt3b_2025.pdf",
                    sizeLabel = "1.2 MB",
                    pageCount = 6,
                    detectedOwner = "M. Patel",
                    detectedUnit = "Apt 3B",
                ),
            pmEnabled = true,
            pmName = "Daniel Ortega",
            pmEmail = "dortega@anchorpm.co",
            pmPhone = "(415) 555-0922",
            registeredUnit = "Apt 3B",
        )

    val errorForm: VerifyLandlordForm =
        VerifyLandlordForm(
            ownerName = "Elm Street Holdings LLC",
            contactName = "Mira Patel",
            email = "mira@elmstholdings",
            lease =
                VerifyLandlordLeaseFile(
                    filename = "old_lease_2023_apt2a.pdf",
                    sizeLabel = "980 KB",
                    pageCount = 4,
                    detectedOwner = "M. Patel",
                    detectedUnit = "Apt 2A",
                ),
            pmEnabled = false,
            registeredUnit = "Apt 3B",
        )
}
