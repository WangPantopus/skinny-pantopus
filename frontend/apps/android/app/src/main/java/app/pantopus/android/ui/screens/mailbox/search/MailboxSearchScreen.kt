@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.search

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.RowCardContext
import app.pantopus.android.ui.screens.shared.list_of_rows.RowView
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

/**
 * P4.2 — Mailbox Search surface. Hosts the shared `SearchListShell` (P4.1)
 * and renders each match with the reused Mailbox row (`RowView`). Replaces
 * the "Mail search" placeholder reached from `MailboxListScreen`.
 *
 * @param onOpenMail Invoked when a result row is tapped.
 * @param onCancel Invoked when the shell's back control fires.
 */
@Composable
fun MailboxSearchScreen(
    onOpenMail: (String) -> Unit,
    onCancel: () -> Unit,
    viewModel: MailboxSearchViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenMail = onOpenMail)
        viewModel.load()
    }

    SearchListShell(
        placeholder = "Search mail",
        query = query,
        onQueryChange = viewModel::onQueryChange,
        results = results,
        isLoading = isLoading,
        emptyState =
            EmptyStateContent(
                icon = PantopusIcon.Search,
                headline = "No matching mail",
                subcopy = "Try a different sender, subject, or category.",
            ),
        row = { mail ->
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            ) {
                RowView(row = viewModel.rowModel(mail), cardContext = RowCardContext.Standalone)
            }
        },
        onCancel = onCancel,
    )
}
