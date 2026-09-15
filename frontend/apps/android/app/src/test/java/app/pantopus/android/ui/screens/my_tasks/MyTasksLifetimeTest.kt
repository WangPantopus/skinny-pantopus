@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.my_tasks

import app.pantopus.android.data.api.models.gigs.BoostGigResponse
import app.pantopus.android.data.api.models.gigs.CompleteGigResponse
import app.pantopus.android.data.api.models.gigs.MyGigDto
import app.pantopus.android.data.api.models.gigs.MyGigsResponse
import app.pantopus.android.data.api.models.gigs.RebookableGigDto
import app.pantopus.android.data.api.models.gigs.RebookableGigsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigExtrasRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.checkout.GigCheckoutIdentity
import app.pantopus.android.ui.screens.gigs.checkout.gigIdentityFixture
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MyTasksLifetimeTest {
    private val gigsRepo: GigsRepository = mockk()

    @Before
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm(identity: () -> Pair<String, String?>? = { "u_me" to "test-session" }) =
        MyTasksViewModel(gigsRepo, gigIdentityFixture(identity))

    private fun dto(
        id: String,
        status: String = "open",
    ) = MyGigDto(id = id, title = "Work", status = status, userId = "u_me")

    @Test
    fun rebook_history_clears_on_signout_and_loads_current_owner() =
        runTest {
            var identity: Pair<String, String?>? = "u_me" to "session"
            val identities = gigIdentityFixture { identity }
            val changes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
            every { identities.changes } returns changes
            val repo: GigExtrasRepository = mockk()
            var reads = 0
            coEvery { repo.rebookable() } coAnswers {
                reads += 1
                NetworkResult.Success(RebookableGigsResponse(listOf(RebookableGigDto(id = "owner-$reads"))))
            }
            val rail = RebookRailViewModel(repo, identities)
            rail.load()
            val old = rail.state.value as RebookRailViewModel.State.Loaded
            var opened = 0
            identity = null
            changes.emit(Unit)
            assertTrue(rail.state.value is RebookRailViewModel.State.Unavailable)
            rail.rebook(old.items.first(), old.viewGeneration) { opened += 1 }
            assertEquals(0, opened)
            assertEquals(1, reads)
            identity = "new-owner" to "new-session"
            changes.emit(Unit)
            val current = rail.state.value as RebookRailViewModel.State.Loaded
            assertEquals("owner-2", current.items.first().id)
            rail.rebook(current.items.first(), current.viewGeneration) { opened += 1 }
            assertEquals(1, opened)
        }

    @Test
    fun retired_rebook_read_cannot_populate_reentered_view() =
        runTest {
            val repo: GigExtrasRepository = mockk()
            val pending = CompletableDeferred<NetworkResult<RebookableGigsResponse>>()
            var reads = 0
            coEvery { repo.rebookable() } coAnswers {
                reads += 1
                if (reads == 1) {
                    pending.await()
                } else {
                    NetworkResult.Success(RebookableGigsResponse(listOf(RebookableGigDto(id = "new"))))
                }
            }
            val rail = RebookRailViewModel(repo, gigIdentityFixture())
            rail.load()
            rail.retire()
            rail.load()
            pending.complete(NetworkResult.Success(RebookableGigsResponse(listOf(RebookableGigDto(id = "old")))))
            assertEquals("new", (rail.state.value as RebookRailViewModel.State.Loaded).items.first().id)
        }

    @Test
    fun rebook_action_requires_the_current_view_even_when_history_is_identical() =
        runTest {
            val repo: GigExtrasRepository = mockk()
            coEvery { repo.rebookable() } returns NetworkResult.Success(RebookableGigsResponse(listOf(RebookableGigDto(id = "g1"))))
            val rail = RebookRailViewModel(repo, gigIdentityFixture())
            rail.load()
            val old = rail.state.value as RebookRailViewModel.State.Loaded
            rail.retire()
            rail.load()
            val current = rail.state.value as RebookRailViewModel.State.Loaded
            assertEquals(old.items, current.items)
            assertTrue(old != current)
            var opened = 0
            rail.rebook(old.items.first(), old.viewGeneration) { opened += 1 }
            assertEquals(0, opened)
            rail.rebook(current.items.first(), current.viewGeneration) { opened += 1 }
            assertEquals(1, opened)
        }

    @Test
    fun older_rebook_response_cannot_replace_newer_history() =
        runTest {
            val repo: GigExtrasRepository = mockk()
            val pending = CompletableDeferred<NetworkResult<RebookableGigsResponse>>()
            var reads = 0
            coEvery { repo.rebookable() } coAnswers {
                reads += 1
                if (reads == 1) {
                    pending.await()
                } else {
                    NetworkResult.Success(RebookableGigsResponse(listOf(RebookableGigDto(id = "new"))))
                }
            }
            val rail = RebookRailViewModel(repo, gigIdentityFixture())
            rail.load()
            rail.refresh()
            pending.complete(NetworkResult.Success(RebookableGigsResponse(listOf(RebookableGigDto(id = "old")))))
            assertEquals("new", (rail.state.value as RebookRailViewModel.State.Loaded).items.first().id)
        }

    @Test
    fun failed_boost_cannot_restore_a_list_replaced_by_refresh() =
        runTest {
            val pending = CompletableDeferred<NetworkResult<BoostGigResponse>>()
            var reads = 0
            coEvery { gigsRepo.myGigs(any(), any()) } coAnswers {
                reads += 1
                val id = if (reads == 1) "old" else "new"
                NetworkResult.Success(MyGigsResponse(gigs = listOf(dto(id = id))))
            }
            coEvery { gigsRepo.boostGig("old") } coAnswers { pending.await() }
            val viewModel = vm()
            viewModel.load()
            viewModel.boost(dto(id = "old"))
            viewModel.refresh()
            assertEquals("new", (viewModel.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first().id)
            pending.complete(NetworkResult.Failure(NetworkError.Server(503, "Boost failed")))
            assertEquals("new", (viewModel.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first().id)
        }

    @Test
    fun response_order_is_rechecked_after_waiting_for_session_identity() =
        runTest {
            val identities = gigIdentityFixture()
            val identity = GigCheckoutIdentity("u_me", "session", "https://api.example.invalid/")
            val pending = CompletableDeferred<Unit>()
            var identityReads = 0
            coEvery { identities.paymentIdentity() } coAnswers {
                identityReads += 1
                if (identityReads == 4) pending.await()
                identity
            }
            var reads = 0
            coEvery { gigsRepo.myGigs(any(), any()) } coAnswers {
                reads += 1
                NetworkResult.Success(MyGigsResponse(gigs = listOf(dto(id = "read-$reads"))))
            }
            val viewModel = MyTasksViewModel(gigsRepo, identities)
            viewModel.load()
            viewModel.refresh()
            assertEquals(4, identityReads)
            viewModel.refresh()
            assertEquals(6, identityReads)
            pending.complete(Unit)
            val loaded = viewModel.state.value as ListOfRowsUiState.Loaded
            assertEquals("read-3", loaded.sections.first().rows.first().id)
        }

    @Test
    fun rebinding_screen_callbacks_retires_held_confirmation() =
        runTest {
            val loaded = dto(id = "g1", status = "completed").copy(completionReview = "loaded-review")
            val pending = CompletableDeferred<NetworkResult<CompleteGigResponse>>()
            coEvery { gigsRepo.myGigs(any(), any()) } returns NetworkResult.Success(MyGigsResponse(gigs = listOf(loaded)))
            coEvery { gigsRepo.completeGigAsPoster("g1", "loaded-review") } coAnswers { pending.await() }
            var opened = 0
            val viewModel = vm()
            viewModel.bindCallbacks({ opened += 1 }, {}, {}, {}, {}, {}, {})
            viewModel.load()
            viewModel.markComplete(loaded)
            viewModel.bindCallbacks({ opened += 1 }, {}, {}, {}, {}, {}, {})
            pending.complete(NetworkResult.Failure(NetworkError.Server(503, "Unknown result")))
            assertEquals(0, opened)
        }

    @Test
    fun held_confirmation_cannot_navigate_into_replacement_session() =
        runTest {
            var identity: Pair<String, String?>? = "u_me" to "old-session"
            val loaded = dto(id = "g1", status = "completed").copy(completionReview = "loaded-review")
            val pending = CompletableDeferred<NetworkResult<CompleteGigResponse>>()
            coEvery { gigsRepo.myGigs(any(), any()) } returns NetworkResult.Success(MyGigsResponse(gigs = listOf(loaded)))
            coEvery { gigsRepo.completeGigAsPoster("g1", "loaded-review") } coAnswers { pending.await() }
            var opened = 0
            val viewModel = vm { identity }
            viewModel.bindCallbacks({ opened += 1 }, {}, {}, {}, {}, {}, {})
            viewModel.load()
            viewModel.markComplete(loaded)
            identity = "u_me" to "new-session"
            pending.complete(NetworkResult.Failure(NetworkError.Server(503, "Unknown result")))
            viewModel.markComplete(loaded)
            assertEquals(0, opened)
            coVerify(exactly = 1) { gigsRepo.completeGigAsPoster(any(), any()) }
            coVerify(exactly = 1) { gigsRepo.myGigs(any(), any()) }
        }

    @Test
    fun identity_changes_clear_private_rows_and_reject_older_response() =
        runTest {
            var identity: Pair<String, String?>? = "u_me" to "old-session"
            val changes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
            val identities = gigIdentityFixture { identity }
            every { identities.changes } returns changes
            val pending = CompletableDeferred<NetworkResult<MyGigsResponse>>()
            var reads = 0
            coEvery { gigsRepo.myGigs(any(), any()) } coAnswers {
                reads += 1
                when (reads) {
                    1 -> NetworkResult.Success(MyGigsResponse(gigs = listOf(dto(id = "old"))))
                    2 -> pending.await()
                    else -> NetworkResult.Success(MyGigsResponse(gigs = listOf(dto(id = "new"))))
                }
            }
            val viewModel = MyTasksViewModel(gigsRepo, identities)
            viewModel.load()
            viewModel.refresh()
            identity = null
            changes.emit(Unit)
            assertTrue(viewModel.state.value is ListOfRowsUiState.Error)
            assertNull(viewModel.banner.value)
            assertNull(viewModel.fab.value)
            assertEquals(0, viewModel.tabs.value.sumOf { it.count ?: 0 })
            assertEquals(2, reads)
            identity = "other-owner" to "new-session"
            changes.emit(Unit)
            pending.complete(NetworkResult.Success(MyGigsResponse(gigs = listOf(dto(id = "stale")))))
            val loaded = viewModel.state.value as ListOfRowsUiState.Loaded
            assertEquals("new", loaded.sections.first().rows.first().id)
            assertEquals(3, reads)
        }

    @Test
    fun departed_rows_stay_retired_after_same_session_reentry() =
        runTest {
            coEvery { gigsRepo.myGigs(any(), any()) } returns NetworkResult.Success(MyGigsResponse(gigs = listOf(dto(id = "g1"))))
            var opened = 0
            val viewModel = vm()
            viewModel.bindCallbacks({ opened += 1 }, {}, {}, {}, {}, {}, {})
            viewModel.load()
            val old = (viewModel.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            viewModel.retire()
            viewModel.load()
            coVerify(exactly = 1) { gigsRepo.myGigs(any(), any()) }
            viewModel.bindCallbacks({ opened += 1 }, {}, {}, {}, {}, {}, {})
            viewModel.load()
            old.onTap?.invoke()
            assertEquals(0, opened)
            val current = (viewModel.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            current.onTap?.invoke()
            assertEquals(1, opened)
        }

    @Test
    fun departed_empty_state_cannot_open_composer_after_reentry() =
        runTest {
            coEvery { gigsRepo.myGigs(any(), any()) } returns NetworkResult.Success(MyGigsResponse(gigs = emptyList()))
            var opened = 0
            val viewModel = vm()
            viewModel.bindCallbacks({}, {}, {}, {}, {}, { opened += 1 }, {})
            viewModel.load()
            val old = viewModel.state.value as ListOfRowsUiState.Empty
            viewModel.retire()
            viewModel.bindCallbacks({}, {}, {}, {}, {}, { opened += 1 }, {})
            viewModel.load()
            old.onCta?.invoke()
            assertEquals(0, opened)
            (viewModel.state.value as ListOfRowsUiState.Empty).onCta?.invoke()
            assertEquals(1, opened)
        }
}
