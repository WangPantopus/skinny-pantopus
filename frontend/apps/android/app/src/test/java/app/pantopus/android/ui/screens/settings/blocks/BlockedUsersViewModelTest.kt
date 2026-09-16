@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.blocks

import app.pantopus.android.data.api.models.settings.BlockedUserSummaryDto
import app.pantopus.android.data.api.models.settings.PrivacyBlockDto
import app.pantopus.android.data.api.models.settings.PrivacyBlocksResponse
import app.pantopus.android.data.api.models.settings.UserBlockEntryDto
import app.pantopus.android.data.api.models.settings.UserBlocksResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.privacy.PrivacyRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowPillTone
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import io.mockk.coEvery
import io.mockk.coVerify
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
    private val blocks: BlocksRepository = mockk()
    private val auth: AuthRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Default: no personal blocks. Cases that exercise the UserBlock half
        // override this.
        coEvery { blocks.blocked() } returns NetworkResult.Success(noPersonal)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(): BlockedUsersViewModel = BlockedUsersViewModel(privacy, blocks, auth)

    /** `GET /api/users/blocked` — flattened UserBlock rows (blocks.js:145). */
    private val twoPersonal =
        UserBlocksResponse(
            blocked =
                listOf(
                    UserBlockEntryDto(
                        id = "ub1",
                        userId = "u_carol",
                        username = "carol",
                        name = "Carol",
                        profilePictureUrl = null,
                        reason = "Harassment",
                        createdAt = "2026-05-03",
                    ),
                    UserBlockEntryDto(
                        id = "ub2",
                        userId = "u_dave",
                        username = "dave",
                        name = null,
                        profilePictureUrl = null,
                        reason = null,
                        createdAt = "2026-04-28",
                    ),
                ),
        )

    private val noPersonal = UserBlocksResponse(blocked = emptyList())

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
            // Both lists must fail before the screen reports an error.
            coEvery { blocks.blocked() } returns NetworkResult.Failure(NetworkError.Server(500, null))
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

    // ── N04: the personal-block (UserBlock) half of the screen ──────────

    /**
     * The regression this screen shipped with: a block made from a profile or
     * a chat writes UserBlock, and before N04 nothing here read that table, so
     * the row never appeared and could never be lifted.
     */
    @Test fun personalBlocksAppearInTheList() =
        runTest {
            coEvery { blocks.blocked() } returns NetworkResult.Success(twoPersonal)
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(blocks = emptyList()))
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val rows = loaded.sections[0].rows
            assertEquals(listOf("ub1", "ub2"), rows.map { it.id })
            assertEquals("Carol", rows[0].title)
            // No name on the second row — falls back to the @handle, the same
            // rule the privacy rows already use.
            assertEquals("@dave", rows[1].title)
            // Personal blocks are account-wide, so they carry no scope suffix.
            assertEquals("Blocked May 3, 2026", rows[0].subtitle)
        }

    /** Both contracts render into one list, personal first. */
    @Test fun bothContractsRenderInOneList() =
        runTest {
            coEvery { blocks.blocked() } returns NetworkResult.Success(twoPersonal)
            coEvery { privacy.blocks() } returns NetworkResult.Success(twoBlocks)
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("ub1", "ub2", "b1", "b2"), loaded.sections[0].rows.map { it.id })
            assertEquals("Blocked · 4", loaded.sections[0].header)
        }

    /**
     * Unblocking a personal block must address the UserBlock route by user id
     * — not the privacy route by block id.
     */
    @Test fun unblockPersonalBlockCallsUsersBlockDelete() =
        runTest {
            coEvery { blocks.blocked() } returns NetworkResult.Success(twoPersonal)
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(blocks = emptyList()))
            coEvery { blocks.unblock("u_carol") } returns NetworkResult.Success(Unit)
            val vm = viewModel()
            vm.load()
            vm.unblock("ub1")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("ub2"), loaded.sections[0].rows.map { it.id })
            coVerify(exactly = 1) { blocks.unblock("u_carol") }
            coVerify(exactly = 0) { privacy.deleteBlock(any()) }
        }

    /** A failed personal unblock restores the row, same as the privacy path. */
    @Test fun unblockPersonalBlockFailureRestoresRow() =
        runTest {
            coEvery { blocks.blocked() } returns NetworkResult.Success(twoPersonal)
            coEvery { privacy.blocks() } returns NetworkResult.Success(PrivacyBlocksResponse(blocks = emptyList()))
            coEvery { blocks.unblock("u_carol") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = viewModel()
            vm.load()
            vm.unblock("ub1")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(setOf("ub1", "ub2"), loaded.sections[0].rows.map { it.id }.toSet())
        }

    /**
     * One list failing must not hide the other — a personal block stays
     * visible and liftable when the Identity Firewall list is down.
     */
    @Test fun personalBlocksSurviveAPrivacyListFailure() =
        runTest {
            coEvery { blocks.blocked() } returns NetworkResult.Success(twoPersonal)
            coEvery { privacy.blocks() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("ub1", "ub2"), loaded.sections[0].rows.map { it.id })
        }

    /** And the reverse. */
    @Test fun privacyBlocksSurviveAPersonalListFailure() =
        runTest {
            coEvery { blocks.blocked() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { privacy.blocks() } returns NetworkResult.Success(twoBlocks)
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("b1", "b2"), loaded.sections[0].rows.map { it.id })
        }
}
