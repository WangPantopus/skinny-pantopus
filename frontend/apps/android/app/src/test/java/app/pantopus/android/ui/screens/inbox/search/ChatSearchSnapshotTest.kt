@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.inbox.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.inbox.chat.ConversationIdentityChip
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the P4.3 Chat Search surface, driven through the
 * shared `SearchListShell`: typing-shimmer (loading), results (populated
 * with highlighted name + body snippets, all three identity treatments),
 * and empty (no matches).
 *
 * Ignored until baselines are recorded — this run had no Android SDK to
 * record against. Generate + commit, then drop `@Ignore`:
 * `./gradlew paparazziRecord --tests "*ChatSearchSnapshotTest*"`.
 */
@Ignore("P4.3 baselines pending paparazziRecord (no Android SDK in the authoring environment)")
class ChatSearchSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1400,
                    softButtons = false,
                ),
        )

    private val emptyState =
        EmptyStateContent(
            icon = PantopusIcon.Search,
            headline = "No matches",
            subcopy = "Try a name or a word from a message.",
        )

    @Test
    fun chat_search_typing_phase_shimmer() {
        paparazzi.snapshot {
            Root {
                SearchListShell<ChatSearchResult>(
                    placeholder = "Search people and messages",
                    query = "drill",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = true,
                    emptyState = emptyState,
                    row = { ChatSearchResultRow(it) {} },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun chat_search_results_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell(
                    placeholder = "Search people and messages",
                    query = "drill",
                    onQueryChange = {},
                    results = sampleResults(),
                    isLoading = false,
                    emptyState = emptyState,
                    row = { ChatSearchResultRow(it) {} },
                    onCancel = {},
                )
            }
        }
    }

    @Test
    fun chat_search_empty_phase() {
        paparazzi.snapshot {
            Root {
                SearchListShell<ChatSearchResult>(
                    placeholder = "Search people and messages",
                    query = "zzzzzz",
                    onQueryChange = {},
                    results = emptyList(),
                    isLoading = false,
                    emptyState =
                        EmptyStateContent(
                            icon = PantopusIcon.Search,
                            headline = "No matches",
                            subcopy = "We didn't find anything matching zzzzzz.",
                        ),
                    row = { ChatSearchResultRow(it) {} },
                    onCancel = {},
                )
            }
        }
    }

    private fun sampleResults(): List<ChatSearchResult> =
        listOf(
            ChatSearchResult(
                conversationId = "u1",
                kind = ChatSearchResultKind.Dm,
                displayName = "Maria Kovács",
                initials = "MK",
                identityChip = null,
                verified = true,
                snippet = "…can you bring the drill on Saturday morning?",
                matchedMessageId = "m1",
                query = "drill",
            ),
            ChatSearchResult(
                conversationId = "b1",
                kind = ChatSearchResultKind.Dm,
                displayName = "Dahlia's Petals",
                initials = "DP",
                identityChip = ConversationIdentityChip.Business,
                verified = true,
                snippet = "The drill bits you ordered are on the porch.",
                matchedMessageId = "m2",
                query = "drill",
            ),
            ChatSearchResult(
                conversationId = "g1",
                kind = ChatSearchResultKind.Group,
                displayName = "Rose Court Block",
                initials = "RC",
                identityChip = ConversationIdentityChip.Home,
                verified = false,
                snippet = "Anyone have a drill I can borrow this weekend?",
                matchedMessageId = "m3",
                query = "drill",
            ),
        )

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
