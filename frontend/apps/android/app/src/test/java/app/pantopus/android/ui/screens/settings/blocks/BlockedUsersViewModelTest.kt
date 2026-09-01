@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.blocks

import app.pantopus.android.data.api.models.settings.BlockedUserSummaryDto
import app.pantopus.android.data.api.models.settings.PrivacyBlockDto
import app.pantopus.android.data.api.models.settings.PrivacyBlocksResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.privacy.PrivacyRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowPillTone
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BlockedUsersViewModelTest {
    private val privacy: PrivacyRepository = mockk()
    private val auth: AuthRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(): BlockedUsersViewModel = BlockedUsersViewModel(privacy, auth)

    private val twoBlocks =
        PrivacyBlocksResponse(
            blocks =
                listOf(
                    PrivacyBlockDto(
                        id = "b1",
                        blockedUserId = "u_alice",
                        blockScope = "full",
                        reason = "Spam",
                        createdAt = "2026-05-01",
                        blocked = BlockedUserSummaryDto(id = "u_alice", username = "alice", name = "Alice", profilePictureUrl = null),
                    ),
                    PrivacyBlockDto(
                        id = "b2",
                        blockedUserId = "u_bob",
                        blockScope = "search_only",
                        reason = null,
                        createdAt = "2026-05-02",
                        blocked = BlockedUserSummaryDto(id = "u_bob", username = "bob", name = "Bob", profilePictureUrl = null),
                    ),
                ),
        )

    @Test fun loadEmptyProducesEmptyState() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(blocks = emptyList()))
            val vm = viewModel()
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Empty, got $state", state is ListOfRowsUiState.Empty)
        }

    @Test fun loadPopulatedProducesLoadedRows() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(twoBlocks)
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.size)
            // A14.4 — single card with a privacy-contract helper below it.
            assertEquals(SectionStyle.Card, loaded.sections[0].style)
            assertNotNull(loaded.sections[0].footer)
            val rows = loaded.sections[0].rows
            assertEquals(listOf("b1", "b2"), rows.map { it.id })
            assertEquals("Alice", rows[0].title)
            // A14.4 source-context line: "Blocked <date>" + scope context.
            // `full` scope carries no suffix; `search_only` appends "Search only".
            assertEquals("Blocked May 1, 2026", rows[0].subtitle)
            assertEquals("Blocked May 2, 2026 · Search only", rows[1].subtitle)
            // Trailing is the neutral Unblock pill (replaces the kebab).
            val pill = rows[0].trailing as RowTrailing.PillButton
            assertEquals("Unblock", pill.label)
            assertEquals(RowPillTone.Neutral, pill.tone)
        }

    @Test fun loadFailureProducesErrorState() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = viewModel()
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Error, got $state", state is ListOfRowsUiState.Error)
        }

    @Test fun unblockSuccessRemovesRow() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(twoBlocks)
            coEvery { privacy.deleteBlock("b1") } returns NetworkResult.Success(Unit)
            val vm = viewModel()
            vm.load()
            vm.unblock("b1")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("b2"), loaded.sections[0].rows.map { it.id })
        }

    @Test fun unblockFailureRestoresRow() =
        runTest {
            coEvery { privacy.blocks() } returns NetworkResult.Success(twoBlocks)
            coEvery { privacy.deleteBlock("b1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = viewModel()
            vm.load()
            vm.unblock("b1")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(setOf("b1", "b2"), loaded.sections[0].rows.map { it.id }.toSet())
        }
}
