@file:Suppress("MagicNumber", "PackageNaming", "LargeClass")

package app.pantopus.android.ui.screens.compose.pulse

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.posts.PlaceEligibilityResponse
import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.posts.PostCreateResponse
import app.pantopus.android.data.api.models.posts.PostCreateResponsePost
import app.pantopus.android.data.api.models.posts.PostDetailDto
import app.pantopus.android.data.api.models.posts.PostDetailResponse
import app.pantopus.android.data.api.models.posts.PostPrecheckResponse
import app.pantopus.android.data.api.models.posts.PostUpdateRequest
import app.pantopus.android.data.api.models.posts.PostUpdateResponse
import app.pantopus.android.data.api.models.posts.PostUpdateResponsePost
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPostsRepository
import app.pantopus.android.data.location.FallbackLocationProvider
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.posts.PostPrecheckRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.compose.placepicker.MediaCaptureLocation
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Parity coverage for [PulseComposeViewModel]. Mirrors
 * `PantopusTests/Features/Compose/PulseComposeViewModelTests.swift` —
 * every intent variant, per-intent validation, request shape, photo
 * capacity, dirty signal, offline + error paths.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PulseComposeViewModelTest {
    private val repo: PostsRepository = mockk()
    private val uploadRepo: UploadRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor = mockk()
    private val postsRefresh = PulsePostsRefreshNotifier()
    private val locationProvider = FallbackLocationProvider()
    private val businessPosts: BusinessPostsRepository = mockk()

    // Pre-post safety precheck — relaxed so it always fails open.
    private val precheckRepo: PostPrecheckRepository =
        mockk {
            coEvery { precheck(any()) } returns
                NetworkResult.Success(PostPrecheckResponse(ok = true, canPost = true))
        }
    private val isOnline = MutableStateFlow(true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { networkMonitor.isOnline } returns isOnline
        isOnline.value = true
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(intent: PulseComposeIntent = PulseComposeIntent.Ask): PulseComposeViewModel {
        val savedState =
            SavedStateHandle().apply {
                set(PulseComposeViewModel.INTENT_KEY, intent.key)
            }
        return PulseComposeViewModel(
            repo,
            uploadRepo,
            networkMonitor,
            postsRefresh,
            locationProvider,
            savedState,
            businessPosts,
            precheckRepo,
        )
    }

    // MARK: - Defaults

    @Test fun initSeedsIntentFromSavedState() {
        for (intent in PulseComposeIntent.entries) {
            val vm = viewModel(intent)
            assertEquals(intent, vm.activeIntent.value)
            assertEquals(PulseComposeIdentity.Personal, vm.identity.value)
            assertEquals(PulseComposeVisibility.Neighbors, vm.visibility.value)
            assertEquals(PulseLostFoundKind.Lost, vm.lostFoundKind.value)
            assertEquals(PulseAskCategory.Handyman, vm.askCategory.value)
            assertEquals(PulseAnnounceAudience.Neighbors, vm.announceAudience.value)
            assertEquals(5, vm.recommendRating.value)
            assertTrue(vm.photos.value.isEmpty())
        }
    }

    @Test fun fromKeyFallsBackToAsk() {
        assertEquals(PulseComposeIntent.Ask, PulseComposeIntent.fromKey("totally-unknown"))
        assertEquals(PulseComposeIntent.Event, PulseComposeIntent.fromKey("event"))
    }

    // MARK: - Dirty

    @Test fun cleanFormIsNotDirty() {
        for (intent in PulseComposeIntent.entries) {
            val vm = viewModel(intent)
            assertFalse("intent $intent should be clean", vm.isDirty)
        }
    }

    @Test fun identityChangeMarksDirty() {
        val vm = viewModel(PulseComposeIntent.Ask)
        assertFalse(vm.isDirty)
        vm.selectIdentity(PulseComposeIdentity.Home)
        assertTrue(vm.isDirty)
    }

    @Test fun visibilityChangeMarksDirty() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.selectVisibility(PulseComposeVisibility.PublicFeed)
        assertTrue(vm.isDirty)
    }

    @Test fun fieldEditMarksDirty() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.update(PulseComposeField.Title, "Need a plumber")
        assertTrue(vm.isDirty)
    }

    @Test fun photoAttachMarksDirty() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.appendPhoto(PulseComposePhoto(id = "p1", data = byteArrayOf(0xFF.toByte())))
        assertTrue(vm.isDirty)
    }

    @Test fun placeTagMarksDirty() {
        val vm = viewModel(PulseComposeIntent.Ask)
        assertFalse(vm.isDirty)
        vm.selectPlaceTag(placeTag())
        assertTrue(vm.isDirty)
        vm.clearPlaceTag()
        assertFalse(vm.isDirty)
    }

    @Test fun placeTagDoesNotDirtyEditMode() {
        // Place tags are create-only: buildUpdateRequest carries no
        // location fields, so a tag must never enable a no-op Save.
        val vm = editViewModel()
        vm.selectPlaceTag(placeTag())
        assertFalse(vm.isDirty)
    }

    // MARK: - Valid

    @Test fun validFalseForBlankAsk() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.validateAll()
        assertFalse(vm.isValid)
        assertNotNull(vm.fields.value[PulseComposeField.Title]?.error)
        assertNotNull(vm.fields.value[PulseComposeField.Body]?.error)
    }

    @Test fun validWhenAskTitleAndBodyFilled() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.update(PulseComposeField.Title, "Need a plumber")
        vm.update(PulseComposeField.Body, "Pipe is leaking under the sink.")
        assertTrue(vm.isValid)
    }

    @Test fun recommendRequiresBusinessAndBody() {
        val vm = viewModel(PulseComposeIntent.Recommend)
        vm.validateAll()
        assertFalse(vm.isValid)
        vm.update(PulseComposeField.RecommendBusiness, "Joe's Coffee")
        vm.update(PulseComposeField.Body, "Best lattes around.")
        assertNull(vm.fields.value[PulseComposeField.RecommendBusiness]?.error)
        assertNull(vm.fields.value[PulseComposeField.Body]?.error)
        assertTrue(vm.isValid)
    }

    @Test fun eventRequiresTitleDateLocationBody() {
        val vm = viewModel(PulseComposeIntent.Event)
        vm.validateAll()
        assertFalse(vm.isValid)
        vm.update(PulseComposeField.Title, "Block party")
        vm.update(PulseComposeField.EventDate, "2030-08-15")
        vm.update(PulseComposeField.EventLocation, "Elm Park")
        vm.update(PulseComposeField.Body, "Bring chairs.")
        assertTrue(vm.isValid)
    }

    @Test fun lostFoundDoesNotRequireDate() {
        val vm = viewModel(PulseComposeIntent.Lost)
        vm.update(PulseComposeField.Body, "Tortoiseshell cat, blue collar.")
        vm.update(PulseComposeField.LostLastSeenLocation, "5th & Elm")
        assertTrue(vm.isValid)
    }

    @Test fun announceRequiresTitleAndBody() {
        val vm = viewModel(PulseComposeIntent.Announce)
        vm.validateAll()
        assertFalse(vm.isValid)
        vm.update(PulseComposeField.Title, "Street closure")
        vm.update(PulseComposeField.Body, "Saturday 10-2 for the parade.")
        assertTrue(vm.isValid)
    }

    // MARK: - Photo capacity

    @Test fun photosCappedAtFour() {
        val vm = viewModel(PulseComposeIntent.Ask)
        for (i in 0..9) {
            vm.appendPhoto(PulseComposePhoto(id = "p$i", data = byteArrayOf(i.toByte())))
        }
        assertEquals(PULSE_COMPOSE_MAX_PHOTOS, vm.photos.value.size)
    }

    @Test fun setPhotosTruncatesAtMax() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.setPhotos(
            (0 until PULSE_COMPOSE_MAX_PHOTOS + 3).map {
                PulseComposePhoto(id = "p$it", data = byteArrayOf(it.toByte()))
            },
        )
        assertEquals(PULSE_COMPOSE_MAX_PHOTOS, vm.photos.value.size)
    }

    @Test fun removePhoto() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.appendPhoto(PulseComposePhoto(id = "p1", data = byteArrayOf(0xAA.toByte())))
        assertEquals(1, vm.photos.value.size)
        vm.removePhoto("p1")
        assertEquals(0, vm.photos.value.size)
    }

    // MARK: - Request shape

    @Test fun askRequestCarriesCategoryAndIdentity() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.selectIdentity(PulseComposeIdentity.Home)
        vm.update(PulseComposeField.Title, "Plumber recs?")
        vm.update(PulseComposeField.Body, "Need someone soon.")
        vm.selectAskCategory(PulseAskCategory.Handyman)
        val request = vm.buildRequest()
        assertEquals("ask_local", request.postType)
        assertEquals("Plumber recs?", request.title)
        assertEquals("Need someone soon.", request.content)
        assertEquals("home", request.postAs)
        assertEquals("handyman", request.serviceCategory)
        assertEquals("ask", request.purpose)
    }

    @Test fun recommendRequestEmbedsStarsAndBusinessName() {
        val vm = viewModel(PulseComposeIntent.Recommend)
        vm.update(PulseComposeField.RecommendBusiness, "Joe's Coffee")
        vm.update(PulseComposeField.Body, "Great lattes.")
        vm.selectRecommendRating(4)
        val request = vm.buildRequest()
        assertEquals("recommendation", request.postType)
        assertEquals("Joe's Coffee", request.businessName)
        assertTrue(request.content.startsWith("★★★★☆"))
        assertTrue(request.content.contains("Great lattes."))
    }

    @Test fun eventRequestNormalizesISODate() {
        val vm = viewModel(PulseComposeIntent.Event)
        vm.update(PulseComposeField.Title, "Block party")
        vm.update(PulseComposeField.EventDate, "2030-08-15")
        vm.update(PulseComposeField.EventLocation, "Elm Park")
        vm.update(PulseComposeField.Body, "Bring chairs.")
        val request = vm.buildRequest()
        assertEquals("event", request.postType)
        assertNotNull(request.eventDate)
        assertTrue(request.eventDate!!.startsWith("2030-08-15"))
        assertEquals("Elm Park", request.eventVenue)
    }

    @Test fun lostRequestPrefixesLastSeenAndCarriesType() {
        val vm = viewModel(PulseComposeIntent.Lost)
        vm.update(PulseComposeField.Body, "Mochi the cat.")
        vm.update(PulseComposeField.LostLastSeenLocation, "5th & Elm")
        vm.selectLostFoundKind(PulseLostFoundKind.Found)
        val request = vm.buildRequest()
        assertEquals("lost_found", request.postType)
        assertEquals("found", request.lostFoundType)
        assertTrue(request.content.startsWith("Last seen: 5th & Elm"))
        assertTrue(request.content.contains("Mochi the cat."))
    }

    @Test fun announceRequestUsesAudienceVisibility() {
        val vm = viewModel(PulseComposeIntent.Announce)
        vm.update(PulseComposeField.Title, "Street closure")
        vm.update(PulseComposeField.Body, "Sat 10-2.")
        vm.selectAnnounceAudience(PulseAnnounceAudience.Followers)
        val request = vm.buildRequest()
        assertEquals("local_update", request.postType)
        assertEquals("nearby", request.audience)
        assertEquals("followers", request.visibility)
    }

    // MARK: - Place tag

    @Test fun placeTagLandsOnRequest() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.update(PulseComposeField.Title, "Coffee meetup?")
        vm.update(PulseComposeField.Body, "Anyone around?")
        vm.selectPlaceTag(placeTag())
        val request = vm.buildRequest()
        assertEquals(45.52, request.latitude!!, 0.0)
        assertEquals(-122.68, request.longitude!!, 0.0)
        assertEquals("Blue Bottle", request.locationName)
        assertEquals("123 Main St", request.locationAddress)
        assertEquals("mapbox", request.geocodeProvider)
        assertEquals("poi", request.geocodeAccuracy)
        assertEquals("poi.123", request.geocodePlaceId)
    }

    @Test fun placeTagOverridesFlowTargetLocationButNotGps() {
        coEvery { repo.placeEligibility(any(), any(), any(), any(), any()) } returns
            NetworkResult.Success(PlaceEligibilityResponse(eligible = true))
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.applyFlowContext(
            target = PulsePostingTarget.CurrentLocation(45.5, -122.4, "Camas, WA"),
            purpose = null,
        )
        vm.update(PulseComposeField.Title, "Hello")
        vm.update(PulseComposeField.Body, "What's up")
        vm.selectPlaceTag(placeTag())
        val request = vm.buildRequest()
        // The explicit pick wins over the flow-target context (the tag is
        // applied AFTER mergeTargetContext).
        assertEquals(45.52, request.latitude!!, 0.0)
        assertEquals(-122.68, request.longitude!!, 0.0)
        assertEquals("Blue Bottle", request.locationName)
        assertEquals("poi.123", request.geocodePlaceId)
        // GPS attestation still carries the device/target fix, not the venue.
        assertEquals(45.5, request.gpsLatitude!!, 0.0)
        assertEquals(-122.4, request.gpsLongitude!!, 0.0)
    }

    @Test fun clearPlaceTagRemovesFields() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.update(PulseComposeField.Title, "Coffee meetup?")
        vm.update(PulseComposeField.Body, "Anyone around?")
        vm.selectPlaceTag(placeTag())
        vm.clearPlaceTag()
        val request = vm.buildRequest()
        assertNull(request.latitude)
        assertNull(request.longitude)
        assertNull(request.locationName)
        assertNull(request.locationAddress)
        assertNull(request.geocodeProvider)
        assertNull(request.geocodeAccuracy)
        assertNull(request.geocodePlaceId)
    }

    private fun placeTag(): PostPlaceTag =
        PostPlaceTag(
            name = "Blue Bottle",
            address = "123 Main St",
            latitude = 45.52,
            longitude = -122.68,
            placeId = "poi.123",
            kind = "poi",
        )

    // MARK: - Media capture location (ADDENDUM 2)

    @Test fun mediaCaptureLocationIsFirstGeotaggedPhoto() {
        val vm = viewModel(PulseComposeIntent.Ask)
        assertNull(vm.mediaCaptureLocation)
        vm.appendPhoto(PulseComposePhoto(id = "p1", data = byteArrayOf(1)))
        assertNull(vm.mediaCaptureLocation)
        vm.appendPhoto(
            PulseComposePhoto(id = "p2", data = byteArrayOf(2), capturedLatitude = 41.8781, capturedLongitude = -87.6298),
        )
        vm.appendPhoto(
            PulseComposePhoto(id = "p3", data = byteArrayOf(3), capturedLatitude = 1.0, capturedLongitude = 2.0),
        )
        // First geotagged attachment wins (attach order), skipping the
        // untagged one in front of it.
        assertEquals(MediaCaptureLocation(latitude = 41.8781, longitude = -87.6298), vm.mediaCaptureLocation)
    }

    @Test fun mediaCaptureLocationRecomputesOnRemove() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.appendPhoto(
            PulseComposePhoto(id = "p1", data = byteArrayOf(1), capturedLatitude = 41.8781, capturedLongitude = -87.6298),
        )
        vm.appendPhoto(
            PulseComposePhoto(id = "p2", data = byteArrayOf(2), capturedLatitude = 1.0, capturedLongitude = 2.0),
        )
        vm.removePhoto("p1")
        assertEquals(MediaCaptureLocation(latitude = 1.0, longitude = 2.0), vm.mediaCaptureLocation)
        vm.removePhoto("p2")
        assertNull(vm.mediaCaptureLocation)
    }

    @Test fun mediaCaptureLocationRecomputesOnSetPhotos() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.setPhotos(
            listOf(
                PulseComposePhoto(id = "p1", data = byteArrayOf(1), capturedLatitude = 41.8781, capturedLongitude = -87.6298),
            ),
        )
        assertEquals(MediaCaptureLocation(latitude = 41.8781, longitude = -87.6298), vm.mediaCaptureLocation)
        vm.setPhotos(emptyList())
        assertNull(vm.mediaCaptureLocation)
    }

    @Test fun mediaCaptureLocationRequiresBothCoordinates() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.appendPhoto(PulseComposePhoto(id = "p1", data = byteArrayOf(1), capturedLatitude = 41.8781))
        assertNull(vm.mediaCaptureLocation)
    }

    @Test fun mediaCaptureLocationNeverLandsOnTheRequest() {
        // PRIVACY RULE — media GPS is a local picker anchor only; the
        // request carries location fields only for an explicit pick.
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.update(PulseComposeField.Title, "Coffee meetup?")
        vm.update(PulseComposeField.Body, "Anyone around?")
        vm.appendPhoto(
            PulseComposePhoto(id = "p1", data = byteArrayOf(1), capturedLatitude = 41.8781, capturedLongitude = -87.6298),
        )
        val request = vm.buildRequest()
        assertNull(request.latitude)
        assertNull(request.longitude)
        assertNull(request.locationName)
        assertNull(request.gpsLatitude)
        assertNull(request.gpsLongitude)
    }

    @Test fun headsUpRequestCarriesSafetyAlertKind() {
        coEvery { repo.placeEligibility(any(), any(), any(), any(), any()) } returns
            NetworkResult.Success(PlaceEligibilityResponse(eligible = true))
        val vm = viewModel(PulseComposeIntent.Announce)
        vm.applyFlowContext(
            target = PulsePostingTarget.CurrentLocation(45.5, -122.4, "Camas, WA"),
            purpose = PulseComposePurpose.HeadsUp,
        )
        vm.update(PulseComposeField.Title, "Hello")
        vm.update(PulseComposeField.Body, "What's up")
        vm.selectSafetyAlertKind(PulseSafetyAlertKind.Suspicious)
        val request = vm.buildRequest()
        assertEquals("alert", request.postType)
        assertEquals("heads_up", request.purpose)
        assertEquals("suspicious", request.safetyAlertKind)
    }

    // MARK: - Submit pipeline

    @Test fun submitHappyPathSucceedsAndDismisses() =
        runTest {
            val body = slot<PostCreateRequest>()
            coEvery { repo.createPost(capture(body)) } returns
                NetworkResult.Success(
                    PostCreateResponse(message = "ok", post = PostCreateResponsePost(id = "p_42")),
                )
            val vm = viewModel(PulseComposeIntent.Ask)
            vm.update(PulseComposeField.Title, "Need a plumber")
            vm.update(PulseComposeField.Body, "Pipe is leaking.")
            vm.submit()
            assertTrue(vm.state.value is PulseComposeUiState.Success)
            assertEquals("p_42", (vm.state.value as PulseComposeUiState.Success).postId)
            assertEquals("Posted", vm.toast.value?.text)
            assertEquals(false, vm.toast.value?.isError)
            assertTrue(vm.shouldDismiss.value)
            assertEquals("Need a plumber", body.captured.title)
        }

    @Test fun submitErrorSurfacesToast() =
        runTest {
            coEvery { repo.createPost(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = viewModel(PulseComposeIntent.Ask)
            vm.update(PulseComposeField.Title, "Need a plumber")
            vm.update(PulseComposeField.Body, "Pipe is leaking.")
            vm.submit()
            assertTrue(vm.state.value is PulseComposeUiState.Error)
            assertEquals(true, vm.toast.value?.isError)
            assertFalse(vm.shouldDismiss.value)
        }

    @Test fun submitBlockedByValidation() =
        runTest {
            val vm = viewModel(PulseComposeIntent.Ask)
            vm.submit()
            assertTrue(vm.state.value is PulseComposeUiState.Idle)
            assertEquals(true, vm.toast.value?.isError)
            assertEquals(1, vm.shakeTrigger.value)
        }

    @Test fun submitBlockedByOffline() =
        runTest {
            isOnline.value = false
            val vm = viewModel(PulseComposeIntent.Ask)
            vm.update(PulseComposeField.Title, "Need a plumber")
            vm.update(PulseComposeField.Body, "Pipe is leaking.")
            vm.submit()
            assertTrue(vm.state.value is PulseComposeUiState.Idle)
            assertEquals(true, vm.toast.value?.isError)
        }

    // MARK: - Intent switch preserves draft

    @Test fun switchIntentPreservesBody() {
        val vm = viewModel(PulseComposeIntent.Ask)
        vm.update(PulseComposeField.Body, "Need help with this.")
        vm.selectIntent(PulseComposeIntent.Announce)
        assertEquals("Need help with this.", vm.fields.value[PulseComposeField.Body]?.value)
        assertEquals(PulseComposeIntent.Announce, vm.activeIntent.value)
    }

    // MARK: - Edit mode (P3.5)

    private fun editViewModel(postId: String = "p_42"): PulseComposeViewModel {
        val savedState =
            SavedStateHandle().apply {
                set(PulseComposeViewModel.POST_ID_KEY, postId)
            }
        return PulseComposeViewModel(
            repo,
            uploadRepo,
            networkMonitor,
            postsRefresh,
            locationProvider,
            savedState,
            businessPosts,
            precheckRepo,
        )
    }

    private data class SamplePost(
        val postType: String,
        val content: String,
        val title: String? = null,
        val visibility: String = "neighborhood",
        val metadata: SamplePostMetadata = SamplePostMetadata(),
    )

    private data class SamplePostMetadata(
        val eventDate: String? = null,
        val eventVenue: String? = null,
        val lostFoundType: String? = null,
        val serviceCategory: String? = null,
        val dealBusinessName: String? = null,
    )

    private fun samplePost(sample: SamplePost): PostDetailDto =
        PostDetailDto(
            id = "p_42",
            userId = "u_1",
            title = sample.title,
            content = sample.content,
            postType = sample.postType,
            postFormat = null,
            purpose = null,
            mediaUrls = emptyList(),
            mediaTypes = null,
            mediaLiveUrls = emptyList(),
            createdAt = "2026-05-19T00:00:00Z",
            updatedAt = null,
            isEdited = null,
            likeCount = 0,
            commentCount = 0,
            shareCount = null,
            viewCount = null,
            creator = null,
            home = null,
            userHasLiked = false,
            userHasSaved = false,
            userHasReposted = false,
            comments = emptyList(),
            visibility = sample.visibility,
            eventDate = sample.metadata.eventDate,
            eventVenue = sample.metadata.eventVenue,
            lostFoundType = sample.metadata.lostFoundType,
            serviceCategory = sample.metadata.serviceCategory,
            dealBusinessName = sample.metadata.dealBusinessName,
        )

    @Test fun isEditingTrueWhenPostIdProvided() {
        val vm = editViewModel()
        assertTrue(vm.isEditing)
        assertEquals("p_42", vm.editingPostId)
        assertEquals("Edit post", vm.displayTitle)
        assertEquals("Save", vm.ctaLabel)
        assertTrue(vm.isIntentLocked)
    }

    @Test fun isEditingFalseInCreateMode() {
        val vm = viewModel(PulseComposeIntent.Ask)
        assertFalse(vm.isEditing)
        assertNull(vm.editingPostId)
        assertEquals("New post", vm.displayTitle)
        assertEquals("Post", vm.ctaLabel)
        assertFalse(vm.isIntentLocked)
    }

    @Test fun selectIntentLockedInEditMode() {
        val vm = editViewModel()
        vm.selectIntent(PulseComposeIntent.Announce)
        assertEquals(PulseComposeIntent.Ask, vm.activeIntent.value)
    }

    @Test fun loadForEditAskPrefillSeedsFields() =
        runTest {
            coEvery { repo.detail("p_42") } returns
                NetworkResult.Success(
                    PostDetailResponse(
                        post =
                            samplePost(
                                SamplePost(
                                    postType = "ask_local",
                                    content = "Pipe is leaking.",
                                    title = "Need a plumber",
                                    metadata = SamplePostMetadata(serviceCategory = "cleaning"),
                                ),
                            ),
                    ),
                )
            val vm = editViewModel()
            assertTrue(vm.prefillState.value is PulseComposePrefillState.Loading)
            vm.loadForEdit()
            assertTrue(vm.prefillState.value is PulseComposePrefillState.Ready)
            assertEquals(PulseComposeIntent.Ask, vm.activeIntent.value)
            assertEquals("Need a plumber", vm.fields.value[PulseComposeField.Title]?.value)
            assertEquals("Pipe is leaking.", vm.fields.value[PulseComposeField.Body]?.value)
            assertEquals(PulseAskCategory.Cleaning, vm.askCategory.value)
            // Re-baselined — every field starts non-dirty.
            assertFalse(vm.isDirty)
        }

    @Test fun loadForEditRecommendUnwrapsStarsAndBody() =
        runTest {
            coEvery { repo.detail("p_42") } returns
                NetworkResult.Success(
                    PostDetailResponse(
                        post =
                            samplePost(
                                SamplePost(
                                    postType = "recommendation",
                                    content = "★★★★☆\n\nGreat lattes.",
                                    metadata = SamplePostMetadata(dealBusinessName = "Joe's Coffee"),
                                ),
                            ),
                    ),
                )
            val vm = editViewModel()
            vm.loadForEdit()
            assertEquals(PulseComposeIntent.Recommend, vm.activeIntent.value)
            assertEquals(4, vm.recommendRating.value)
            assertEquals("Great lattes.", vm.fields.value[PulseComposeField.Body]?.value)
            assertEquals("Joe's Coffee", vm.fields.value[PulseComposeField.RecommendBusiness]?.value)
            assertFalse(vm.isDirty)
        }

    @Test fun loadForEditLostUnwrapsLastSeenPrefix() =
        runTest {
            coEvery { repo.detail("p_42") } returns
                NetworkResult.Success(
                    PostDetailResponse(
                        post =
                            samplePost(
                                SamplePost(
                                    postType = "lost_found",
                                    content = "Last seen: 5th & Elm\n\nMochi the cat.",
                                    metadata = SamplePostMetadata(lostFoundType = "lost"),
                                ),
                            ),
                    ),
                )
            val vm = editViewModel()
            vm.loadForEdit()
            assertEquals(PulseComposeIntent.Lost, vm.activeIntent.value)
            assertEquals("5th & Elm", vm.fields.value[PulseComposeField.LostLastSeenLocation]?.value)
            assertEquals("Mochi the cat.", vm.fields.value[PulseComposeField.Body]?.value)
            assertEquals(PulseLostFoundKind.Lost, vm.lostFoundKind.value)
            assertFalse(vm.isDirty)
        }

    @Test fun loadForEditEventNormalizesISODate() =
        runTest {
            coEvery { repo.detail("p_42") } returns
                NetworkResult.Success(
                    PostDetailResponse(
                        post =
                            samplePost(
                                SamplePost(
                                    postType = "event",
                                    content = "Bring chairs.",
                                    title = "Block party",
                                    metadata =
                                        SamplePostMetadata(
                                            eventDate = "2030-08-15T17:00:00Z",
                                            eventVenue = "Elm Park",
                                        ),
                                ),
                            ),
                    ),
                )
            val vm = editViewModel()
            vm.loadForEdit()
            assertEquals(PulseComposeIntent.Event, vm.activeIntent.value)
            assertEquals("Block party", vm.fields.value[PulseComposeField.Title]?.value)
            assertEquals("Elm Park", vm.fields.value[PulseComposeField.EventLocation]?.value)
            assertEquals("2030-08-15 17:00", vm.fields.value[PulseComposeField.EventDate]?.value)
            assertFalse(vm.isDirty)
        }

    @Test fun loadForEditFailureSurfacesPrefillError() =
        runTest {
            coEvery { repo.detail("p_42") } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = editViewModel()
            vm.loadForEdit()
            assertTrue(vm.prefillState.value is PulseComposePrefillState.Error)
        }

    @Test fun buildUpdateRequestForAskCarriesEditableFields() {
        val vm = editViewModel()
        vm.update(PulseComposeField.Title, "New title")
        vm.update(PulseComposeField.Body, "Updated body.")
        vm.selectAskCategory(PulseAskCategory.Advice)
        val request = vm.buildUpdateRequest()
        assertEquals("New title", request.title)
        assertEquals("Updated body.", request.content)
        assertEquals("advice", request.serviceCategory)
        assertEquals("neighborhood", request.visibility)
    }

    @Test fun editSubmitSendsPATCH() =
        runTest {
            coEvery { repo.detail("p_42") } returns
                NetworkResult.Success(
                    PostDetailResponse(
                        post =
                            samplePost(
                                SamplePost(
                                    postType = "ask_local",
                                    content = "Pipe is leaking.",
                                    title = "Need a plumber",
                                ),
                            ),
                    ),
                )
            val updateSlot = slot<PostUpdateRequest>()
            coEvery { repo.updatePost("p_42", capture(updateSlot)) } returns
                NetworkResult.Success(
                    PostUpdateResponse(
                        message = "Post updated successfully",
                        post = PostUpdateResponsePost(id = "p_42"),
                    ),
                )
            val vm = editViewModel()
            vm.loadForEdit()
            vm.update(PulseComposeField.Body, "Pipe still leaking.")
            vm.submit()
            assertTrue(vm.state.value is PulseComposeUiState.Success)
            assertEquals("p_42", (vm.state.value as PulseComposeUiState.Success).postId)
            assertTrue(vm.shouldDismiss.value)
            assertEquals("Saved", vm.toast.value?.text)
            assertEquals("Pipe still leaking.", updateSlot.captured.content)
        }
}
