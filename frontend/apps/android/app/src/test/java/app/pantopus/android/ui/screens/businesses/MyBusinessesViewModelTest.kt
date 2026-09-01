package app.pantopus.android.ui.screens.businesses

import app.cash.turbine.test
import app.pantopus.android.data.api.models.businesses.BusinessMembership
import app.pantopus.android.data.api.models.businesses.BusinessProfileDto
import app.pantopus.android.data.api.models.businesses.BusinessStatsDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamChipDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamSummaryDto
import app.pantopus.android.data.api.models.businesses.BusinessUserDto
import app.pantopus.android.data.api.models.businesses.MyBusinessesResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
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
class MyBusinessesViewModelTest {
    private val repo: BusinessesRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Suppress("LongParameterList")
    private fun membership(
        id: String,
        name: String,
        city: String? = null,
        state: String? = null,
        role: String = "owner",
        tier: String? = "bi3_documented",
        rating: Double? = 4.9,
        reviews: Int = 218,
        category: String? = "handyman",
        openChats: Int = 12,
        bookings: Int = 7,
        teamCount: Int = 4,
        teamInitials: List<String> = listOf("MJ", "AK", "PA"),
    ) = BusinessMembership(
        id = "seat-$id",
        roleBase = role,
        title = null,
        joinedAt = null,
        businessUserId = id,
        business =
            BusinessUserDto(
                id = id,
                username = name.lowercase().replace(' ', '_'),
                name = name,
                email = null,
                profilePictureUrl = null,
                accountType = "business",
                city = city,
                state = state,
                averageRating = rating,
                reviewCount = reviews,
            ),
        profile =
            BusinessProfileDto(
                businessUserId = id,
                businessType = "home_services",
                categories = listOfNotNull(category),
                isPublished = true,
                logoFileId = null,
                bannerFileId = null,
                description = null,
                identityVerificationTier = tier,
            ),
        stats = BusinessStatsDto(openChats = openChats, bookingsThisWeek = bookings),
        team = BusinessTeamSummaryDto(count = teamCount, members = teamInitials.map { BusinessTeamChipDto(initials = it) }),
    )

    @Test
    fun load_projects_cards_with_role_locality_verification_and_stats() =
        runTest {
            coEvery { repo.myBusinesses() } returns
                NetworkResult.Success(
                    MyBusinessesResponse(
                        businesses =
                            listOf(
                                membership("b1", "Big Tree Handyman", city = "Elm Park", state = "NY"),
                                membership(
                                    "b2", "Bayside Tutoring", role = "manager",
                                    tier = "bi0_unverified", rating = null, reviews = 0,
                                    category = "tutoring", openChats = 1, bookings = 0,
                                    teamCount = 0, teamInitials = emptyList(),
                                ),
                            ),
                    ),
                )
            val vm = MyBusinessesViewModel(repo)
            vm.load()
            val loaded = vm.state.value as MyBusinessesUiState.Loaded
            assertEquals(2, loaded.cards.size)

            val big = loaded.cards[0]
            assertEquals("Big Tree Handyman", big.name)
            assertEquals("Handyman", big.categoryLabel)
            assertEquals("Elm Park, NY", big.locality)
            assertFalse(big.localityIsPlaceholder)
            assertEquals("Owner", big.role?.label)
            assertTrue(big.verified)
            assertFalse(big.pending)
            assertEquals(12, big.openChats)
            assertEquals(7, big.bookingsThisWeek)
            assertEquals("4.9", big.ratingText)
            assertEquals(218, big.reviewCount)
            assertEquals(4, big.teamCount)
            assertEquals(listOf("MJ", "AK", "PA"), big.teamInitials)

            val bayside = loaded.cards[1]
            assertEquals("Tutoring", bayside.categoryLabel)
            assertEquals("Online only", bayside.locality)
            assertTrue(bayside.localityIsPlaceholder)
            assertEquals("Manager", bayside.role?.label)
            assertFalse(bayside.verified)
            assertTrue(bayside.pending)
            assertEquals("New", bayside.ratingText)
        }

    @Test
    fun empty_response_surfaces_empty_state() =
        runTest {
            coEvery { repo.myBusinesses() } returns NetworkResult.Success(MyBusinessesResponse(businesses = emptyList()))
            val vm = MyBusinessesViewModel(repo)
            vm.state.test {
                awaitItem()
                vm.load()
                assertTrue(awaitItem() is MyBusinessesUiState.Empty)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun failure_surfaces_error_state() =
        runTest {
            coEvery { repo.myBusinesses() } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = MyBusinessesViewModel(repo)
            vm.state.test {
                awaitItem()
                vm.load()
                assertTrue(awaitItem() is MyBusinessesUiState.Error)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun isVerified_maps_tier_above_bi0() {
        assertFalse(MyBusinessesViewModel.isVerified(null))
        assertFalse(MyBusinessesViewModel.isVerified("bi0_unverified"))
        assertTrue(MyBusinessesViewModel.isVerified("bi2_domain_social"))
        assertTrue(MyBusinessesViewModel.isVerified("bi4_authority"))
    }

    @Test
    fun missing_stats_team_profile_default_to_zero() =
        runTest {
            // A row from a not-yet-migrated backend: no profile/stats/team blocks.
            val bare =
                BusinessMembership(
                    id = "seat-1",
                    roleBase = "owner",
                    title = null,
                    joinedAt = null,
                    businessUserId = "b1",
                    business = BusinessUserDto(id = "b1", name = "Solo Shop", city = "Reno", state = "NV"),
                )
            coEvery { repo.myBusinesses() } returns NetworkResult.Success(MyBusinessesResponse(businesses = listOf(bare)))
            val vm = MyBusinessesViewModel(repo)
            vm.load()
            val card = (vm.state.value as MyBusinessesUiState.Loaded).cards[0]
            assertEquals(0, card.openChats)
            assertEquals(0, card.bookingsThisWeek)
            assertEquals(0, card.teamCount)
            assertTrue(card.teamInitials.isEmpty())
            assertTrue(card.pending)
            assertEquals("New", card.ratingText)
            assertEquals(null, card.categoryLabel)
        }

    @Test
    fun category_label_title_cases_each_word_to_match_ios() =
        runTest {
            coEvery { repo.myBusinesses() } returns
                NetworkResult.Success(MyBusinessesResponse(businesses = listOf(membership("b1", "Pet Co", category = "pet_grooming"))))
            val vm = MyBusinessesViewModel(repo)
            vm.load()
            assertEquals("Pet Grooming", (vm.state.value as MyBusinessesUiState.Loaded).cards[0].categoryLabel)
        }
}
