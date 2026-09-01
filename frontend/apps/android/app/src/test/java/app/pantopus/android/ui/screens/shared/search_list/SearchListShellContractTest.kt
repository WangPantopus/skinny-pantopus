@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.search_list

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import app.pantopus.android.ui.theme.PantopusIcon
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Contract tests for the SearchListShell support types.
 *
 * - [resolvePhase] is a pure state-machine helper — locked here against
 *   regressions in the recent/typing/results/empty transitions.
 * - [EmptyStateContent] is a passive payload — locked for data-class
 *   semantics so callers can compare instances in tests.
 * - [RecentQueriesStore] is exercised against a real `DataStore<Preferences>`
 *   backed by a temp file so the move-to-front / dedup / cap / clear
 *   behaviour is verified end-to-end (not just the in-memory branch).
 */
class SearchListShellContractTest {
    @get:Rule
    val tempFolder: TemporaryFolder = TemporaryFolder()

    // ─── resolvePhase ──────────────────────────────────────

    @Test fun resolves_to_recent_when_query_is_blank() {
        val phase =
            resolvePhase(
                query = "",
                debouncedQuery = "",
                isLoading = false,
                hasResults = false,
            )
        assertEquals(SearchListPhase.Recent, phase)
    }

    @Test fun resolves_to_recent_when_query_is_whitespace() {
        val phase =
            resolvePhase(
                query = "   ",
                debouncedQuery = "   ",
                isLoading = false,
                hasResults = false,
            )
        assertEquals(SearchListPhase.Recent, phase)
    }

    @Test fun resolves_to_typing_while_loading() {
        val phase =
            resolvePhase(
                query = "chi",
                debouncedQuery = "chi",
                isLoading = true,
                hasResults = false,
            )
        assertEquals(SearchListPhase.Typing, phase)
    }

    @Test fun resolves_to_results_when_results_present() {
        val phase =
            resolvePhase(
                query = "maria",
                debouncedQuery = "maria",
                isLoading = false,
                hasResults = true,
            )
        assertEquals(SearchListPhase.Results, phase)
    }

    @Test fun resolves_to_empty_after_debounce_catches_up() {
        val phase =
            resolvePhase(
                query = "zzzz",
                debouncedQuery = "zzzz",
                isLoading = false,
                hasResults = false,
            )
        assertEquals(SearchListPhase.Empty, phase)
    }

    @Test fun resolves_to_typing_while_debounce_is_pending() {
        val phase =
            resolvePhase(
                query = "zzzz",
                debouncedQuery = "zzz",
                isLoading = false,
                hasResults = false,
            )
        assertEquals(SearchListPhase.Typing, phase)
    }

    // ─── EmptyStateContent ─────────────────────────────────

    @Test fun empty_state_content_preserves_fields() {
        val content =
            EmptyStateContent(
                icon = PantopusIcon.Search,
                headline = "Headline",
                subcopy = "Subcopy",
            )
        assertEquals(PantopusIcon.Search, content.icon)
        assertEquals("Headline", content.headline)
        assertEquals("Subcopy", content.subcopy)
    }

    @Test fun empty_state_content_is_data_class() {
        val a = EmptyStateContent(PantopusIcon.Search, "A", "B")
        val b = EmptyStateContent(PantopusIcon.Search, "A", "B")
        assertEquals(a, b)
    }

    // ─── RecentQueriesStore ────────────────────────────────

    private fun makeStore(
        key: String = "search.test.recent",
        limit: Int = 6,
        fileName: String = "recents-${System.nanoTime()}.preferences_pb",
    ): RecentQueriesStore {
        val file: File = tempFolder.newFile(fileName)
        val dataStore =
            PreferenceDataStoreFactory.create(produceFile = { file })
        return RecentQueriesStore(
            dataStore = dataStore,
            userDefaultsKey = key,
            limit = limit,
        )
    }

    @Test fun record_persists_query() =
        runTest {
            val store = makeStore()
            store.record("chimney sweep")
            assertEquals(listOf("chimney sweep"), store.recentQueries.first())
        }

    @Test fun record_moves_to_front_on_duplicate() =
        runTest {
            val store = makeStore()
            store.record("a")
            store.record("b")
            store.record("c")
            store.record("a")
            assertEquals(listOf("a", "c", "b"), store.recentQueries.first())
        }

    @Test fun record_is_case_insensitive() =
        runTest {
            val store = makeStore()
            store.record("Chimney Sweep")
            store.record("chimney sweep")
            assertEquals(listOf("chimney sweep"), store.recentQueries.first())
        }

    @Test fun record_ignores_empty_and_whitespace() =
        runTest {
            val store = makeStore()
            store.record("")
            store.record("   ")
            store.record("\n\t")
            assertTrue(store.recentQueries.first().isEmpty())
        }

    @Test fun record_trims_whitespace() =
        runTest {
            val store = makeStore()
            store.record("  drill bits  ")
            assertEquals(listOf("drill bits"), store.recentQueries.first())
        }

    @Test fun record_caps_at_limit() =
        runTest {
            val store = makeStore(limit = 3)
            store.record("a")
            store.record("b")
            store.record("c")
            store.record("d")
            assertEquals(listOf("d", "c", "b"), store.recentQueries.first())
        }

    @Test fun clear_wipes_persisted_queries() =
        runTest {
            val store = makeStore()
            store.record("a")
            store.record("b")
            store.clear()
            assertTrue(store.recentQueries.first().isEmpty())
        }

    @Test fun load_on_fresh_key_returns_empty() =
        runTest {
            val store = makeStore(key = "search.never.set")
            assertTrue(store.recentQueries.first().isEmpty())
        }

    @Test fun stores_with_different_keys_are_independent() =
        runTest {
            // Same DataStore file is fine — different preference keys
            // scope the queries.
            val file: File = tempFolder.newFile("shared.preferences_pb")
            val shared =
                PreferenceDataStoreFactory.create(produceFile = { file })
            val a =
                RecentQueriesStore(
                    dataStore = shared,
                    userDefaultsKey = "search.surfaceA.recent",
                )
            val b =
                RecentQueriesStore(
                    dataStore = shared,
                    userDefaultsKey = "search.surfaceB.recent",
                )
            a.record("only-on-a")
            assertEquals(listOf("only-on-a"), a.recentQueries.first())
            assertTrue(b.recentQueries.first().isEmpty())
        }

    @Test fun record_preserves_queries_with_spaces_and_punctuation() =
        runTest {
            val store = makeStore()
            store.record("65″ TV mount — 2 anchors")
            store.record("plumber, 24/7")
            assertEquals(
                listOf("plumber, 24/7", "65″ TV mount — 2 anchors"),
                store.recentQueries.first(),
            )
        }
}
