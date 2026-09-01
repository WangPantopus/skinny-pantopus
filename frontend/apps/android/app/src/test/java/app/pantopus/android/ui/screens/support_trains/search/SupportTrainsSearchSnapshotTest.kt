@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.support_trains.SupportTrainListItemDto
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
 * P4.6 — Paparazzi snapshots for the Support Trains search surface. One
 * baseline per shell phase (recent / typing / results / empty), so the
 * row template + shell composition are locked against drift.
 *
 * Annotated `@Ignore` until baselines land — same bootstrap pattern as
 * `SupportTrainsSnapshotTest`: the first PR ships the test so the gate
 * exists; a follow-up records the PNGs via
 * `./gradlew paparazziRecord --tests "*SupportTrainsSearchSnapshotTest*"`
 * and removes the annotation.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class SupportTrainsSearchSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    private val vm = SupportTrainsSearchViewModel(mockk(relaxed = true))

    private val emptyState =
        EmptyStateContent(
            icon = PantopusIcon.Search,
            headline = "No matching trains",
            subcopy = "Try a different name or train type, or check the spelling.",
        )

    private fun sample(
        id: String,
        recipient: String,
        type: String,
        status: String,
        filled: Int,
        total: Int,
    ) = SupportTrainListItemDto(
        id = id,
        title = recipient,
        status = status,
        myRole = "organizer",
        supportTrainType = type,
        slotsFilled = filled,
        slotsTotal = total,
        recipientName = recipient,
    )

    @Test
    fun support_trains_search_recent_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<SupportTrainListItemDto>(
                    placeholder = "Search support trains",
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
    fun support_trains_search_typing_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<SupportTrainListItemDto>(
                    placeholder = "Search support trains",
                    query = "che",
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
    fun support_trains_search_results_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<SupportTrainListItemDto>(
                    placeholder = "Search support trains",
                    query = "for",
                    onQueryChange = {},
                    results =
                        listOf(
                            sample("st1", "For the Chen family", "meal_support", "filling", 12, 18),
                            sample("st2", "For Daniel R.", "ride_support", "active", 6, 14),
                            sample("st3", "For Mrs. Alvarez", "pet_care", "wrapping", 22, 24),
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
    fun support_trains_search_empty_phase() {
        paparazzi.snapshot {
            Frame {
                SearchListShell<SupportTrainListItemDto>(
                    placeholder = "Search support trains",
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
    private fun RowSlot(train: SupportTrainListItemDto) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3),
        ) {
            RowView(row = vm.rowFor(train))
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
