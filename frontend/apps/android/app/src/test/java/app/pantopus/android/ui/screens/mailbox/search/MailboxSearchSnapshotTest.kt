@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.mailbox.MailItem
import app.pantopus.android.ui.screens.mailbox.MailboxListViewModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowCardContext
import app.pantopus.android.ui.screens.shared.list_of_rows.RowView
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the Mailbox Search surface (P4.2). One baseline
 * per shell phase that carries new visuals — results (reused Mailbox
 * rows), typing-shimmer, and empty.
 *
 * Annotated `@Ignore` until baselines land so the first PR doesn't fail CI
 * on a missing image — the follow-up records baselines via
 * `./gradlew paparazziRecord --tests "*MailboxSearchSnapshotTest*"` and
 * removes the annotation.
 */
@Ignore("Baselines recorded in follow-up — see commit body")
class MailboxSearchSnapshotTest {
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
            headline = "No matching mail",
            subcopy = "Try a different sender, subject, or category.",
        )

    private val results =
        listOf(
            mail(
                id = "m1",
                type = "bill",
                mailType = "bill",
                subject = "Water bill",
                previewText = "Due June 1",
                sender = "City of Oakland",
            ),
            mail(
                id = "m2",
                type = "booklet",
                mailType = "booklet",
                displayTitle = "Welcome packet",
                previewText = "Booklet enclosed",
                sender = "Maria Kovacs",
                viewed = true,
            ),
            mail(
                id = "m3",
                type = "insurance",
                mailType = "insurance",
                subject = "Policy renewal",
                previewText = "Renew by July",
                sender = "Acme Insurance",
                viewed = true,
            ),
        )

    @Test
    fun mailbox_search_results_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search mail",
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
    fun mailbox_search_typing_phase_shimmer() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search mail",
                    query = "po",
                    onQueryChange = {},
                    results = emptyList<MailItem>(),
                    isLoading = true,
                    emptyState = emptyState,
                    row = { ResultRow(it) },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun mailbox_search_empty_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search mail",
                    query = "zzzzz",
                    onQueryChange = {},
                    results = emptyList<MailItem>(),
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
    private fun ResultRow(mail: MailItem) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
        ) {
            RowView(row = MailboxListViewModel.makeRow(mail) {}, cardContext = RowCardContext.Standalone)
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

    private fun mail(
        id: String,
        type: String = "general",
        mailType: String? = null,
        subject: String? = null,
        displayTitle: String? = null,
        previewText: String? = null,
        sender: String? = null,
        viewed: Boolean = false,
    ) = MailItem(
        id = id,
        recipientUserId = null,
        recipientHomeId = null,
        deliveryTargetType = null,
        deliveryTargetId = null,
        addressHomeId = null,
        attnUserId = null,
        attnLabel = null,
        deliveryVisibility = null,
        mailType = mailType,
        displayTitle = displayTitle,
        previewText = previewText,
        primaryAction = null,
        actionRequired = null,
        ackRequired = null,
        ackStatus = null,
        type = type,
        subject = subject,
        content = null,
        senderUserId = null,
        senderBusinessName = sender,
        senderAddress = null,
        viewed = viewed,
        viewedAt = null,
        archived = false,
        starred = false,
        payoutAmount = null,
        payoutStatus = null,
        category = null,
        tags = emptyList(),
        priority = "normal",
        attachments = null,
        expiresAt = null,
        createdAt = "2026-05-15T12:00:00Z",
    )
}
