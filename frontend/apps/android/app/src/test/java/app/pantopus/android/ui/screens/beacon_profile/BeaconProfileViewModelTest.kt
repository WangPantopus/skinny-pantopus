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
