@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.business_profile

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemDto
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessFollowResponse
import app.pantopus.android.data.api.models.businesses.BusinessGeoPoint
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.models.businesses.BusinessLocationDto
import app.pantopus.android.data.api.models.businesses.BusinessProfileDetailDto
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businesses.BusinessServiceAreaDto
import app.pantopus.android.data.api.models.businesses.BusinessUserDetailDto
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.profile.PublicProfileReview
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPagesRepository
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.profile.ProfileRepository
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDateTime

@OptIn(ExperimentalCoroutinesApi::class)
class BusinessProfileViewModelTest {
    private val businesses: BusinessesRepository = mockk()
    private val profiles: ProfileRepository = mockk()

    /**
     * C4 — only reached when the `pageSlug` nav arg is present, which these
     * tests never set; a relaxed mock keeps the constructor satisfied.
     */
    private val businessPages: BusinessPagesRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): BusinessProfileViewModel =
        BusinessProfileViewModel(
            businesses = businesses,
            profiles = profiles,
            businessPages = businessPages,
            savedStateHandle = SavedStateHandle(mapOf(BUSINESS_PROFILE_BUSINESS_ID_KEY to "biz-1")),
        )

    private fun sampleDetail(): BusinessDetailResponse =
        BusinessDetailResponse(
            business =
                BusinessUserDetailDto(
                    id = "biz-1",
                    username = "elmpark-coffee",
                    name = "Elm Park Coffee",
                    bio = "Slow coffee on the corner.",
                    tagline = "Made by neighbors",
                    profilePictureUrl = "https://example.test/elm.png",
                    accountType = "business",
                    city = "Cambridge",
                    state = "MA",
                    verified = true,
                    averageRating = 4.7,
                    reviewCount = 12,
                    followersCount = 240,
                    gigsCompleted = 0,
                    createdAt = "2023-04-10T00:00:00.000Z",
                ),
            profile =
                BusinessProfileDetailDto(
                    businessUserId = "biz-1",
                    businessType = "cafe",
                    categories = listOf("Coffee", "Bakery"),
                    description = "Pour-over coffee and laminated pastry.",
                    publicEmail = "hi@elmpark.test",
                    publicPhone = "+1-555-0101",
                    website = "elmparkcoffee.test",
                    serviceArea =
                        BusinessServiceAreaDto(
                            legacyDisplayText = "Serves Cambridge & Somerville",
                        ),
                    isPublished = true,
                    verificationStatus = "address_verified",
                    primaryLocation =
                        BusinessLocationDto(
                            id = "loc-1",
                            label = "Main shop",
                            isPrimary = true,
                            address = "41 Elm Street",
                            city = "Cambridge",
                            state = "MA",
                            zipcode = "02139",
                            country = "US",
                            location = BusinessGeoPoint(lat = 42.37, lng = -71.11),
                        ),
                ),
            locations = emptyList(),
            access = null,
        )

    private fun samplePublic(): BusinessPublicResponse =
        BusinessPublicResponse(
            hours =
                listOf(
                    BusinessHoursDto("h-mon", "loc-1", 1, "07:00", "16:00", false),
                    BusinessHoursDto("h-sun", "loc-1", 0, null, null, true),
                ),
            catalog =
                listOf(
                    BusinessCatalogItemDto(
                        id = "svc-1",
                        name = "Pour over",
                        description = "Single-origin.",
                        kind = "service",
                        priceCents = 500,
                        currency = "USD",
                    ),
                ),
        )

    private fun samplePublicProfile(): PublicProfileDto =
        PublicProfileDto(
            id = "biz-1",
            username = "elmpark-coffee",
            name = "Elm Park Coffee",
            accountType = "business",
            verified = true,
            createdAt = "2023-04-10T00:00:00.000Z",
            averageRating = 4.7,
            reviewCount = 12,
            followersCount = 240,
            reviews =
                listOf(
                    PublicProfileReview(
                        id = "r1",
                        reviewerId = "u9",
                        revieweeId = "biz-1",
                        rating = 5,
                        content = "Best coffee on Elm.",
                        createdAt = "2026-05-01T00:00:00.000Z",
                        reviewerName = "Sam",
                        reviewerAvatar = null,
                        reviewerUsername = "sam",
                    ),
                ),
        )

    @Test
    fun load_projectsHeaderStatsCategoriesHoursServicesAndReviews() =
        runTest {
            coEvery { businesses.business("biz-1") } returns NetworkResult.Success(sampleDetail())
            coEvery { businesses.publicBusiness("elmpark-coffee") } returns NetworkResult.Success(samplePublic())
            coEvery { profiles.publicProfile("biz-1") } returns NetworkResult.Success(samplePublicProfile())
            coEvery { businesses.followBusiness("biz-1") } returns NetworkResult.Success(BusinessFollowResponse(following = true))

            val vm = makeVm()
            vm.load()

            val c = (vm.state.value as BusinessProfileUiState.Loaded).content

            assertEquals("Elm Park Coffee", c.header.displayName)
            assertEquals("elmpark-coffee", c.header.handle)
            assertEquals("Cambridge, MA", c.header.locality)
            assertTrue(c.header.isVerified)

            assertEquals(listOf("Coffee", "Bakery"), c.categories.map { it.label })
            assertEquals(BusinessCategoryAccent.Business, c.categories.first().accent)
            assertEquals(BusinessCategoryAccent.Neutral, c.categories.last().accent)

            assertEquals(listOf("12 reviews", "Jobs done", "Followers"), c.stats.map { it.label })
            assertEquals("4.7", c.stats[0].value)
            assertEquals(BusinessStatTint.Star, c.stats[0].tint)
            assertEquals("240", c.stats[2].value)

            assertEquals(false, c.isNewlyClaimed)
            assertEquals("Pour-over coffee and laminated pastry.", c.about)

            assertEquals(2, c.hours.size)
            assertEquals(listOf("Sunday", "Monday"), c.hours.map { it.dayLabel })
            assertTrue(c.hours.first().isClosed)

            assertNotNull(c.serviceArea)
            assertEquals("Serves Cambridge & Somerville", c.serviceArea?.serviceArea)
            assertEquals("Elm Park Coffee", c.savedPlace?.label)
            assertEquals(42.37, c.savedPlace?.latitude)
            assertEquals(-71.11, c.savedPlace?.longitude)
            assertEquals("Cambridge", c.savedPlace?.city)
            assertEquals("MA", c.savedPlace?.state)
            assertEquals("biz-1", c.savedPlace?.sourceId)

            assertEquals(1, c.services.size)
            assertEquals("$5", c.services.first().priceLabel)

            assertEquals(12, c.reviewSummary?.count)
            assertEquals(1, c.reviews.size)
            assertEquals("Sam", c.reviews.first().reviewerName)
        }

    @Test
    fun load_suppressesSavedPlaceForOwnedBusiness() =
        runTest {
            coEvery { businesses.business("biz-1") } returns
                NetworkResult.Success(sampleDetail().copy(access = BusinessAccessDto(hasAccess = true, isOwner = true)))
            coEvery { businesses.publicBusiness("elmpark-coffee") } returns NetworkResult.Success(samplePublic())
            coEvery { profiles.publicProfile("biz-1") } returns NetworkResult.Success(samplePublicProfile())

            val vm = makeVm()
            vm.load()

            val c = (vm.state.value as BusinessProfileUiState.Loaded).content
            assertTrue(c.viewerIsOwner)
            assertNull(c.savedPlace)
        }

    @Test
    fun load_emptyPublicResponseLeavesServicesAndHoursEmpty() =
        runTest {
            coEvery { businesses.business("biz-1") } returns NetworkResult.Success(sampleDetail())
            coEvery { businesses.publicBusiness("elmpark-coffee") } returns
                NetworkResult.Success(BusinessPublicResponse(emptyList(), emptyList()))
            coEvery { profiles.publicProfile("biz-1") } returns NetworkResult.Success(samplePublicProfile())

            val vm = makeVm()
            vm.load()

            val c = (vm.state.value as BusinessProfileUiState.Loaded).content
            assertTrue(c.services.isEmpty())
            assertTrue(c.hours.isEmpty())
            assertNull(c.status)
        }

    @Test
    fun save_callsFollowEndpointAndEmitsToast() =
        runTest {
            coEvery { businesses.followBusiness("biz-1") } returns NetworkResult.Success(BusinessFollowResponse(following = true))

            val vm = makeVm()
            vm.save()

            assertEquals(BusinessProfileSaveState.Saved, vm.saveState.value)
            assertEquals("Saved", vm.toastMessage.value)
        }

    @Test
    fun load_newlyClaimedProjectsNewStatAndCallDock() =
        runTest {
            val newDetail =
                sampleDetail().copy(
                    business =
                        sampleDetail().business.copy(
                            reviewCount = 0,
                            followersCount = 0,
                            gigsCompleted = 0,
                            averageRating = null,
                        ),
                )
            val emptyProfile =
                samplePublicProfile().copy(reviewCount = 0, averageRating = null, reviews = emptyList())
            coEvery { businesses.business("biz-1") } returns NetworkResult.Success(newDetail)
            coEvery { businesses.publicBusiness("elmpark-coffee") } returns
                NetworkResult.Success(BusinessPublicResponse(emptyList(), emptyList()))
            coEvery { profiles.publicProfile("biz-1") } returns NetworkResult.Success(emptyProfile)

            val vm = makeVm()
            vm.load()

            val c = (vm.state.value as BusinessProfileUiState.Loaded).content
            assertTrue(c.isNewlyClaimed)
            assertEquals(listOf("No reviews yet", "Jobs done", "On Pantopus"), c.stats.map { it.label })
            assertEquals("—", c.stats[0].value)
            assertEquals("New", c.stats[2].value)
            assertEquals(BusinessStatTint.Business, c.stats[2].tint)
            assertNull(c.reviewSummary)
            assertEquals(BusinessActionDock.Secondary.Call, c.dock.secondary)
        }

    @Test
    fun load_primary404EmitsNotFound() =
        runTest {
            coEvery { businesses.business("biz-1") } returns NetworkResult.Failure(NetworkError.NotFound)

            val vm = makeVm()
            vm.load()

            assertEquals(BusinessProfileUiState.NotFound, vm.state.value)
        }

    @Test
    fun load_primaryTransportErrorEmitsError() =
        runTest {
            coEvery { businesses.business("biz-1") } returns
                NetworkResult.Failure(NetworkError.Transport(RuntimeException("offline")))

            val vm = makeVm()
            vm.load()

            assertTrue(vm.state.value is BusinessProfileUiState.Error)
        }

    @Test
    fun computeOpenState_openNow() {
        val vm = makeVm()
        // 2024-01-01 is a Monday.
        val rows = listOf(BusinessHoursDto("h", null, 1, "09:00", "17:00", false))
        val status = vm.computeOpenState(rows, LocalDateTime.of(2024, 1, 1, 12, 0))
        assertEquals(true, status?.isOpen)
        assertEquals("Open now", status?.chipLabel)
    }

    @Test
    fun computeOpenState_closedBeforeOpening() {
        val vm = makeVm()
        val rows = listOf(BusinessHoursDto("h", null, 1, "09:00", "17:00", false))
        val status = vm.computeOpenState(rows, LocalDateTime.of(2024, 1, 1, 8, 0))
        assertEquals(false, status?.isOpen)
        assertEquals("Closed · opens 9 AM", status?.chipLabel)
    }

    @Test
    fun computeOpenState_closedFindsNextDay() {
        val vm = makeVm()
        // 2024-01-02 is a Tuesday; only Monday has hours.
        val rows = listOf(BusinessHoursDto("h", null, 1, "09:00", "17:00", false))
        val status = vm.computeOpenState(rows, LocalDateTime.of(2024, 1, 2, 12, 0))
        assertEquals(false, status?.isOpen)
        assertEquals("Opens Monday at 9 AM", status?.statusDetail)
    }

    @Test
    fun computeOpenState_nullWhenNoHours() {
        val vm = makeVm()
        assertNull(vm.computeOpenState(emptyList(), LocalDateTime.of(2024, 1, 1, 12, 0)))
    }

    @Test
    fun save_movesIdleToSavedAndEmitsToast() =
        runTest {
            coEvery { businesses.business("biz-1") } returns NetworkResult.Success(sampleDetail())
            coEvery { businesses.publicBusiness("elmpark-coffee") } returns NetworkResult.Success(samplePublic())
            coEvery { profiles.publicProfile("biz-1") } returns NetworkResult.Success(samplePublicProfile())
            coEvery { businesses.followBusiness("biz-1") } returns NetworkResult.Success(BusinessFollowResponse(following = true))

            val vm = makeVm()
            vm.load()
            vm.save()

            assertEquals(BusinessProfileSaveState.Saved, vm.saveState.value)
            assertEquals("Saved", vm.toastMessage.value)
        }
}
