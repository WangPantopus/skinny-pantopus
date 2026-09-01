@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "MagicNumber",
)

package app.pantopus.android.ui.screens.my_posts

import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.data.api.models.posts.MyPostsResponse
import app.pantopus.android.data.api.models.posts.PostArchiveResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowBodyEmphasis
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class MyPostsViewModelTest {
    private val postsRepo: PostsRepository = mockk()
    private val authRepo: AuthRepository = mockk()
    private val postsRefresh = PulsePostsRefreshNotifier()

    /** Fixed clock — Friday 2026-05-15 12:00 UTC. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val state =
            MutableStateFlow<AuthRepository.State>(
                AuthRepository.State.SignedIn(
                    user = UserDto(id = "u_me", email = "me@test", displayName = "Me", avatarUrl = null),
                ),
            )
        every { authRepo.state } returns state
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun dto(
        id: String,
        content: String = "Looking for a chimney sweep",
        postType: String? = "ask_local",
        createdAt: String = "2026-05-15T10:00:00Z",
        likeCount: Int = 3,
        commentCount: Int = 8,
        locationName: String? = "Elm Park",
        archivedAt: String? = null,
    ) = MyPostDto(
        id = id,
        userId = "u_me",
        content = content,
        postType = postType,
        createdAt = createdAt,
        likeCount = likeCount,
        commentCount = commentCount,
        locationName = locationName,
        archivedAt = archivedAt,
    )

    private fun makeVM(): MyPostsViewModel {
        val vm = MyPostsViewModel(postsRepo, authRepo, postsRefresh)
        vm.overrideNow { fixedNow }
        return vm
    }

    // MARK: - Lifecycle

    @Test
    fun loadEmptyTransitionsToEmpty() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = emptyList()))
            val vm = makeVM()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("You haven’t posted yet", (state as ListOfRowsUiState.Empty).headline)
            assertEquals("Write a post", state.ctaTitle)
        }

    @Test
    fun loadPopulatedTransitionsToLoadedOnActiveTab() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = listOf(dto(id = "p1"))))
            coEvery { postsRepo.archivePost("p1") } returns
                NetworkResult.Success(PostArchiveResponse(archived = true, archivedAt = fixedNow.toString()))
            val vm = makeVM()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            assertEquals("p1", (state as ListOfRowsUiState.Loaded).sections.first().rows.first().id)
            assertEquals(MyPostsTab.ACTIVE, vm.tabs.value[0].id)
            assertEquals(1, vm.tabs.value[0].count)
        }

    @Test
    fun loadFailureTransitionsToErrorWhenCold() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVM()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun noSignedInUserSkipsFetchAndRendersEmpty() =
        runTest {
            val signedOut = MutableStateFlow<AuthRepository.State>(AuthRepository.State.SignedOut)
            every { authRepo.state } returns signedOut
            val vm = makeVM()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
        }

    // MARK: - Tab assignment

    @Test
    fun wirePostWithArchivedAtLandsInArchivedTab() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(
                    MyPostsResponse(
                        posts =
                            listOf(
                                dto(id = "a1"),
                                dto(id = "x1", archivedAt = "2026-05-11T10:00:00Z"),
                            ),
                    ),
                )
            val vm = makeVM()
            vm.load()
            assertEquals(1, vm.tabs.value[0].count)
            assertEquals(1, vm.tabs.value[1].count)

            vm.selectTab(MyPostsTab.ARCHIVED)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("x1", state.sections.first().rows.first().id)
            assertEquals(RowHighlight.Archived, state.sections.first().rows.first().highlight)
        }

    // MARK: - Intent mapping

    @Test
    fun intentMapsFromPostType() {
        assertEquals(PulseIntent.Ask, PulseIntent.fromPostType("ask_local"))
        assertEquals(PulseIntent.Recommend, PulseIntent.fromPostType("recommendation"))
        assertEquals(PulseIntent.Event, PulseIntent.fromPostType("event"))
        assertEquals(PulseIntent.Lost, PulseIntent.fromPostType("lost_found"))
        assertEquals(PulseIntent.Announce, PulseIntent.fromPostType("local_update"))
        assertEquals(PulseIntent.Ask, PulseIntent.fromPostType("ask"))
        assertEquals(PulseIntent.Announce, PulseIntent.fromPostType(null))
        assertEquals(PulseIntent.Announce, PulseIntent.fromPostType("garbage"))
    }

    @Test
    fun engagementItemsAdaptToIntent() {
        val dto = dto(id = "p", postType = "event", likeCount = 12, commentCount = 5)

        val event = MyPostsViewModel.engagementItems(dto, PulseIntent.Event)
        assertEquals("12 going", event[0].label)
        assertEquals("5 replies", event[1].label)

        val recommend = MyPostsViewModel.engagementItems(dto, PulseIntent.Recommend)
        assertEquals("12 helpful", recommend[0].label)

        val lost = MyPostsViewModel.engagementItems(dto, PulseIntent.Lost)
        assertEquals("5 replies", lost[0].label)
        assertEquals("12 seen", lost[1].label)

        val ask = MyPostsViewModel.engagementItems(dto, PulseIntent.Ask)
        assertEquals("5 replies", ask[0].label)
        assertEquals("12 likes", ask[1].label)

        val single =
            MyPostsViewModel.engagementItems(
                dto(id = "s", likeCount = 1, commentCount = 1),
                PulseIntent.Ask,
            )
        assertEquals("1 reply", single[0].label)
        assertEquals("1 like", single[1].label)
    }

    @Test
    fun timeMetaCombinesRelativeTimeAndLocality() {
        val d = dto(id = "p")
        assertEquals("2h · Elm Park", MyPostsViewModel.timeMetaLabel(d, fixedNow))
    }

    // MARK: - Row projection asserted via VM load state

    @Test
    fun rowProjectionUsesPrimaryBodyEmphasisAndHeaderChips() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = listOf(dto(id = "p1"))))
            coEvery { postsRepo.archivePost("p1") } returns
                NetworkResult.Success(PostArchiveResponse(archived = true, archivedAt = fixedNow.toString()))
            coEvery { postsRepo.unarchivePost("p1") } returns
                NetworkResult.Success(PostArchiveResponse(archived = false, archivedAt = null))
            val vm = makeVM()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first()
            assertEquals("", row.title)
            assertEquals("Looking for a chimney sweep", row.body)
            assertEquals(RowBodyEmphasis.Primary, row.bodyEmphasis)
            assertEquals(1, row.headerChips?.size)
            assertEquals("Ask", row.headerChips?.first()?.text)
            assertEquals("2h · Elm Park", row.timeMeta)
            assertNotNull(row.engagement)
            assertEquals("Edit", row.engagement?.cta?.label)
            assertNull(row.highlight)
        }

    @Test
    fun archivedRowUsesArchivedHighlightAndRestoreCTA() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(
                    MyPostsResponse(posts = listOf(dto(id = "x1", archivedAt = "2026-05-11T10:00:00Z"))),
                )
            val vm = makeVM()
            vm.load()
            vm.selectTab(MyPostsTab.ARCHIVED)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first()
            assertEquals(RowHighlight.Archived, row.highlight)
            assertEquals(2, row.headerChips?.size)
            assertEquals("ARCHIVED", row.headerChips?.last()?.text)
            assertEquals("Restore", row.engagement?.cta?.label)
        }

    // MARK: - Optimistic mutations

    @Test
    fun archiveOptimisticallyFlipsRowToArchivedTab() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = listOf(dto(id = "p1"))))
            coEvery { postsRepo.archivePost("p1") } returns
                NetworkResult.Success(PostArchiveResponse(archived = true, archivedAt = fixedNow.toString()))
            val vm = makeVM()
            vm.load()
            assertEquals(1, vm.tabs.value[0].count)
            assertEquals(0, vm.tabs.value[1].count)

            vm.archive("p1")
            assertEquals(0, vm.tabs.value[0].count)
            assertEquals(1, vm.tabs.value[1].count)
            assertTrue(vm.isArchived(dto(id = "p1")))
        }

    @Test
    fun unarchiveFlipsRowBackToActive() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = listOf(dto(id = "p1"))))
            coEvery { postsRepo.archivePost("p1") } returns
                NetworkResult.Success(PostArchiveResponse(archived = true, archivedAt = fixedNow.toString()))
            coEvery { postsRepo.unarchivePost("p1") } returns
                NetworkResult.Success(PostArchiveResponse(archived = false, archivedAt = null))
            val vm = makeVM()
            vm.load()
            vm.archive("p1")
            assertEquals(1, vm.tabs.value[1].count)
            vm.unarchive("p1")
            assertEquals(1, vm.tabs.value[0].count)
            assertEquals(0, vm.tabs.value[1].count)
        }

    @Test
    fun confirmDeleteRemovesRowOnSuccess() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = listOf(dto(id = "p1"))))
            coEvery { postsRepo.deletePost("p1") } returns NetworkResult.Success(Unit)
            val vm = makeVM()
            vm.load()
            vm.requestDelete("p1")
            vm.confirmDelete()
            assertEquals(0, vm.tabs.value[0].count)
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
        }

    @Test
    fun confirmDeleteRollsBackOnFailure() =
        runTest {
            coEvery { postsRepo.userPosts(any(), any()) } returns
                NetworkResult.Success(MyPostsResponse(posts = listOf(dto(id = "p1"))))
            coEvery { postsRepo.deletePost("p1") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVM()
            vm.load()
            vm.requestDelete("p1")
            vm.confirmDelete()
            assertEquals(1, vm.tabs.value[0].count)
        }
}
