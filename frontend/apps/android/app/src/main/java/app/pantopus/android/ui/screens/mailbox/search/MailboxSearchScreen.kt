@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.search

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.mailbox.mailbox_root.MailPieceRow
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Mailbox search (Mail tab, receiving): searched on the server over all the person's mail, each result drawn as its
 * piece. Hosts the shared `SearchListShell` (P4.1).
 *
 * @param onOpenMail Invoked when a result is tapped.
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
    val isLoadingMore by viewModel.isLoadingMore.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenMail = onOpenMail)
        viewModel.load()
    }

    SearchListShell(
        placeholder = "Search all your mail",
        query = query,
        onQueryChange = viewModel::onQueryChange,
        results = results,
        isLoading = isLoading,
        emptyState =
            EmptyStateContent(
                icon = PantopusIcon.Search,
                headline = "No mail matches",
                subcopy = "Try a sender's name or a word from the letter. Search covers all your mail, filed and archived too.",
            ),
        row = { piece ->
            Column {
                MailPieceRow(piece, onOpen = { viewModel.openMail(piece.id) })
                if (piece.id == results.lastOrNull()?.id && hasMore) {
                    error?.let { Text(it) }
                    TextButton(
                        onClick = viewModel::loadMore,
                        enabled = !isLoadingMore,
                        modifier = Modifier.testTag("mailboxSearchMore"),
                    ) {
                        Text(if (isLoadingMore) "Loading…" else if (error == null) "Show more" else "Try again")
                    }
                }
            }
        },
        onCancel = onCancel,
        errorContent =
            error?.takeIf { results.isEmpty() }?.let { message ->
                {
                    ErrorState(
                        headline = "Search didn't work",
                        message = message,
                        modifier = Modifier.testTag("mailboxSearchError"),
                        onRetry = viewModel::retry,
                    )
                }
            },
    )
}
