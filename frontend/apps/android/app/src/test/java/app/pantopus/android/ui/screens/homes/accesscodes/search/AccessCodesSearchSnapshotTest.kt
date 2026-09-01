@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.accesscodes.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.SavedStateHandle
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.ui.screens.shared.list_of_rows.RowView
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import io.mockk.mockk
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * P4.6 — Paparazzi snapshots for the Access codes search surface. One
 * baseline per shell phase (recent / typing / results / empty), so the
 * masked row template + shell composition are locked against drift.
 *
 * Annotated `@Ignore` until baselines land — same bootstrap pattern as
 * `SupportTrainsSnapshotTest`: a follow-up records the PNGs via
 * `./gradlew paparazziRecord --tests "*AccessCodesSearchSnapshotTest*"`
 * and removes the annotation.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class AccessCodesSearchSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    private val vm =
        AccessCodesSearchViewModel(
            repo = mockk(relaxed = true),
            savedStateHandle = SavedStateHandle(mapOf(AccessCodesSearchViewModel.HOME_ID_KEY to "home-1")),
        )

    private val emptyState =
        EmptyStateContent(
            icon = PantopusIcon.Search,
            headline = "No matching codes",
            subcopy = "Try a different label or category, or check the spelling.",
        )

    private fun sample(
        id: String,
        accessType: String,
        label: String,
        value: String,
        notes: String? = null,
    ) = HomeAccessSecretDto(
        id = id,
        homeId = "home-1",
        accessType = accessType,
        label = label,
        secretValue = value,
        notes = notes,
    )

    @Test
    fun access_codes_search_recent_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<HomeAccessSecretDto>(
                    placeholder = "Search access codes",
                    query = "",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = false,
                    emptyState = emptyState,
                    row = { RowSlot(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun access_codes_search_typing_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<HomeAccessSecretDto>(
                    placeholder = "Search access codes",
                    query = "net",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = true,
                    emptyState = emptyState,
                    row = { RowSlot(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun access_codes_search_results_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<HomeAccessSecretDto>(
                    placeholder = "Search access codes",
                    query = "front",
                    onQueryChange = {},
                    results =
                        listOf(
                            sample("s1", "wifi", "Main network", "MaplePan@2025!", notes = "Household · 4 members"),
                            sample("s2", "alarm", "Disarm — front panel", "184729"),
                            sample("s4", "smart_lock", "Front door", "SmartCode-9"),
                        ),
                    isLoading = false,
                    emptyState = emptyState,
                    row = { RowSlot(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun access_codes_search_empty_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<HomeAccessSecretDto>(
                    placeholder = "Search access codes",
                    query = "zzzzzz",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = false,
                    emptyState = emptyState,
                    row = { RowSlot(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Composable
    private fun RowSlot(secret: HomeAccessSecretDto) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3),
        ) {
            RowView(row = vm.rowFor(secret))
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
