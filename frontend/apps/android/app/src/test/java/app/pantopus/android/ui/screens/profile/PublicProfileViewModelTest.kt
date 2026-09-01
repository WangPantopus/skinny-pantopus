@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.data.api.models.posts.MyPostsResponse
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.profile.PublicProfileReview
import app.pantopus.android.data.api.models.relationships.ConnectionRequestResponse
import app.pantopus.android.data.api.models.relationships.PendingRequestDto
import app.pantopus.android.data.api.models.relationships.PendingRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import app.pantopus.android.data.api.models.users.FollowActionResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.models.users.UserRelationshipDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.connections.ConnectionsRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.data.social.UserSocialRepository
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileTab
import io.mockk.coEvery
import io.mockk.coVerify
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PublicProfileViewModelTest {
    private val repo: ProfileRepository = mockk()
    private val social: UserSocialRepository = mockk(relaxed = true)
    private val relationships: RelationshipsRepository = mockk()

    // Owns the disconnect half of `/api/relationships` (S5 split).
    private val connections: ConnectionsRepository = mockk(relaxed = true)
    private val blocks: BlocksRepository = mockk()
    private val authRepository: AuthRepository = mockk(relaxed = true)
    private val posts: PostsRepository = mockk()

    /**
     * Nav arg handed to the VM. A UUID by default so resolution takes the
     * `api/users/id/:id` branch; the T3 handle test flips it to a `@handle`
     * to exercise `api/users/username/:username`.
     */
    private var routeIdentifier: String = ROUTE_ID

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Local-kind profiles pull `GET /api/posts/user/:id`; default the
        // stub to an empty feed and let individual tests override it.
        coEvery { posts.userPosts(any(), any()) } returns
            NetworkResult.Success(MyPostsResponse(emptyList()))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): PublicProfileViewModel =
        PublicProfileViewModel(
            repo = repo,
            social = social,
            relationships = relationships,
            connections = connections,
            blocks = blocks,
            authRepository = authRepository,
            posts = posts,
            savedStateHandle = SavedStateHandle(mapOf(PUBLIC_PROFILE_USER_ID_KEY to routeIdentifier)),
        )

    private fun profile(
        verified: Boolean = true,
        reviews: List<PublicProfileReview> = emptyList(),
        rating: Double? = 4.8,
        gigs: Int? = 5,
        residency: Map<String, Any?>? = null,
    ): PublicProfileDto =
        PublicProfileDto(
            id = "u1",
            username = "alex",
            firstName = "Alex",
            lastName = "Rivera",
            name = "Alex Rivera",
            bio = "Cambridge transplant.",
            tagline = "Builder",
            city = "Cambridge",
            state = "MA",
            accountType = "personal",
            verified = verified,
            residency = residency,
            createdAt = "2025-01-01T00:00:00.000Z",
            gigsPosted = 2,
            gigsCompleted = gigs,
            averageRating = rating,
            reviewCount = reviews.size,
            followersCount = 12,
            reviews = reviews,
            skills = listOf("Carpentry", "Spanish"),
        )

    @Test fun load_happy_path() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PublicProfileUiState.Loaded
            assertEquals("Alex Rivera", loaded.content.header.displayName)
            assertEquals("alex", loaded.content.header.handle)
            assertEquals("Cambridge, MA", loaded.content.header.locality)
            assertTrue(loaded.content.header.isVerified)
            assertEquals(listOf("Carpentry", "Spanish"), loaded.content.stats.skills)
        }

    @Test fun tab_switching_does_not_refetch() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            vm.selectTab(ProfileTab.Reviews)
            vm.selectTab(ProfileTab.Gigs)
            coVerify(exactly = 1) { repo.publicProfile(ROUTE_ID) }
            assertEquals(ProfileTab.Gigs, vm.selectedTab.value)
        }

    @Test fun empty_reviews_state() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns
                NetworkResult.Success(profile(verified = false, reviews = emptyList(), rating = 0.0, gigs = 0))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PublicProfileUiState.Loaded
            assertTrue(loaded.content.stats.reviews.isEmpty())
            assertFalse(loaded.content.header.isVerified)
        }

    @Test fun not_found_emits_friendly_message() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.load()
            val errorState = vm.state.value as PublicProfileUiState.Error
            assertTrue(errorState.message.contains("profile"))
        }

    @Test fun connect_sends_request_and_marks_succeeded() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { relationships.sendRequest("u1", null) } returns
                NetworkResult.Success(ConnectionRequestResponse(message = "ok"))
            val vm = makeVm()
            vm.load()
            vm.connect()
            assertEquals(PublicProfileActionState.Succeeded, vm.connectState.value)
            assertEquals("Connection request sent", vm.toastMessage.value)
        }

    @Test fun connect_failure_surfaces_toast() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { relationships.sendRequest("u1", null) } returns
                NetworkResult.Failure(NetworkError.Forbidden)
            val vm = makeVm()
            vm.load()
            vm.connect()
            assertTrue(vm.connectState.value is PublicProfileActionState.Failed)
            assertTrue(!vm.toastMessage.value.isNullOrEmpty())
        }

    // The relationship-driven Connect control. `GET
    // api/users/:id/relationship` reports the edge; the header button reads
    // its label, its enabled pose and its action off that.

    @Test fun every_relationship_state_projects_onto_the_connect_control() =
        runTest {
            // edge → label, tappable
            val poses =
                listOf(
                    Triple(ProfileConnection.None, "Connect", true),
                    Triple(ProfileConnection.PendingSent, "Requested", false),
                    Triple(ProfileConnection.PendingReceived, "Accept", true),
                    Triple(ProfileConnection.Connected, "Connected", true),
                    Triple(ProfileConnection.Blocked, "Connect", true),
                )
            poses.forEach { (edge, label, tappable) ->
                signedInAs("viewer")
                coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
                coEvery { social.relationship("u1") } returns
                    NetworkResult.Success(UserRelationshipDto(relationship = edge.apiValue, following = false))
                val vm = makeVm()
                vm.load()
                assertEquals(edge, vm.connection.value)
                assertEquals(label, vm.connection.value.label)
                assertEquals(tappable, vm.isConnectEnabled())
                // A blocked edge drops the control; every other edge keeps it.
                assertEquals(edge != ProfileConnection.Blocked, vm.showsConnectAction())
            }
        }

    @Test fun connect_control_is_hidden_for_a_signed_out_viewer() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            assertFalse(vm.canFollow.value)
            assertFalse(vm.showsConnectAction())
            assertEquals(ProfileConnection.None, vm.connection.value)
        }

    @Test fun connect_is_inert_while_a_request_is_outstanding() =
        runTest {
            signedInAs("viewer")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { social.relationship("u1") } returns
                NetworkResult.Success(UserRelationshipDto(relationship = "pending_sent", following = false))
            val vm = makeVm()
            vm.load()
            vm.connect()
            assertEquals(ProfileConnection.PendingSent, vm.connection.value)
            coVerify(exactly = 0) { relationships.sendRequest(any(), any()) }
        }

    @Test fun connect_on_an_inbound_request_accepts_it() =
        runTest {
            signedInAs("viewer")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { social.relationship("u1") } returns
                NetworkResult.Success(UserRelationshipDto(relationship = "pending_received", following = false))
            coEvery { relationships.pendingRequests() } returns
                NetworkResult.Success(
                    PendingRequestsResponse(
                        listOf(PendingRequestDto(id = "r1", requester = RelationshipUserDto(id = "u1"))),
                    ),
                )
            coEvery { relationships.accept("r1") } returns
                NetworkResult.Success(RelationshipActionEcho(message = "ok"))
            val vm = makeVm()
            vm.load()
            vm.connect()
            assertEquals(ProfileConnection.Connected, vm.connection.value)
            assertEquals("Connected", vm.toastMessage.value)
            coVerify(exactly = 1) { relationships.accept("r1") }
        }

    @Test fun connect_on_a_connected_edge_confirms_before_removing_it() =
        runTest {
            signedInAs("viewer")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { social.relationship("u1") } returns
                NetworkResult.Success(UserRelationshipDto(relationship = "connected", following = true))
            val vm = makeVm()
            vm.load()
            vm.connect()
            assertTrue(vm.showDisconnectConfirm.value)
            coVerify(exactly = 0) { relationships.sendRequest(any(), any()) }
            vm.cancelDisconnect()
            assertFalse(vm.showDisconnectConfirm.value)
            assertEquals(ProfileConnection.Connected, vm.connection.value)
        }

    @Test fun blocking_drops_the_connect_control() =
        runTest {
            signedInAs("viewer")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { social.relationship("u1") } returns
                NetworkResult.Success(UserRelationshipDto(relationship = "none", following = false))
            coEvery { blocks.block("u1") } returns NetworkResult.Success(Unit)
            val vm = makeVm()
            vm.load()
            assertTrue(vm.showsConnectAction())
            vm.block()
            assertEquals(ProfileConnection.Blocked, vm.connection.value)
            assertFalse(vm.showsConnectAction())
        }

    @Test fun block_succeeds_and_emits_toast() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { blocks.block("u1") } returns NetworkResult.Success(Unit)
            val vm = makeVm()
            vm.load()
            vm.block()
            assertEquals(PublicProfileActionState.Succeeded, vm.blockState.value)
            assertEquals("User blocked", vm.toastMessage.value)
        }

    @Test fun overflow_flag_toggles() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            assertFalse(vm.showOverflow.value)
            vm.setShowOverflow(true)
            assertTrue(vm.showOverflow.value)
        }

    // P6.5 — Persona vs Local kind discrimination

    @Test fun profile_without_residency_is_persona_kind() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile(residency = null))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PublicProfileUiState.Loaded
            assertEquals(PublicProfileKind.Persona, loaded.content.kind)
            assertEquals("Persona · Verified", loaded.content.header.tierLabel)
            assertFalse(loaded.content.header.isVerifiedNeighbor)
        }

    @Test fun profile_with_verified_residency_is_local_kind() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns
                NetworkResult.Success(profile(residency = mapOf("verified" to true, "address" to "412 Elm St")))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PublicProfileUiState.Loaded
            assertEquals(PublicProfileKind.Local, loaded.content.kind)
            assertTrue(loaded.content.header.isVerifiedNeighbor)
            assertEquals(null, loaded.content.header.tierLabel)
            assertNotNull(loaded.content.neighbor?.mutuals)
        }

    /**
     * `GET /api/users/id/:id` carries no Beacon handle, and `User.username` is
     * a different namespace from `PublicPersona.handle` — so the handshake
     * must not open against a handle we can't attribute.
     */
    @Test fun follow_does_not_use_username_as_beacon_handle() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            vm.follow()
            // T3: with no attributable Beacon handle the handshake stays
            // shut — but the tap now falls through to the plain
            // `api/users/:id/follow` path instead of the old dead-end toast.
            assertFalse(vm.showFollowHandshake.value)
            assertEquals("", vm.loadedPersonaHandle())
            assertEquals(null, vm.toastMessage.value)
        }

    // T3 — handle resolution + the plain follow graph

    @Test fun handle_route_resolves_through_username_endpoint() =
        runTest {
            routeIdentifier = "@mariak"
            coEvery { social.publicProfileByUsername("@mariak") } returns
                NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is PublicProfileUiState.Loaded)
            coVerify(exactly = 1) { social.publicProfileByUsername("@mariak") }
            coVerify(exactly = 0) { repo.publicProfile(any()) }
        }

    @Test fun uuid_route_still_resolves_through_id_endpoint() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            coVerify(exactly = 1) { repo.publicProfile(ROUTE_ID) }
            coVerify(exactly = 0) { social.publicProfileByUsername(any()) }
        }

    @Test fun follow_uses_plain_follow_endpoint_for_ordinary_neighbor() =
        runTest {
            signedInAs("viewer")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { social.relationship("u1") } returns
                NetworkResult.Success(UserRelationshipDto(relationship = "none", following = false))
            coEvery { social.follow("u1") } returns
                NetworkResult.Success(FollowActionResponse(message = "ok", following = true))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.canFollow.value)
            assertFalse(vm.isFollowing.value)

            vm.follow()

            assertTrue(vm.isFollowing.value)
            assertFalse(vm.showFollowHandshake.value)
            coVerify(exactly = 1) { social.follow("u1") }
        }

    @Test fun follow_toggles_to_unfollow_when_already_following() =
        runTest {
            signedInAs("viewer")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            coEvery { social.relationship("u1") } returns
                NetworkResult.Success(UserRelationshipDto(relationship = "none", following = true))
            coEvery { social.unfollow("u1") } returns
                NetworkResult.Success(FollowActionResponse(message = "ok", following = false))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.isFollowing.value)

            vm.toggleFollow()

            assertFalse(vm.isFollowing.value)
            coVerify(exactly = 1) { social.unfollow("u1") }
        }

    @Test fun own_profile_has_no_follow_affordance() =
        runTest {
            signedInAs("u1")
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            assertFalse(vm.canFollow.value)
            vm.toggleFollow()
            assertFalse(vm.isFollowing.value)
            coVerify(exactly = 0) { social.follow(any()) }
        }

    // A21.2 — the Local archetype's post feed

    @Test fun local_profile_projects_user_posts_onto_the_feed() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns
                NetworkResult.Success(profile(residency = mapOf("verified" to true)))
            coEvery { posts.userPosts("u1", any()) } returns
                NetworkResult.Success(
                    MyPostsResponse(
                        listOf(
                            MyPostDto(
                                id = "p1",
                                userId = "u1",
                                content = "Free pile on the curb.",
                                postType = "service_offer",
                                createdAt = "2025-01-01T00:00:00.000Z",
                                likeCount = 28,
                                commentCount = 12,
                                locationName = "88 Beech St",
                            ),
                            MyPostDto(
                                id = "p2",
                                userId = "u1",
                                content = "Water main flagged on Beech.",
                                postType = "recommendation",
                                createdAt = "2025-01-01T00:00:00.000Z",
                            ),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PublicProfileUiState.Loaded
            assertEquals(2, loaded.content.posts.size)
            val first = loaded.content.posts.first()
            assertEquals("Free pile on the curb.", first.body)
            assertEquals("88 Beech St", first.locality)
            assertEquals(28, first.reactions)
            assertEquals(12, first.replies)
            assertEquals(PublicProfilePost.Intent.Offer, first.intent)
            // Never invent a tier chip for a plain neighbourhood post.
            assertEquals(null, first.visibility)
            assertFalse(first.isLocked)
            // A post type with no honest chip renders without one.
            assertEquals(null, loaded.content.posts[1].intent)
            // The neighbour projection sees the same feed.
            assertEquals(2, loaded.content.neighbor?.posts?.size)
        }

    @Test fun local_profile_post_failure_degrades_to_empty_feed() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns
                NetworkResult.Success(profile(residency = mapOf("verified" to true)))
            coEvery { posts.userPosts("u1", any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as PublicProfileUiState.Loaded
            assertTrue(loaded.content.posts.isEmpty())
            assertEquals(PublicProfileKind.Local, loaded.content.kind)
        }

    @Test fun persona_profile_does_not_fetch_user_posts() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile(residency = null))
            val vm = makeVm()
            vm.load()
            coVerify(exactly = 0) { posts.userPosts(any(), any()) }
            assertTrue((vm.state.value as PublicProfileUiState.Loaded).content.posts.isEmpty())
        }

    @Test fun local_tab_defaults_to_posts_and_switches_without_refetch() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns
                NetworkResult.Success(profile(residency = mapOf("verified" to true)))
            val vm = makeVm()
            vm.load()
            assertEquals(LocalProfileTab.Posts, vm.selectedLocalTab.value)
            vm.selectLocalTab(LocalProfileTab.About)
            assertEquals(LocalProfileTab.About, vm.selectedLocalTab.value)
            coVerify(exactly = 1) { repo.publicProfile(ROUTE_ID) }
        }

    @Test fun unlock_broadcast_without_beacon_handle_stays_closed() =
        runTest {
            coEvery { repo.publicProfile(ROUTE_ID) } returns NetworkResult.Success(profile())
            val vm = makeVm()
            vm.load()
            vm.unlockBroadcast(2)
            assertFalse(vm.showFollowHandshake.value)
            assertEquals(null, vm.handshakePreselectedTierRank.value)
            assertEquals("Following isn't available from this profile yet.", vm.toastMessage.value)
        }

    /** Publish a signed-in session so `canFollow` can resolve. */
    private fun signedInAs(userId: String) {
        every { authRepository.state } returns
            MutableStateFlow(
                AuthRepository.State.SignedIn(
                    UserDto(id = userId, email = "$userId@example.com", displayName = userId, avatarUrl = null),
                ),
            )
    }

    private companion object {
        /** Canonical v4 UUID — exercises the `api/users/id/:id` branch. */
        const val ROUTE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
    }
}
