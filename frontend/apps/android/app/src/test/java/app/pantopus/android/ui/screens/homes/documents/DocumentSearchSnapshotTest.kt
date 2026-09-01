@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.documents

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.ui.screens.shared.list_of_rows.RowCardContext
import app.pantopus.android.ui.screens.shared.list_of_rows.RowView
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test
import java.time.Instant

/**
 * Paparazzi snapshots for the Document Search surface (P4.5). One
 * baseline per shell phase that carries new visuals — results (reused
 * Documents rows + inline tag chips), typing-shimmer, and empty.
 *
 * Record baselines: `./gradlew paparazziRecord --tests
 * "*DocumentSearchSnapshotTest*"`.
 */
class DocumentSearchSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1200,
                    softButtons = false,
                ),
        )

    private val now: Instant = Instant.parse("2026-05-15T12:00:00Z")

    private val emptyState =
        EmptyStateContent(
            icon = PantopusIcon.Search,
            headline = "No documents match",
            subcopy = "Try a different title, tag, or category.",
        )

    private val results =
        listOf(
            dto("d1", "insurance", "Renters Policy.pdf", "renters,policy"),
            dto("d2", "lease", "Signed Lease.pdf", "signed,2026"),
            dto("d3", "warranty", "Fridge Warranty.pdf", "lg,kitchen"),
        )

    @Test
    fun document_search_results_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search documents",
                    query = "po",
                    onQueryChange = {},
                    results = results,
                    isLoading = false,
                    emptyState = emptyState,
                    row = { ResultRow(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun document_search_typing_phase_shimmer() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search documents",
                    query = "po",
                    onQueryChange = {},
                    results = emptyList<HomeDocumentDto>(),
                    isLoading = true,
                    emptyState = emptyState,
                    row = { ResultRow(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun document_search_empty_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search documents",
                    query = "zzzzz",
                    onQueryChange = {},
                    results = emptyList<HomeDocumentDto>(),
                    isLoading = false,
                    emptyState = emptyState,
                    row = { ResultRow(it) },
                    onCancel = {},
                )
            }
        }
    }

    // ─── Helpers ───────────────────────────────────────────

    @Composable
    private fun ResultRow(dto: HomeDocumentDto) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
        ) {
            RowView(
                row =
                    DocumentsViewModel.makeRow(
                        dto = dto,
                        now = now,
                        extraChips = DocumentSearchViewModel.tagChips(dto),
                        onTap = {},
                        onSecondary = {},
                    ),
                cardContext = RowCardContext.Standalone,
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

    private fun dto(
        id: String,
        docType: String,
        title: String,
        tags: String? = null,
    ): HomeDocumentDto =
        HomeDocumentDto(
            id = id,
            homeId = "home-1",
            fileId = null,
            docType = docType,
            title = title,
            storageBucket = null,
            storagePath = null,
            mimeType = "application/pdf",
            sizeBytes = 2_400_000,
            visibility = "members",
            details = tags?.let { mapOf("tags" to it) },
            createdBy = null,
            createdAt = "2026-05-10T00:00:00Z",
            updatedAt = null,
        )
}
