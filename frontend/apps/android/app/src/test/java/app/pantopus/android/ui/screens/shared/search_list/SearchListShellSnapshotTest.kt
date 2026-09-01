@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.shared.search_list

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the shared `SearchListShell`. One baseline
 * per phase (recent / typing / results / empty) — drift in any of
 * those layouts flags here before it lands in a real screen.
 *
 * Record new baselines: `./gradlew paparazziRecord --tests
 * "*SearchListShellSnapshotTest*"`.
 */
class SearchListShellSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1200,
                    softButtons = false,
                ),
        )

    private val emptyState =
        EmptyStateContent(
            icon = PantopusIcon.Search,
            headline = "No matches",
            subcopy = "Try a different keyword or a broader search.",
        )

    @Test
    fun search_list_recent_phase_with_persisted_queries() {
        paparazzi.snapshot {
            Root {
                SearchListShell<String>(
                    placeholder = "Search neighbors",
                    query = "",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = false,
                    recentQueries =
                        listOf(
                            "chimney sweep",
                            "drill bits",
                            "lawn mower",
                            "snow shovel",
                        ),
                    emptyState = emptyState,
                    row = { Text(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun search_list_recent_phase_empty() {
        paparazzi.snapshot {
            Root {
                SearchListShell<String>(
                    placeholder = "Search neighbors",
                    query = "",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = false,
                    recentQueries = emptyList(),
                    emptyState = emptyState,
                    row = { Text(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun search_list_typing_phase_shimmer() {
        paparazzi.snapshot {
            Root {
                SearchListShell<String>(
                    placeholder = "Search neighbors",
                    query = "chi",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = true,
                    recentQueries = emptyList(),
                    emptyState = emptyState,
                    row = { Text(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun search_list_results_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell<String>(
                    placeholder = "Search neighbors",
                    query = "maria",
                    onQueryChange = {},
                    results =
                        listOf(
                            "Maria Kovács",
                            "Maria Park",
                            "Marian Lee",
                            "Mario Romano",
                        ),
                    isLoading = false,
                    recentQueries = emptyList(),
                    emptyState = emptyState,
                    row = { result -> SampleResultRow(name = result) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun search_list_empty_phase_after_debounce() {
        paparazzi.snapshot {
            Root {
                SearchListShell<String>(
                    placeholder = "Search neighbors",
                    query = "zzzzzz",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = false,
                    recentQueries = emptyList(),
                    emptyState =
                        EmptyStateContent(
                            icon = PantopusIcon.Search,
                            headline = "No matches",
                            subcopy = "We didn't find anyone matching zzzzzz.",
                        ),
                    row = { Text(it) },
                    onCancel = {},
                )
            }
        }
    }

    // ─── Helpers ───────────────────────────────────────────

    @Composable
    private fun SampleResultRow(name: String) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = name,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
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
