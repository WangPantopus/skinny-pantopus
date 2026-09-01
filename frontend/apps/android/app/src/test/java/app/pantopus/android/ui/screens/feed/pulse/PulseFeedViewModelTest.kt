@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.feed.pulse

import app.pantopus.android.data.api.models.feed.FeedPagination
import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.models.feed.FeedPostCreator
import app.pantopus.android.data.api.models.feed.FeedResponse
import app.pantopus.android.data.api.models.posts.PostLikeResponse
import app.pantopus.android.data.api.models.sports.ActiveSportsEventsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.feed.FeedActionsRepository
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.data.sports.SportsRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PulseFeedViewModelTest {
    private val repo: PostsRepository = mockk()
    private val feedActions: FeedActionsRepository = mockk(relaxed = true)
    private val authRepo: AuthRepository =
        mockk<AuthRepository>().also {
            every { it.state } returns
                MutableStateFlow<AuthRepository.State>(AuthRepository.State.SignedOut)
        }
    private val locationProvider =
        object : LocationProvider {
            override fun cachedCoordinate(): UserCoordinate? = null

            override suspend fun requestCurrent(timeoutMillis: Long): UserCoordinate? = null
        }
    private val postsRefresh = PulsePostsRefreshNotifier()

    // Sports lane — only queried once the Sports topic is selected.
    private val sportsRepo: SportsRepository =
        mockk {
            coEvery { activeEvents() } returns
                NetworkResult.Success(ActiveSportsEventsResponse(primaryEvent = null, events = emptyList()))
        }

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun load_projectsMediaUrlsPreferringThumbnails() =
        runTest {
            val vm = makeVm()
            coEvery { repo.feed(any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    FeedResponse(
                        posts =
                            listOf(
                                askPost().copy(
                                    mediaUrls = listOf("https://cdn.example.com/full.jpg"),
                                    mediaThumbnails = listOf("https://cdn.example.com/thumb.jpg"),
                                ),
                            ),
                        pagination = FeedPagination(hasMore = false),
                    ),
                )
            vm.load()
            val loaded = vm.state.value as PulseFeedUiState.Loaded
            assertEquals(listOf("https://cdn.example.com/thumb.jpg"), loaded.rows.single().mediaUrls)
        }

    private fun askPost(
        id: String = "p1",
        likeCount: Int = 12,
        userHasLiked: Boolean = false,
    ): FeedPost =
        FeedPost(
            id = id,
            userId = "u1",
            title = null,
            content = "Anyone know a good dog-walker?",
            postType = "ask_local",
            createdAt = "2026-04-20T10:00:00Z",
            likeCount = likeCount,
            commentCount = 3,
            userHasLiked = userHasLiked,
            locationName = "Elm Park",
            creator =
                FeedPostCreator(
                    id = "u1",
                    username = "maria",
                    name = "Maria L.",
                    firstName = "Maria",
                    lastName = "L.",
                    profilePictureUrl = null,
                    city = "Cambridge",
                    state = "MA",
                    accountType = "personal",
                ),
        )

    // A fresh moderation store per VM keeps mute/hide cases isolated — the
    // production instance is a process singleton shared by every surface.
    private fun makeVm(): PulseFeedViewModel =
        PulseFeedViewModel(
            repo,
            feedActions,
            authRepo,
            locationProvider,
            postsRefresh,
            sportsRepo,
            FeedModerationStore(),
        )

    @Test fun load_with_posts_transitions_loaded() =
        runTest {
            coEvery {
                repo.feed("place", null, null, null, 20)
            } returns NetworkResult.Success(FeedResponse(listOf(askPost()), FeedPagination(null, false)))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PulseFeedUiState.Loaded
            assertEquals(1, loaded.rows.size)
            assertEquals(PulseIntent.Ask, loaded.rows.first().intent)
            assertEquals("Maria L.", loaded.rows.first().authorName)
        }

    @Test fun load_empty_transitions_empty() =
        runTest {
            coEvery {
                repo.feed("place", null, null, null, 20)
            } returns NetworkResult.Success(FeedResponse(emptyList(), null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is PulseFeedUiState.Empty)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery {
                repo.feed("place", null, null, null, 20)
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is PulseFeedUiState.Error)
        }

    @Test fun select_intent_refetches_with_post_type() =
        runTest {
            coEvery {
                repo.feed("place", null, null, null, 20)
            } returns NetworkResult.Success(FeedResponse(listOf(askPost()), null))
            coEvery {
                repo.feed("place", null, null, "event", 20)
            } returns NetworkResult.Success(FeedResponse(emptyList(), null))
            val vm = makeVm()
            vm.load()
            vm.selectIntent(PulseIntent.Event)
            assertEquals(PulseIntent.Event, vm.activeIntent.value)
            assertTrue(vm.state.value is PulseFeedUiState.Empty)
        }

    @Test fun tap_reaction_optimistically_increments_and_reconciles() =
        runTest {
            coEvery {
                repo.feed("place", null, null, null, 20)
            } returns NetworkResult.Success(FeedResponse(listOf(askPost()), null))
            coEvery { repo.toggleLike("p1") } returns
                NetworkResult.Success(PostLikeResponse(message = "ok", liked = true, likeCount = 13))
            val vm = makeVm()
            vm.load()
            vm.tapReaction("p1")
            val loaded = vm.state.value as PulseFeedUiState.Loaded
            assertEquals(13, loaded.rows.first().reactions.first().count)
            assertTrue(loaded.rows.first().userHasReacted)
        }

    @Test fun tap_reaction_rolls_back_on_failure() =
        runTest {
            coEvery {
                repo.feed("place", null, null, null, 20)
            } returns NetworkResult.Success(FeedResponse(listOf(askPost()), null))
            coEvery { repo.toggleLike("p1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.tapReaction("p1")
            val loaded = vm.state.value as PulseFeedUiState.Loaded
            assertEquals(12, loaded.rows.first().reactions.first().count)
            assertFalse(loaded.rows.first().userHasReacted)
        }
}
