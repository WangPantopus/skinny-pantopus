@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.posts

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.posts.PostCommentCreateResponse
import app.pantopus.android.data.api.models.posts.PostCommentDto
import app.pantopus.android.data.api.models.posts.PostCreatorDto
import app.pantopus.android.data.api.models.posts.PostDetailDto
import app.pantopus.android.data.api.models.posts.PostDetailResponse
import app.pantopus.android.data.api.models.posts.PostLikeResponse
import app.pantopus.android.data.api.models.posts.PostReactionKind
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.posts.MatchedBusinessesRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostIntent
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

@OptIn(ExperimentalCoroutinesApi::class)
class PulsePostDetailViewModelTest {
    private val repo: PostsRepository = mockk()
    private val authRepo: AuthRepository = mockk()

    // "Nearby Providers" degrades to a hidden card, so a relaxed mock is
    // enough — these tests assert post/comment behaviour only.
    private val matchedBusinessesRepo: MatchedBusinessesRepository = mockk(relaxed = true)
    private val authState = MutableStateFlow<AuthRepository.State>(AuthRepository.State.SignedOut)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { authRepo.state } returns authState
        authState.value = AuthRepository.State.SignedOut
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): PulsePostDetailViewModel =
        PulsePostDetailViewModel(
            repo = repo,
            authRepo = authRepo,
            postsRefresh = PulsePostsRefreshNotifier(),
            matchedBusinessesRepo = matchedBusinessesRepo,
            savedStateHandle = SavedStateHandle(mapOf(PULSE_POST_DETAIL_ID_KEY to "p1")),
        )

    private fun creator(
        id: String = "u1",
        name: String = "Alex Rivera",
    ): PostCreatorDto =
        PostCreatorDto(
            id = id,
            username = name.lowercase().split(" ").first(),
            name = name,
            firstName = name.split(" ").first(),
            lastName = name.split(" ").getOrNull(1),
            profilePictureUrl = null,
            city = "Cambridge",
            state = "MA",
            accountType = "personal",
        )

    private fun samplePost(
        likeCount: Int = 3,
        userHasLiked: Boolean = false,
        comments: List<PostCommentDto> = emptyList(),
    ): PostDetailDto =
        PostDetailDto(
            id = "p1",
            userId = "u1",
            title = null,
            content = "Anyone know a good handyman?",
            postType = "general",
            postFormat = "standard",
            purpose = "ask",
            mediaUrls = emptyList(),
            mediaTypes = emptyList(),
            mediaLiveUrls = emptyList(),
            createdAt = "2026-04-30T12:00:00.000Z",
            updatedAt = null,
            isEdited = false,
            likeCount = likeCount,
            commentCount = comments.size,
            shareCount = 0,
            viewCount = 12,
            creator = creator(),
            home = null,
            userHasLiked = userHasLiked,
            userHasSaved = false,
            userHasReposted = false,
            comments = comments,
        )

    private fun sampleResponse(): PostDetailResponse = PostDetailResponse(post = samplePost())

    @Test fun load_happy_path() =
        runTest {
            coEvery { repo.detail("p1") } returns NetworkResult.Success(sampleResponse())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PulsePostDetailUiState.Loaded
            assertEquals("Alex Rivera", loaded.content.authorDisplayName)
            assertEquals(PostIntent.Ask, loaded.content.intent)
            assertEquals(3, loaded.content.reactions.helpful)
            assertNull(loaded.content.reactions.userReaction)
        }

    @Test fun lost_found_purpose_maps_to_lost_found_intent() {
        assertEquals(PostIntent.LostFound, PostIntent.from(purpose = "lost_found", postType = null))
    }

    @Test fun reaction_optimistic_then_reconcile() =
        runTest {
            coEvery { repo.detail("p1") } returns NetworkResult.Success(sampleResponse())
            coEvery { repo.toggleLike("p1") } returns
                NetworkResult.Success(PostLikeResponse(liked = true, likeCount = 4))
            val vm = makeVm()
            vm.load()
            vm.tapReaction(PostReactionKind.Helpful)
            val loaded = vm.state.value as PulsePostDetailUiState.Loaded
            assertEquals(4, loaded.content.reactions.helpful)
            assertEquals(PostReactionKind.Helpful, loaded.content.reactions.userReaction)
        }

    @Test fun reaction_rollback_on_failure() =
        runTest {
            coEvery { repo.detail("p1") } returns NetworkResult.Success(sampleResponse())
            coEvery { repo.toggleLike("p1") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            vm.tapReaction(PostReactionKind.Helpful)
            val loaded = vm.state.value as PulsePostDetailUiState.Loaded
            assertEquals(3, loaded.content.reactions.helpful)
            assertNull(loaded.content.reactions.userReaction)
            assertNotNull(vm.toastMessage.value)
        }

    @Test fun heart_reaction_is_display_only() =
        runTest {
            // The view renders Heart and Going as non-tappable display
            // chips, so tapReaction should only ever be invoked for
            // `.Helpful`. The safety guard in the VM returns silently
            // for the others — no toast, no state change.
            coEvery { repo.detail("p1") } returns NetworkResult.Success(sampleResponse())
            val vm = makeVm()
            vm.load()
            vm.tapReaction(PostReactionKind.Heart)
            assertNull(vm.toastMessage.value)
        }

    @Test fun send_comment_refetches_and_clears_composer() =
        runTest {
            val reply =
                PostCommentDto(
                    id = "c-new",
                    postId = "p1",
                    userId = "u1",
                    parentCommentId = null,
                    comment = "hi",
                    createdAt = "2026-04-30T12:07:00.000Z",
                    isDeleted = false,
                    author = creator(),
                )
            coEvery { repo.detail("p1") } returns NetworkResult.Success(sampleResponse())
            coEvery { repo.createComment("p1", any()) } returns
                NetworkResult.Success(PostCommentCreateResponse(comment = reply))
            val vm = makeVm()
            vm.load()
            vm.setComposerText("hi")
            vm.sendComment()
            assertEquals("", vm.composerText.value)
            assertTrue(!vm.isSendingComment.value)
        }

    @Test fun not_found_emits_friendly_error() =
        runTest {
            coEvery { repo.detail("p1") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.load()
            val errorState = vm.state.value as PulsePostDetailUiState.Error
            assertTrue(errorState.message.contains("post"))
        }

    @Test fun comments_flatten_to_depth_one() =
        runTest {
            val top =
                PostCommentDto(
                    id = "c1",
                    postId = "p1",
                    userId = "u2",
                    parentCommentId = null,
                    comment = "Top",
                    createdAt = "2026-04-30T12:05:00.000Z",
                    isDeleted = false,
                    author = creator("u2", "Maria Chen"),
                )
            val reply =
                top.copy(
                    id = "c2",
                    userId = "u3",
                    parentCommentId = "c1",
                    comment = "Reply",
                    createdAt = "2026-04-30T12:06:00.000Z",
                    author = creator("u3", "Sam Lee"),
                )
            coEvery { repo.detail("p1") } returns
                NetworkResult.Success(PostDetailResponse(samplePost(comments = listOf(top, reply))))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PulsePostDetailUiState.Loaded
            assertEquals(2, loaded.content.comments.size)
            assertEquals(0, loaded.content.comments[0].indentLevel)
            assertEquals(1, loaded.content.comments[1].indentLevel)
        }
}
