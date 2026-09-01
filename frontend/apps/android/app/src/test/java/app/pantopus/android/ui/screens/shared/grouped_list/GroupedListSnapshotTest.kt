@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.grouped_list

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi baselines for the shared GroupedList shell. Three frames
 * match the Settings design: main index (chevrons + status chips +
 * destructive card), toggles, mixed controls (radio + slider +
 * toggles).
 */
class GroupedListSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2600,
                    softButtons = false,
                ),
        )

    @Test
    fun grouped_list_main_index_chevrons_chips_destructive() {
        paparazzi.snapshot {
            Frame {
                GroupedListScreen(
                    title = "Settings",
                    state =
                        GroupedListUiState.Loaded(
                            groups =
                                listOf(
                                    GroupedListGroup(
                                        id = "account",
                                        overline = "Account",
                                        rows =
                                            listOf(
                                                GroupedListRow("editProfile", "Edit profile", control = RowControl.Chevron),
                                                GroupedListRow("password", "Password", control = RowControl.Chevron),
                                                GroupedListRow(
                                                    "verification",
                                                    "Verification",
                                                    control =
                                                        RowControl.ChipStatus(
                                                            "Verified",
                                                            RowControl.ChipTone.Success,
                                                            includesChevron = true,
                                                        ),
                                                ),
                                            ),
                                    ),
                                    GroupedListGroup(
                                        id = "privacy",
                                        overline = "Privacy",
                                        rows =
                                            listOf(
                                                GroupedListRow(
                                                    "blocks",
                                                    "Blocked users",
                                                    subtext = "3 people",
                                                    control = RowControl.Chevron,
                                                ),
                                                GroupedListRow("visibility", "Visibility preferences", control = RowControl.Chevron),
                                            ),
                                    ),
                                    GroupedListGroup(
                                        id = "session",
                                        overline = null,
                                        rows =
                                            listOf(
                                                GroupedListRow(
                                                    id = "signOut",
                                                    label = "Log out",
                                                    control = RowControl.Chevron,
                                                    destructive = true,
                                                ),
                                            ),
                                    ),
                                ),
                        ),
                    footerCaption = "maria@pantopus · ID 8174",
                )
            }
        }
    }

    @Test
    fun grouped_list_toggles_with_helper() {
        paparazzi.snapshot {
            Frame {
                GroupedListScreen(
                    title = "Notifications",
                    state =
                        GroupedListUiState.Loaded(
                            groups =
                                listOf(
                                    GroupedListGroup(
                                        id = "push",
                                        overline = "Push",
                                        helper = "Receive on this device. Sounds and badges follow system settings.",
                                        rows =
                                            listOf(
                                                GroupedListRow("push.messages", "Messages", control = RowControl.Toggle(true)),
                                                GroupedListRow("push.gigs", "Gigs", control = RowControl.Toggle(true)),
                                                GroupedListRow("push.listings", "Listings", control = RowControl.Toggle(false)),
                                                GroupedListRow("push.mailbox", "Mailbox", control = RowControl.Toggle(true)),
                                                GroupedListRow("push.home", "Home", control = RowControl.Toggle(true)),
                                            ),
                                    ),
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun grouped_list_mixed_controls_radio_slider_toggle() {
        paparazzi.snapshot {
            Frame {
                GroupedListScreen(
                    title = "Privacy",
                    state =
                        GroupedListUiState.Loaded(
                            groups =
                                listOf(
                                    GroupedListGroup(
                                        id = "visibility",
                                        overline = "Profile visibility",
                                        helper = "Choose who can find and view your profile.",
                                        rows =
                                            listOf(
                                                GroupedListRow(
                                                    "visibility.anyone",
                                                    "Anyone",
                                                    subtext = "Everyone on Pantopus can see your profile.",
                                                    control = RowControl.Radio(false),
                                                ),
                                                GroupedListRow(
                                                    "visibility.verified",
                                                    "Verified connections only",
                                                    subtext = "Only verified neighbors and people you follow.",
                                                    control = RowControl.Radio(true),
                                                ),
                                                GroupedListRow(
                                                    "visibility.none",
                                                    "No one",
                                                    subtext = "Your profile is hidden from search and discovery.",
                                                    control = RowControl.Radio(false),
                                                ),
                                            ),
                                    ),
                                    GroupedListGroup(
                                        id = "address",
                                        overline = "Address sharing",
                                        rows =
                                            listOf(
                                                GroupedListRow(
                                                    "addressPrecision",
                                                    "Precision · Street",
                                                    subtext = "How precisely Pantopus shares your address with verified connections.",
                                                    control =
                                                        RowControl.Slider(
                                                            stops = listOf("Exact", "Street", "Block", "Neighborhood"),
                                                            index = 1,
                                                        ),
                                                ),
                                                GroupedListRow(
                                                    "hideFromSearch",
                                                    "Hide from search results",
                                                    subtext = "Your address won't appear in neighbor searches.",
                                                    control = RowControl.Toggle(true),
                                                ),
                                            ),
                                    ),
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun grouped_list_loading_and_error_states() {
        paparazzi.snapshot {
            Frame {
                GroupedListScreen(title = "Settings", state = GroupedListUiState.Loading)
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
