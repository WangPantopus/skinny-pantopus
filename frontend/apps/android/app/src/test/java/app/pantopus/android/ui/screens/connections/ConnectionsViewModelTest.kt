@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.connections

import app.pantopus.android.data.api.models.connections.BlockedRelationshipsResponse
import app.pantopus.android.data.api.models.connections.SentRequestsResponse
import app.pantopus.android.data.api.models.relationships.PendingRequestDto
import app.pantopus.android.data.api.models.relationships.PendingRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.models.relationships.RelationshipDto
import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import app.pantopus.android.data.api.models.relationships.RelationshipsListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connections.ConnectionsRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

@OptIn(ExperimentalCoroutinesApi::class)
class ConnectionsViewModelTest {
    private val repo: RelationshipsRepository = mockk()

    // S5 — Sent / Blocked / disconnect / unblock come from their own
    // repository. Default to empty lists so the pre-existing cases keep
    // asserting the same All / Neighbors / Pending behaviour.
    private val connectionsRepo: ConnectionsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { connectionsRepo.sentRequests() } returns
            NetworkResult.Success(SentRequestsResponse(requests = emptyList()))
        coEvery { connectionsRepo.blocked() } returns
            NetworkResult.Success(BlockedRelationshipsResponse(blocked = emptyList()))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun user(
        id: String,
        name: String,
        city: String? = "Elm Park",
        state: String? = "OR",
    ) = RelationshipUserDto(
        id = id,
        username = name.lowercase().replace(" ", ""),
        name = name,
        firstName = name.split(" ").first(),
        lastName = name.split(" ").drop(1).joinToString(" ").ifEmpty { null },
        profilePictureUrl = null,
        city = city,
        state = state,
    )

    private fun rel(
        id: String,
        otherUser: RelationshipUserDto,
        acceptedAt: String = "2026-05-12T11:00:00Z",
    ) = RelationshipDto(
        id = id,
        status = "accepted",
        createdAt = "2026-05-12T10:00:00Z",
        respondedAt = acceptedAt,
        acceptedAt = acceptedAt,
        blockedBy = null,
        direction = "received",
        otherUser = otherUser,
    )

    private fun pending(
        id: String,
        requester: RelationshipUserDto,
    ) = PendingRequestDto(
        id = id,
        status = "pending",
        createdAt = "2026-05-15T11:30:00Z",
        requester = requester,
    )

    private val acceptedTwo =
        RelationshipsListResponse(
            relationships =
                listOf(
                    rel("r1", user("u_a", "Maria Kovacs")),
                    rel("r2", user("u_b", "David Chen", city = null, state = null)),
                ),
        )
    private val pendingOne =
        PendingRequestsResponse(
            requests =
                listOf(
                    pending("req1", user("u_c", "Priya Shah", city = "Burnside")),
                ),
        )
    private val emptyAccepted = RelationshipsListResponse(relationships = emptyList())
    private val emptyPending = PendingRequestsResponse(requests = emptyList())

    // MARK: - Lifecycle

    @Test
    fun load_empty_transitions_to_empty_all_tab() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(emptyAccepted)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(emptyPending)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No connections yet", empty.headline)
            assertEquals("Find people", empty.ctaTitle)
        }

    @Test
    fun load_populated_transitions_to_loaded() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(2, loaded.sections.first().rows.size)
        }

    @Test
    fun both_fetches_failing_transitions_to_error() =
        runTest {
            // Error is reserved for "nothing loaded at all". Since the Sent
            // and Blocked tabs landed, that means all four fetches must fail —
            // any one succeeding still gives the user a usable screen.
            coEvery { repo.list(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { repo.pendingRequests() } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { connectionsRepo.sentRequests() } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { connectionsRepo.blocked() } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun one_fetch_failing_still_shows_pending_data() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            // All tab is empty because accepted fetch failed.
            val allState = vm.state.value
            assertTrue(allState is ListOfRowsUiState.Empty)
            // Pending tab still has data.
            vm.selectTab(ConnectionsTab.PENDING)
            val pendingState = vm.state.value
            assertTrue(pendingState is ListOfRowsUiState.Loaded)
            val loaded = pendingState as ListOfRowsUiState.Loaded
            assertEquals("req1", loaded.sections.first().rows.first().id)
        }

    // MARK: - Tabs

    @Test
    fun tabs_expose_all_neighbors_pending_with_counts() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            val tabs = vm.tabs.value
            assertEquals(5, tabs.size)
            assertEquals(ConnectionsTab.ALL, tabs[0].id)
            assertEquals(2, tabs[0].count)
            assertEquals(ConnectionsTab.NEIGHBORS, tabs[1].id)
            // u_b has no city → neighbors = 1
            assertEquals(1, tabs[1].count)
            assertEquals(ConnectionsTab.PENDING, tabs[2].id)
            assertEquals(1, tabs[2].count)
            // S5 — the two tabs RN has and native was missing.
            assertEquals(ConnectionsTab.SENT, tabs[3].id)
            assertEquals(ConnectionsTab.BLOCKED, tabs[4].id)
        }

    @Test
    fun neighbors_tab_filters_out_users_without_city() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.selectTab(ConnectionsTab.NEIGHBORS)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.first().rows.size)
            assertEquals("r1", loaded.sections.first().rows.first().id)
        }

    @Test
    fun empty_pending_shows_mailbox_empty_copy() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(emptyPending)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.selectTab(ConnectionsTab.PENDING)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No pending requests", empty.headline)
        }

    // MARK: - Search

    @Test
    fun search_filters_accepted_by_name() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.updateSearch("david")
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.first().rows.size)
            assertEquals("David Chen", loaded.sections.first().rows.first().title)
        }

    @Test
    fun search_filters_pending_by_city() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.updateSearch("burnside")
            vm.selectTab(ConnectionsTab.PENDING)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.first().rows.size)
            assertEquals("req1", loaded.sections.first().rows.first().id)
        }

    // MARK: - Accept (optimistic)

    @Test
    fun accept_optimistically_removes_pending_and_bumps_all() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            coEvery { repo.accept("req1") } returns NetworkResult.Success(RelationshipActionEcho())
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            assertEquals(2, vm.tabs.value[0].count)
            assertEquals(1, vm.tabs.value[2].count)
            vm.accept("req1")
            assertEquals(3, vm.tabs.value[0].count)
            assertEquals(0, vm.tabs.value[2].count)
        }

    @Test
    fun accept_rolls_back_on_failure() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            coEvery { repo.accept("req1") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.accept("req1")
            assertEquals(2, vm.tabs.value[0].count)
            assertEquals(1, vm.tabs.value[2].count)
        }

    // MARK: - Reject (optimistic)

    @Test
    fun reject_optimistically_removes_pending() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            coEvery { repo.reject("req1") } returns NetworkResult.Success(RelationshipActionEcho())
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.reject("req1")
            assertEquals(0, vm.tabs.value[2].count)
            // All count unchanged.
            assertEquals(2, vm.tabs.value[0].count)
        }

    @Test
    fun reject_rolls_back_on_failure() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            coEvery { repo.reject("req1") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            vm.load()
            vm.reject("req1")
            assertEquals(1, vm.tabs.value[2].count)
        }

    // MARK: - Row mapping

    @Test
    fun accepted_row_uses_avatar_with_verified_and_circular_message_action() {
        val vm = ConnectionsViewModel(repo, connectionsRepo)
        val row =
            vm.rowForAccepted(
                rel("r", user("u", "Maria Kovacs", city = "Elm Park")),
                now = Instant.parse("2026-05-15T12:00:00Z"),
                zone = ZoneId.of("UTC"),
            )
        assertEquals("Maria Kovacs", row.title)
        assertEquals("Elm Park, OR", row.subtitle)
        assertEquals(PantopusIcon.MapPin, row.subtitleIcon)
        assertEquals(PantopusIcon.UserPlus, row.bodyIcon)
        val leading = row.leading
        assertTrue(leading is RowLeading.AvatarWithBadge)
        assertTrue((leading as RowLeading.AvatarWithBadge).verified)
        val trailing = row.trailing
        assertTrue(trailing is RowTrailing.CircularAction)
    }

    @Test
    fun pending_row_uses_unverified_avatar_and_vertical_actions() {
        val vm = ConnectionsViewModel(repo, connectionsRepo)
        val row =
            vm.rowForPending(
                pending("req", user("u", "Priya Shah", city = "Burnside")),
                now = Instant.parse("2026-05-15T12:00:00Z"),
                zone = ZoneId.of("UTC"),
            )
        assertEquals("Priya Shah", row.title)
        val leading = row.leading
        assertTrue(leading is RowLeading.AvatarWithBadge)
        assertFalse((leading as RowLeading.AvatarWithBadge).verified)
        val trailing = row.trailing
        assertTrue(trailing is RowTrailing.VerticalActions)
        val vertical = trailing as RowTrailing.VerticalActions
        assertEquals("Accept", vertical.primary.label)
        assertEquals("Ignore", vertical.secondary.label)
    }

    @Test
    fun message_cta_fires_on_message_callback() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(acceptedTwo)
            coEvery { repo.pendingRequests() } returns NetworkResult.Success(pendingOne)
            val vm = ConnectionsViewModel(repo, connectionsRepo)
            var captured: ConnectionsChatTarget? = null
            vm.onMessage = { target -> captured = target }
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first { it.id == "r1" }
            val trailing = row.trailing as RowTrailing.CircularAction
            trailing.onClick()
            assertNotNull(captured)
            assertEquals("u_a", captured?.userId)
            assertEquals("Maria Kovacs", captured?.displayName)
            assertTrue(captured?.verified == true)
        }

    // MARK: - Pure helpers

    @Test
    fun tone_is_stable_for_same_id() {
        assertEquals(
            ConnectionAvatarTone.toneFor("u_42"),
            ConnectionAvatarTone.toneFor("u_42"),
        )
    }

    @Test
    fun relative_time_formatting() {
        val now = Instant.parse("2026-05-15T12:00:00Z")
        val zone = ZoneId.of("UTC")
        assertEquals(
            "5m ago",
            ConnectionsViewModel.formatRelativeTime("2026-05-15T11:55:00Z", now, zone),
        )
        assertEquals(
            "3h ago",
            ConnectionsViewModel.formatRelativeTime("2026-05-15T09:00:00Z", now, zone),
        )
        assertEquals(
            "yesterday",
            ConnectionsViewModel.formatRelativeTime("2026-05-14T08:00:00Z", now, zone),
        )
        assertEquals(
            "3d ago",
            ConnectionsViewModel.formatRelativeTime("2026-05-12T08:00:00Z", now, zone),
        )
        assertEquals(
            "2w ago",
            ConnectionsViewModel.formatRelativeTime("2026-05-01T08:00:00Z", now, zone),
        )
        assertNull(ConnectionsViewModel.formatRelativeTime(null, now, zone))
    }

    @Test
    fun display_name_falls_back_through_name_first_last_username() {
        assertEquals(
            "Maria Kovacs",
            ConnectionsViewModel.displayNameFor(
                user("u", "Maria Kovacs"),
            ),
        )
        // No `name`, but firstName + lastName populated.
        val noName =
            user("u", "ignored").copy(name = null, firstName = "Foo", lastName = "Bar")
        assertEquals("Foo Bar", ConnectionsViewModel.displayNameFor(noName))
        // Only username.
        val onlyUsername = user("u", "ignored").copy(name = null, firstName = null, lastName = null)
        assertEquals(onlyUsername.username, ConnectionsViewModel.displayNameFor(onlyUsername))
    }
}
