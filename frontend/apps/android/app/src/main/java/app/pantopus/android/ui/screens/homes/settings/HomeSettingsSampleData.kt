@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl

/**
 * P5.1 / A14.1 — Deterministic seed for the per-home Settings index.
 * Mirrors the iOS `HomeSettingsSampleData` enum: two frames cover
 * the established (populated) home and the newly-claimed (verifying)
 * home. Backend persistence is out of scope for P5.1 — these strings
 * back both the previews and the Paparazzi snapshot baselines.
 */
object HomeSettingsSampleData {
    /** Which frame the data source should render. */
    enum class Frame {
        /** Established home with verified address and full populated subs. */
        Populated,

        /** Newly claimed home with verifying chip + "Not set" subs. */
        Pending,
    }

    /** Static identity strip rendered above the first group. */
    @Immutable
    data class Identity(
        val homeName: String,
        val addressChipLabel: String,
        val addressChipTone: RowControl.ChipTone,
    )

    fun identity(frame: Frame): Identity =
        when (frame) {
            Frame.Populated ->
                Identity(
                    homeName = "14 Elm Park Lane",
                    addressChipLabel = "Verified",
                    addressChipTone = RowControl.ChipTone.Success,
                )
            Frame.Pending ->
                Identity(
                    homeName = "42 Magnolia Court",
                    addressChipLabel = "Verifying",
                    addressChipTone = RowControl.ChipTone.Warning,
                )
        }

    fun footer(frame: Frame): String =
        when (frame) {
            Frame.Populated -> "14 Elm Park Lane · Owner since Jul 2024"
            Frame.Pending -> "42 Magnolia Court · Claim ID 8174"
        }

    /**
     * Frame the sample home for an opaque `homeId`. Test ids that
     * start with `pending-` route to the pending frame; everything
     * else lands on the populated frame.
     */
    fun frameForHomeId(homeId: String): Frame =
        if (homeId.startsWith("pending-") || homeId.contains("claim", ignoreCase = true)) {
            Frame.Pending
        } else {
            Frame.Populated
        }

    /**
     * Deterministic group projection backing the previews + Paparazzi
     * baselines. Reproduces the per-frame slot inventory + sample
     * subtexts the live [HomeSettingsViewModel] structures, so snapshots
     * don't depend on coroutine dispatching or the network.
     */
    @Suppress("LongMethod")
    fun sampleGroups(frame: Frame): List<GroupedListGroup> {
        val chip = identity(frame)
        val addressControl =
            RowControl.ChipStatus(
                label = chip.addressChipLabel,
                tone = chip.addressChipTone,
                includesChevron = true,
            )
        return when (frame) {
            Frame.Populated ->
                listOf(
                    GroupedListGroup(
                        id = "homeIdentity",
                        overline = "Home identity",
                        rows =
                            listOf(
                                GroupedListRow("address", "Address", subtext = "14 Elm Park Lane", control = addressControl),
                                GroupedListRow(
                                    "propertyDetails",
                                    "Property details",
                                    subtext = "3 bed · 2 bath · Built 1998",
                                    control = RowControl.Chevron,
                                ),
                                GroupedListRow("photos", "Photos", subtext = "Front porch · added Mar 2024", control = RowControl.Chevron),
                                GroupedListRow("documents", "Documents", subtext = "Lease, HOA, Tax", control = RowControl.Chevron),
                            ),
                    ),
                    GroupedListGroup(
                        id = "access",
                        overline = "Access",
                        rows =
                            listOf(
                                GroupedListRow("accessCodes", "Access codes", subtext = "2 active codes", control = RowControl.Chevron),
                                GroupedListRow(
                                    "trustedNeighbors",
                                    "Trusted neighbors",
                                    subtext = "3 approved",
                                    control = RowControl.Chevron,
                                ),
                                GroupedListRow("privacy", "Privacy", subtext = "Verified neighbors only", control = RowControl.Chevron),
                            ),
                    ),
                    GroupedListGroup(
                        id = "members",
                        overline = "Members",
                        rows =
                            listOf(
                                GroupedListRow("people", "People", subtext = "4 members · 1 pending", control = RowControl.Chevron),
                                GroupedListRow(
                                    "inviteLink",
                                    "Invite link",
                                    subtext = "Active · expires in 12 days",
                                    control = RowControl.Chevron,
                                ),
                            ),
                    ),
                    GroupedListGroup(
                        id = "notifications",
                        overline = "Notifications",
                        rows =
                            listOf(
                                GroupedListRow(
                                    "homeNotifications",
                                    "Home notifications",
                                    subtext = "Push, email digest",
                                    control = RowControl.Chevron,
                                ),
                            ),
                    ),
                    GroupedListGroup(
                        id = "windDown",
                        overline = "Wind down",
                        rows = listOf(GroupedListRow("leaveHome", "Leave this home", control = RowControl.Chevron, destructive = true)),
                    ),
                )
            Frame.Pending ->
                listOf(
                    GroupedListGroup(
                        id = "homeIdentity",
                        overline = "Home identity",
                        rows =
                            listOf(
                                GroupedListRow("address", "Address", subtext = "42 Magnolia Court", control = addressControl),
                                GroupedListRow("propertyDetails", "Property details", subtext = "Not set", control = RowControl.Chevron),
                                GroupedListRow("photos", "Photos", subtext = "Add a photo", control = RowControl.Chevron),
                                GroupedListRow(
                                    "documents",
                                    "Documents",
                                    subtext = "Available after verification",
                                    control = RowControl.Chevron,
                                ),
                            ),
                    ),
                    GroupedListGroup(
                        id = "access",
                        overline = "Access",
                        rows =
                            listOf(
                                GroupedListRow("accessCodes", "Access codes", subtext = "Not set", control = RowControl.Chevron),
                                GroupedListRow(
                                    "trustedNeighbors",
                                    "Trusted neighbors",
                                    subtext = "Available after verification",
                                    control = RowControl.Chevron,
                                ),
                                GroupedListRow(
                                    "privacy",
                                    "Privacy",
                                    subtext = "Available after verification",
                                    control = RowControl.Chevron,
                                ),
                            ),
                    ),
                    GroupedListGroup(
                        id = "members",
                        overline = "Members",
                        rows =
                            listOf(
                                GroupedListRow("people", "People", subtext = "Just you", control = RowControl.Chevron),
                                GroupedListRow(
                                    "inviteLink",
                                    "Invite link",
                                    subtext = "Available after verification",
                                    control = RowControl.Chevron,
                                ),
                            ),
                    ),
                    GroupedListGroup(
                        id = "notifications",
                        overline = "Notifications",
                        rows =
                            listOf(
                                GroupedListRow(
                                    "homeNotifications",
                                    "Home notifications",
                                    subtext = "Default",
                                    control = RowControl.Chevron,
                                ),
                            ),
                    ),
                    GroupedListGroup(
                        id = "windDown",
                        overline = "Wind down",
                        rows = listOf(GroupedListRow("cancelClaim", "Cancel claim", control = RowControl.Chevron, destructive = true)),
                    ),
                )
        }
    }
}
