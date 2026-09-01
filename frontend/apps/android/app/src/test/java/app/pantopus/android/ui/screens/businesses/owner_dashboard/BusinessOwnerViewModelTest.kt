@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.owner_dashboard

import android.content.SharedPreferences
import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.businesses.BusinessDashboardProfileDto
import app.pantopus.android.data.api.models.businesses.BusinessDashboardResponse
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessInsightsFollowersDto
import app.pantopus.android.data.api.models.businesses.BusinessInsightsResponse
import app.pantopus.android.data.api.models.businesses.BusinessInsightsReviewsDto
import app.pantopus.android.data.api.models.businesses.BusinessInsightsViewsDto
import app.pantopus.android.data.api.models.businesses.BusinessLocationDto
import app.pantopus.android.data.api.models.businesses.BusinessOnboardingDto
import app.pantopus.android.data.api.models.businesses.BusinessOnboardingItemDto
import app.pantopus.android.data.api.models.businesses.BusinessOwnerReviewDto
import app.pantopus.android.data.api.models.businesses.BusinessOwnerReviewsResponse
import app.pantopus.android.data.api.models.businesses.BusinessProfileDetailDto
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businesses.BusinessUserDetailDto
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.businessfounding.BusinessFoundingRepository
import app.pantopus.android.data.profile.ProfileRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A10.7 / P1-C — owner-dashboard view-model coverage. The data is now live, so
 * the suite mocks the owner repositories and pins the projection
 * (tiles / strength / reviews), the seed hook, and the optimistic reply.
 * Mirrors iOS `BusinessOwnerViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BusinessOwnerViewModelTest {
    private val businesses: BusinessesRepository = mockk()
    private val profiles: ProfileRepository = mockk()
    private val founding: BusinessFoundingRepository = mockk()
    private val prefs: SharedPreferences = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Founding banner dismissed → the status fetch is short-circuited,
        // keeping these cases focused on the dashboard projection.
        every { prefs.getBoolean(any(), any()) } returns true
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): BusinessOwnerViewModel =
        BusinessOwnerViewModel(
            businesses = businesses,
            profiles = profiles,
            founding = founding,
            prefs = prefs,
            savedStateHandle = SavedStateHandle(mapOf(BUSINESS_OWNER_BUSINESS_ID_KEY to "marlow")),
        )

    private fun detail(): BusinessDetailResponse =
        BusinessDetailResponse(
            business =
                BusinessUserDetailDto(
                    id = "marlow",
                    username = "marlow-co",
                    name = "Marlow & Co. Cleaning",
                    accountType = "business",
                    city = "Cambridge",
                    state = "MA",
                    verified = true,
                    averageRating = 4.8,
                    reviewCount = 12,
                    followersCount = 84,
                    gigsCompleted = 30,
                    createdAt = "2023-04-10T00:00:00.000Z",
                ),
            profile =
                BusinessProfileDetailDto(
                    businessUserId = "marlow",
                    categories = listOf("Cleaning"),
                    description = "Trusted neighborhood cleaning crew.",
                    isPublished = true,
                    verificationStatus = "address_verified",
                    primaryLocation =
                        BusinessLocationDto(
                            id = "loc-1",
                            isPrimary = true,
                            address = "12 Oak Street",
                            city = "Cambridge",
                            state = "MA",
                            location = null,
                        ),
                ),
            locations = emptyList(),
            access = null,
        )

    private fun publicProfile(): PublicProfileDto =
        PublicProfileDto(
            id = "marlow",
            username = "marlow-co",
            name = "Marlow & Co. Cleaning",
            accountType = "business",
            verified = true,
            createdAt = "2023-04-10T00:00:00.000Z",
            averageRating = 4.8,
            reviewCount = 12,
            followersCount = 84,
            reviews = emptyList(),
        )

    private fun dashboard(): BusinessDashboardResponse =
        BusinessDashboardResponse(
            profile = BusinessDashboardProfileDto(isPublished = true, updatedAt = null),
            onboarding =
                BusinessOnboardingDto(
                    checklist =
                        listOf(
                            BusinessOnboardingItemDto("account_created", true, "Create business account"),
                            BusinessOnboardingItemDto("logo_uploaded", false, "Upload a logo"),
                        ),
                    completedCount = 6,
                    totalCount = 8,
                ),
            access = null,
        )

    private fun insights(): BusinessInsightsResponse =
        BusinessInsightsResponse(
            views = BusinessInsightsViewsDto(total = 1234, trend = 18),
            followers = BusinessInsightsFollowersDto(total = 84, new = 5, trend = 0),
            reviews = BusinessInsightsReviewsDto(count = 23, trend = -4, averageRating = 4.6),
        )

    private fun reviews(): BusinessOwnerReviewsResponse =
        BusinessOwnerReviewsResponse(
            reviews =
                listOf(
                    BusinessOwnerReviewDto(
                        id = "rev-dana",
                        rating = 4,
                        comment = "Ran a little late.",
                        createdAt = "2026-05-01T00:00:00.000Z",
                        ownerResponse = null,
                        reviewerName = "Dana R.",
                        gigTitle = "Deep clean",
                    ),
                ),
        )

    private fun stubLiveLoad() {
        coEvery { businesses.business("marlow") } returns NetworkResult.Success(detail())
        coEvery { businesses.publicBusiness("marlow-co") } returns NetworkResult.Success(BusinessPublicResponse())
        coEvery { profiles.publicProfile("marlow") } returns NetworkResult.Success(publicProfile())
        coEvery { businesses.dashboard("marlow") } returns NetworkResult.Success(dashboard())
        coEvery { businesses.insights("marlow", any()) } returns NetworkResult.Success(insights())
        coEvery { businesses.reviews("marlow") } returns NetworkResult.Success(reviews())
    }

    @Test fun load_projectsOwnerContent() =
        runTest {
            stubLiveLoad()
            val vm = makeVm()
            vm.load()
            advanceUntilIdle()
            val state = vm.state.value
            assertTrue(state is BusinessOwnerUiState.Loaded)
            val content = (state as BusinessOwnerUiState.Loaded).content
            assertEquals("marlow", content.businessId)
            assertTrue(content.isLive)
            assertEquals(3, content.insights.size)
            assertEquals(listOf("Views", "Followers", "Reviews"), content.insights.map { it.label })
            assertEquals("1.2k", content.insights[0].value)
            assertEquals("18%", content.insights[0].delta)
            assertNull(content.insights[1].delta)
            assertNull(content.insights[2].delta)
            assertEquals(75, content.profileStrength.percent)
            assertEquals("2 steps from a complete page", content.profileStrength.caption)
            assertEquals("Marlow & Co. Cleaning", content.publicProfile.header.displayName)
            assertEquals("1 to reply", content.reviewsToReplyLabel)
        }

    @Test fun load_primary404EmitsNotFound() =
        runTest {
            coEvery { businesses.business("marlow") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.load()
            advanceUntilIdle()
            assertEquals(BusinessOwnerUiState.NotFound, vm.state.value)
        }

    @Test fun load_dashboardForbiddenEmitsError() =
        runTest {
            coEvery { businesses.business("marlow") } returns NetworkResult.Success(detail())
            coEvery { businesses.publicBusiness("marlow-co") } returns NetworkResult.Success(BusinessPublicResponse())
            coEvery { profiles.publicProfile("marlow") } returns NetworkResult.Success(publicProfile())
            coEvery { businesses.dashboard("marlow") } returns NetworkResult.Failure(NetworkError.Forbidden)
            val vm = makeVm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is BusinessOwnerUiState.Error)
        }

    @Test fun submitReply_setsReplyOptimistically() =
        runTest {
            coEvery { businesses.respondToReview(any(), any(), any()) } returns NetworkResult.Success(Unit)
            val vm = makeVm()
            vm.seedForPreview(BusinessOwnerSampleData.marlow)
            vm.submitReply("dana", "Thanks for the feedback, Dana!")
            advanceUntilIdle()
            val content = (vm.state.value as BusinessOwnerUiState.Loaded).content
            assertEquals("Thanks for the feedback, Dana!", content.reviews.first { it.id == "dana" }.reply)
        }

    @Test fun submitReply_failureRollsBack() =
        runTest {
            coEvery { businesses.respondToReview(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.seedForPreview(BusinessOwnerSampleData.marlow)
            vm.submitReply("dana", "Thanks for the feedback, Dana!")
            advanceUntilIdle()
            val content = (vm.state.value as BusinessOwnerUiState.Loaded).content
            assertNull(content.reviews.first { it.id == "dana" }.reply)
        }

    @Test fun submitReply_blankText_isIgnored() =
        runTest {
            val vm = makeVm()
            vm.seedForPreview(BusinessOwnerSampleData.marlow)
            vm.submitReply("dana", "   \n ")
            val content = (vm.state.value as BusinessOwnerUiState.Loaded).content
            assertNull(content.reviews.first { it.id == "dana" }.reply)
        }

    @Test fun applyingReply_recomputesPendingReplyLabel() {
        val base = BusinessOwnerSampleData.marlow
        assertEquals("2 to reply", base.reviewsToReplyLabel)
        val updated = base.applyingReply("Appreciate it", "dana")
        assertEquals("Appreciate it", updated.reviews.first { it.id == "dana" }.reply)
        assertNull(updated.reviewsToReplyLabel)
    }
}
