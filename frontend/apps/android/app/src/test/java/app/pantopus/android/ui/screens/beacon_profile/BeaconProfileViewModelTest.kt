@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.beacon_profile

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.audience.BroadcastChannelDto
import app.pantopus.android.data.api.models.audience.PersonaTierDto
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.beacon.BeaconActionEcho
import app.pantopus.android.data.api.models.beacon.BeaconCredentialDto
import app.pantopus.android.data.api.models.beacon.BeaconPersonaDto
import app.pantopus.android.data.api.models.beacon.BeaconPersonaResponse
import app.pantopus.android.data.api.models.beacon.BeaconPostDto
import app.pantopus.android.data.api.models.beacon.BeaconPostsResponse
import app.pantopus.android.data.api.models.beacon.BeaconViewerDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.beacon.BeaconProfileRepository
import app.pantopus.android.data.broadcast.BroadcastReadRepository
import app.pantopus.android.ui.screens.profile.PublicProfilePost
import app.pantopus.android.ui.screens.shared.media.PostMediaItem
import app.pantopus.android.ui.screens.shared.media.PostMediaKind
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BeaconProfileViewModelTest {
    private val repo: BeaconProfileRepository = mockk()

    /** Read receipts are fire-and-forget; relaxed so cases that don't assert
     *  on them never need a stub. */
    private val broadcastReads: BroadcastReadRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun ownerVm() = BeaconProfileViewModel(repo, broadcastReads, SavedStateHandle())

    private fun visitorVm(handle: String = "mariak") =
        BeaconProfileViewModel(repo, broadcastReads, SavedStateHandle(mapOf(BEACON_HANDLE_KEY to handle)))

    private fun persona(
        viewer: BeaconViewerDto? = null,
        credential: BeaconCredentialDto? = null,
    ) = BeaconPersonaDto(
        id = "p1",
        handle = "mariak",
        displayName = "Maria K.",
        bio = "Sourdough scientist.",
        category = "creator",
        audienceLabel = "followers",
        audienceMode = "open",
        followerCount = 1200,
        postCount = 47,
        broadcastEnabled = true,
        credential = credential,
        viewer = viewer,
    )

    private val posts =
        listOf(
            BeaconPostDto(
                id = "po1",
                body = "Today's loaf",
                createdAt = "2026-06-19T10:00:00.000Z",
                visibility = "public",
                likeCount = 34,
                commentCount = 8,
            ),
            BeaconPostDto(
                id = "po2",
                content = "Field notes",
                createdAt = "2026-06-17T10:00:00.000Z",
                visibility = "followers",
                likeCount = 51,
                commentCount = 14,
            ),
        )

    private val tiers =
        listOf(PersonaTierDto(id = "t1", rank = 1, name = "Bronze", description = "Recipes", priceCents = 400, currency = "usd"))

    @Test fun `owner loads persona and projects stats`() =
        runTest {
            coEvery { repo.me() } returns NetworkResult.Success(BeaconPersonaResponse(persona(), BroadcastChannelDto(id = "c1")))
            coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(posts))
            coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(tiers))

            val vm = ownerVm()
            vm.load()

            val state = vm.state.value
            assertTrue(state is BeaconProfileUiState.Loaded)
            val content = (state as BeaconProfileUiState.Loaded).content
            assertTrue(content.isOwner)
            assertEquals("Maria K.", content.displayName)
            assertEquals(2, content.posts.size)
            assertEquals(1, content.tiers.size)
            assertEquals("$4/mo", content.tiers.first().priceLabel)
            assertEquals("Beacons", content.stats.first().label)
            assertEquals("1.2K", content.stats.first().value)
            assertEquals(BeaconFollowStatus.None, vm.followStatus.value)
        }

    @Test fun `owner with no persona shows empty`() =
        runTest {
            coEvery { repo.me() } returns NetworkResult.Success(BeaconPersonaResponse(persona = null, channel = null))

            val vm = ownerVm()
            vm.load()

            assertTrue(vm.state.value is BeaconProfileUiState.Empty)
        }

    @Test fun `visitor following projection`() =
        runTest {
            val viewer =
                BeaconViewerDto(
                    isOwner = false,
                    isFollowing = true,
                    followStatus = "active",
                    notificationLevel = "all",
                )
            coEvery { repo.persona("mariak") } returns NetworkResult.Success(BeaconPersonaResponse(persona(viewer)))
            coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(posts))
            coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(tiers))

            val vm = visitorVm("@mariak")
            vm.load()

            val content = (vm.state.value as BeaconProfileUiState.Loaded).content
            assertFalse(content.isOwner)
            assertEquals(BeaconFollowStatus.Active, vm.followStatus.value)
            assertTrue(vm.notificationsEnabled.value)
        }

    @Test fun `visitor not found shows error`() =
        runTest {
            coEvery { repo.persona("ghost") } returns NetworkResult.Failure(NetworkError.NotFound)

            val vm = visitorVm("ghost")
            vm.load()

            assertTrue(vm.state.value is BeaconProfileUiState.Error)
        }

    @Test fun `locked broadcast is locked for visitor`() =
        runTest {
            val locked =
                BeaconPostDto(
                    id = "lp1",
                    visibility = "tier_or_above",
                    targetTierRank = 2,
                    locked = true,
                    teaser = "Subscribe to read…",
                    createdAt = "2026-06-19T10:00:00.000Z",
                )
            val viewer = BeaconViewerDto(isOwner = false, isFollowing = true, followStatus = "active")
            coEvery { repo.persona("mariak") } returns NetworkResult.Success(BeaconPersonaResponse(persona(viewer)))
            coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(listOf(locked)))
            coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(emptyList()))

            val vm = visitorVm()
            vm.load()

            val content = (vm.state.value as BeaconProfileUiState.Loaded).content
            assertEquals(1, content.posts.size)
            assertTrue(content.posts.first().isLocked)
            assertEquals(PublicProfilePost.Visibility.Silver, content.posts.first().visibility)
        }

    @Test fun `unfollow keeps compacted follower count`() =
        runTest {
            val viewer = BeaconViewerDto(isOwner = false, isFollowing = true, followStatus = "active")
            coEvery { repo.persona("mariak") } returns NetworkResult.Success(BeaconPersonaResponse(persona(viewer)))
            coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(emptyList()))
            coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(emptyList()))
            coEvery { repo.unfollow("p1") } returns NetworkResult.Success(BeaconActionEcho())

            val vm = visitorVm()
            vm.load()
            val before = (vm.state.value as BeaconProfileUiState.Loaded).content
            assertEquals("1.2K", before.stats.first().value)

            vm.unfollow()

            val after = (vm.state.value as BeaconProfileUiState.Loaded).content
            assertEquals(BeaconFollowStatus.None, vm.followStatus.value)
            assertEquals(1199, after.followerCount)
            // Must stay compacted ("1.2K"), not collapse to "11".
            assertEquals("1.2K", after.stats.first().value)
        }

    @Test fun `tier rank drives visibility without tier string`() =
        runTest {
            // Real backend shape: raw Post row with visibility "followers" +
            // target_tier_rank 2 (the DB enum never carries "tier_or_above").
            val gated =
                BeaconPostDto(
                    id = "g1",
                    body = "members only",
                    visibility = "followers",
                    targetTierRank = 2,
                    createdAt = "2026-06-19T10:00:00.000Z",
                )
            val viewer = BeaconViewerDto(isOwner = false, isFollowing = true, followStatus = "active")
            coEvery { repo.persona("mariak") } returns NetworkResult.Success(BeaconPersonaResponse(persona(viewer)))
            coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(listOf(gated)))
            coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(emptyList()))

            val vm = visitorVm()
            vm.load()

            val content = (vm.state.value as BeaconProfileUiState.Loaded).content
            assertEquals(PublicProfilePost.Visibility.Silver, content.posts.first().visibility)
        }

    // MARK: - Media projection
    //
    // `GET /api/personas/:handle/posts` ships the four slot-aligned arrays
    // (`media_urls` / `media_types` / `media_thumbnails` / `media_live_urls`)
    // straight off the Post row — `sanitizePersonaPostForViewer` strips only
    // the location columns — so the Beacon profile card projects them with
    // the same `buildPostMediaItems` rules as the Pulse feed.

    /** Visitor stubs shared by the media cases — one post, no tiers. */
    private fun stubVisitor(post: BeaconPostDto) {
        val viewer = BeaconViewerDto(isOwner = false, isFollowing = true, followStatus = "active")
        coEvery { repo.persona("mariak") } returns NetworkResult.Success(BeaconPersonaResponse(persona(viewer)))
        coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(listOf(post)))
        coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(emptyList()))
    }

    /** Load [post] as a visitor and hand back the projected media slots. */
    private fun loadedPostMedia(post: BeaconPostDto): List<PostMediaItem> {
        stubVisitor(post)
        val vm = visitorVm()
        vm.load()
        return (vm.state.value as BeaconProfileUiState.Loaded).content.posts.first().media
    }

    @Test fun `live photo slot keeps its companion clip`() =
        runTest {
            val media =
                loadedPostMedia(
                    BeaconPostDto(
                        id = "m1",
                        body = "Proofing time-lapse",
                        createdAt = "2026-06-19T10:00:00.000Z",
                        visibility = "public",
                        mediaUrls = listOf("https://cdn/still.jpg", "https://cdn/plain.jpg"),
                        mediaTypes = listOf("live_photo", "image"),
                        mediaThumbnails = listOf("https://cdn/thumb.jpg", ""),
                        mediaLiveUrls = listOf("https://cdn/clip.mov", ""),
                    ),
                )

            assertEquals(2, media.size)
            assertEquals(PostMediaKind.LivePhoto, media[0].kind)
            assertEquals("https://cdn/still.jpg", media[0].url)
            assertEquals("https://cdn/clip.mov", media[0].liveVideoUrl)
            assertEquals("https://cdn/thumb.jpg", media[0].thumbnailUrl)
            // The neighbouring plain slot must not inherit the clip.
            assertEquals(PostMediaKind.Image, media[1].kind)
            assertNull(media[1].liveVideoUrl)
        }

    @Test fun `live photo without a clip downgrades to image`() =
        runTest {
            val media =
                loadedPostMedia(
                    BeaconPostDto(
                        id = "m2",
                        body = "Just the still",
                        createdAt = "2026-06-19T10:00:00.000Z",
                        visibility = "public",
                        mediaUrls = listOf("https://cdn/still.jpg"),
                        mediaTypes = listOf("live_photo"),
                        mediaLiveUrls = listOf(""),
                    ),
                )

            assertEquals(1, media.size)
            assertEquals(PostMediaKind.Image, media.first().kind)
            assertNull(media.first().liveVideoUrl)
        }

    @Test fun `compacted live urls feed the k-th live photo slot`() =
        runTest {
            // Ragged wire shape: `media_live_urls` came back shorter than
            // `media_urls`, so index alignment is gone and the k-th surviving
            // clip belongs to the k-th live_photo slot.
            val media =
                loadedPostMedia(
                    BeaconPostDto(
                        id = "m3",
                        body = "Two lives and a still",
                        createdAt = "2026-06-19T10:00:00.000Z",
                        visibility = "public",
                        mediaUrls = listOf("https://cdn/a.jpg", "https://cdn/b.jpg", "https://cdn/c.jpg"),
                        mediaTypes = listOf("image", "live_photo", "live_photo"),
                        mediaLiveUrls = listOf("https://cdn/b.mov", "https://cdn/c.mov"),
                    ),
                )

            assertEquals(3, media.size)
            assertEquals(PostMediaKind.Image, media[0].kind)
            assertEquals(PostMediaKind.LivePhoto, media[1].kind)
            assertEquals("https://cdn/b.mov", media[1].liveVideoUrl)
            assertEquals(PostMediaKind.LivePhoto, media[2].kind)
            assertEquals("https://cdn/c.mov", media[2].liveVideoUrl)
        }

    @Test fun `locked broadcast projects no media`() =
        runTest {
            // The route does not strip `media_*` on a locked row, so the
            // projection is the only thing keeping the paid attachments off
            // the card. Same fixture as the locked-visibility case, plus media.
            val media =
                loadedPostMedia(
                    BeaconPostDto(
                        id = "lp2",
                        visibility = "tier_or_above",
                        targetTierRank = 2,
                        locked = true,
                        teaser = "Subscribe to read…",
                        createdAt = "2026-06-19T10:00:00.000Z",
                        mediaUrls = listOf("https://cdn/paid.jpg"),
                        mediaTypes = listOf("live_photo"),
                        mediaLiveUrls = listOf("https://cdn/paid.mov"),
                    ),
                )

            assertTrue(media.isEmpty())
        }

    @Test fun `credential drives verification`() =
        runTest {
            coEvery { repo.posts("mariak") } returns NetworkResult.Success(BeaconPostsResponse(emptyList()))
            coEvery { repo.tiers("mariak") } returns NetworkResult.Success(PersonaTiersResponse(emptyList()))

            coEvery { repo.persona("mariak") } returns
                NetworkResult.Success(BeaconPersonaResponse(persona(credential = BeaconCredentialDto(status = "verified"))))
            val verified = visitorVm()
            verified.load()
            val v = (verified.state.value as BeaconProfileUiState.Loaded).content
            assertTrue(v.header.isVerified)
            assertEquals("Persona · Verified", v.header.tierLabel)

            coEvery { repo.persona("mariak") } returns NetworkResult.Success(BeaconPersonaResponse(persona()))
            val unverified = visitorVm()
            unverified.load()
            val u = (unverified.state.value as BeaconProfileUiState.Loaded).content
            assertFalse(u.header.isVerified)
            assertEquals("Persona · New", u.header.tierLabel)
        }
}
