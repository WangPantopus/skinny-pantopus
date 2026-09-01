@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.inbox.newmessage

import app.pantopus.android.data.api.models.chats.ChatOtherIdentity
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipDto
import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import app.pantopus.android.data.api.models.relationships.RelationshipsListResponse
import app.pantopus.android.data.api.models.users.UserSearchResponse
import app.pantopus.android.data.api.models.users.UserSearchResultDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors the iOS NewMessageViewModelTests coverage: load → loaded
 * (both sections populated), load → empty (all sources empty), load →
 * error (both fetches fail), search filters Connections by name and
 * runs the directory fetch once the query reaches 2 chars, and row
 * mapping projects identity / locality / verified correctly.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class NewMessageViewModelTest {
    private val relationshipsRepo: RelationshipsRepository = mockk()
    private val chatRepo: ChatRepository = mockk()
    private val profileRepo: ProfileRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVM() =
        NewMessageViewModel(
            relationshipsRepo = relationshipsRepo,
            chatRepo = chatRepo,
            profileRepo = profileRepo,
        )

    private val acceptedFixture =
        RelationshipsListResponse(
            relationships =
                listOf(
                    RelationshipDto(
                        id = "r1",
                        status = "accepted",
                        createdAt = "2026-05-12T10:00:00Z",
                        acceptedAt = "2026-05-12T11:00:00Z",
                        otherUser =
                            RelationshipUserDto(
                                id = "u_a",
                                username = "maria",
                                name = "Maria Kovacs",
                                firstName = "Maria",
                                lastName = "Kovacs",
                                city = "Elm Park",
                                state = "OR",
                            ),
                    ),
                ),
        )

    private val unifiedFixture =
        UnifiedConversationsResponse(
            conversations =
                listOf(
                    UnifiedConversationDto(
                        type = "conversation",
                        otherParticipantId = "u_b",
                        otherParticipantName = "Sofia Romero",
                        otherParticipantIdentity =
                            ChatOtherIdentity(
                                identityKind = "personal",
                                verified = true,
                            ),
                        lastMessageAt = "2026-05-15T10:00:00Z",
                    ),
                ),
        )

    private val searchFixture =
        UserSearchResponse(
            users =
                listOf(
                    UserSearchResultDto(
                        id = "u_c",
                        username = "anika",
                        name = "Anika Reyes",
                        profilePicture = null,
                        city = "Elm Park",
                        state = "OR",
                        accountType = "individual",
                    ),
                    UserSearchResultDto(
                        id = "u_d",
                        username = "bigtree",
                        name = "Big Tree Handyman",
                        profilePicture = null,
                        city = "Elm Park",
                        state = "OR",
                        accountType = "business",
                    ),
                ),
        )

    // MARK: - Lifecycle

    @Test
    fun load_populatesBothSections() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns NetworkResult.Success(acceptedFixture)
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns NetworkResult.Success(unifiedFixture)
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            val state = viewModel.state.value
            assertTrue("expected Loaded, got $state", state is NewMessageUiState.Loaded)
            val sections = (state as NewMessageUiState.Loaded).sections
            assertEquals(listOf(NewMessageSectionId.Connections, NewMessageSectionId.Recent), sections.map { it.id })
            assertEquals("Maria Kovacs", sections[0].rows.first().name)
            assertEquals("Elm Park, OR", sections[0].rows.first().locality)
            assertEquals("Sofia Romero", sections[1].rows.first().name)
            assertEquals(NewMessageIdentityBadge.Personal, sections[1].rows.first().identity)
            assertTrue(sections[1].rows.first().verified)
        }

    @Test
    fun load_allEmpty_flipsToEmpty() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns
                NetworkResult.Success(RelationshipsListResponse(relationships = emptyList()))
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns
                NetworkResult.Success(UnifiedConversationsResponse(conversations = emptyList()))
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            assertEquals(NewMessageUiState.Empty, viewModel.state.value)
        }

    @Test
    fun load_bothFail_flipsToError() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            assertTrue(viewModel.state.value is NewMessageUiState.Error)
        }

    @Test
    fun load_onlyConnectionsFails_keepsRecent() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns NetworkResult.Success(unifiedFixture)
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            val state = viewModel.state.value
            assertTrue(state is NewMessageUiState.Loaded)
            val ids = (state as NewMessageUiState.Loaded).sections.map { it.id }
            assertEquals(listOf(NewMessageSectionId.Recent), ids)
        }

    // MARK: - Search

    @Test
    fun search_filtersConnectionsByName() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns NetworkResult.Success(acceptedFixture)
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns NetworkResult.Success(unifiedFixture)
            // UnconfinedTestDispatcher skips the 280ms debounce — the
            // directory fetch fires synchronously. Stub it with no
            // matches so the All-verified section stays hidden and the
            // assertion focuses on Connections filtering.
            coEvery { profileRepo.search(query = "Maria", limit = 20) } returns
                NetworkResult.Success(UserSearchResponse(users = emptyList()))
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            viewModel.updateSearch("Maria")
            runCurrent()
            val state = viewModel.state.value
            assertTrue(state is NewMessageUiState.Loaded)
            val sections = (state as NewMessageUiState.Loaded).sections
            // Sofia (Recent) is filtered out — only Maria matches.
            assertEquals(listOf(NewMessageSectionId.Connections), sections.map { it.id })
            assertEquals(1, sections.first().rows.size)
            assertEquals("Maria Kovacs", sections.first().rows.first().name)
        }

    @Test
    fun search_runsDirectoryFetchAfterDebounce() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns
                NetworkResult.Success(RelationshipsListResponse(relationships = emptyList()))
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns
                NetworkResult.Success(UnifiedConversationsResponse(conversations = emptyList()))
            coEvery { profileRepo.search(query = "Reyes", limit = 20) } returns NetworkResult.Success(searchFixture)
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            viewModel.updateSearch("Reyes")
            // Past the 280ms debounce — let the test scheduler exhaust
            // every queued delay, then any queued continuation.
            advanceUntilIdle()
            runCurrent()
            val state = viewModel.state.value
            assertTrue("expected Loaded, got $state", state is NewMessageUiState.Loaded)
            val sections = (state as NewMessageUiState.Loaded).sections
            assertEquals(listOf(NewMessageSectionId.AllVerified), sections.map { it.id })
            assertEquals(2, sections.first().rows.size)
            assertEquals("Anika Reyes", sections.first().rows.first().name)
            assertEquals(NewMessageIdentityBadge.Business, sections.first().rows.last().identity)
        }

    @Test
    fun search_shortQuery_keepsAllVerifiedHidden() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns NetworkResult.Success(acceptedFixture)
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns
                NetworkResult.Success(UnifiedConversationsResponse(conversations = emptyList()))
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            viewModel.updateSearch("M")
            runCurrent()
            val state = viewModel.state.value
            assertTrue(state is NewMessageUiState.Loaded)
            val ids = (state as NewMessageUiState.Loaded).sections.map { it.id }
            assertFalse(NewMessageSectionId.AllVerified in ids)
        }

    // MARK: - Row mapping (pure projections)

    @Test
    fun rowForConnection_projectsPersonalVerified() {
        val viewModel = makeVM()
        val rel =
            RelationshipDto(
                id = "r_x",
                status = "accepted",
                createdAt = "2026-05-12T10:00:00Z",
                acceptedAt = "2026-05-12T11:00:00Z",
                otherUser =
                    RelationshipUserDto(
                        id = "u_x",
                        username = "test",
                        name = "Test User",
                        firstName = "Test",
                        lastName = "User",
                        city = "Elm Park",
                        state = "OR",
                    ),
            )
        val row = viewModel.rowForConnection(rel)
        assertEquals("u_x", row.userId)
        assertEquals("Test User", row.name)
        assertEquals("TU", row.initials)
        assertEquals("Elm Park, OR", row.locality)
        assertEquals(NewMessageIdentityBadge.Personal, row.identity)
        assertTrue(row.verified)
    }

    @Test
    fun rowForVerified_projectsBusinessIdentity() {
        val viewModel = makeVM()
        val dto =
            UserSearchResultDto(
                id = "u_biz",
                username = null,
                name = "Big Tree Handyman",
                profilePicture = null,
                city = "Elm Park",
                state = "OR",
                accountType = "business",
            )
        val row = viewModel.rowForVerified(dto)
        assertEquals(NewMessageIdentityBadge.Business, row.identity)
        assertEquals("Elm Park, OR", row.locality)
    }

    // MARK: - Selection

    @Test
    fun tapRow_emitsDestination() =
        runTest {
            coEvery { relationshipsRepo.list(status = "accepted") } returns NetworkResult.Success(acceptedFixture)
            coEvery { chatRepo.unifiedConversations(limit = 50) } returns
                NetworkResult.Success(UnifiedConversationsResponse(conversations = emptyList()))
            val viewModel = makeVM()
            viewModel.load()
            runCurrent()
            val row =
                NewMessageContactRow(
                    id = "x",
                    userId = "u_z",
                    name = "Pat",
                    initials = "P",
                    locality = null,
                    sub = null,
                    subIcon = null,
                    verified = true,
                    identity = NewMessageIdentityBadge.Personal,
                )
            viewModel.tapRow(row)
            val destination = viewModel.destination.value
            assertNotNull(destination)
            assertEquals("u_z", destination?.userId)
            assertEquals("Pat", destination?.displayName)
        }
}
