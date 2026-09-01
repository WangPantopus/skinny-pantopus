@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.discoverhub

import app.pantopus.android.data.api.models.hub.DiscoveryItem
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailSize
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.coVerify
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

@OptIn(ExperimentalCoroutinesApi::class)
class DiscoverHubViewModelTest {
    private val repo: HubRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Suppress("LongParameterList")
    private fun item(
        id: String,
        type: String,
        title: String,
        subtitle: String? = null,
        price: String? = null,
        avatarUrl: String? = null,
        category: String? = null,
        verified: Boolean? = null,
    ): DiscoveryItem =
        DiscoveryItem(
            id = id,
            type = type,
            title = title,
            meta = "$title meta",
            category = category,
            avatarUrl = avatarUrl,
            route = "/$type/$id",
            subtitle = subtitle,
            price = price,
            rating = null,
            verified = verified,
            isFree = null,
            isWanted = null,
            createdAt = null,
        )

    private fun stubAll(
        people: NetworkResult<HubDiscoveryResponse>,
        businesses: NetworkResult<HubDiscoveryResponse>,
        gigs: NetworkResult<HubDiscoveryResponse>,
        listings: NetworkResult<HubDiscoveryResponse>,
    ) {
        coEvery {
            repo.discovery(
                filter = "people",
                limit = any(),
                since = any(),
                verified = any(),
                freeOrWanted = any(),
            )
        } returns people
        coEvery {
            repo.discovery(
                filter = "businesses",
                limit = any(),
                since = any(),
                verified = any(),
                freeOrWanted = any(),
            )
        } returns businesses
        coEvery {
            repo.discovery(
                filter = "gigs",
                limit = any(),
                since = any(),
                verified = any(),
                freeOrWanted = any(),
            )
        } returns gigs
        coEvery {
            repo.discovery(
                filter = "listings",
                limit = any(),
                since = any(),
                verified = any(),
                freeOrWanted = any(),
            )
        } returns listings
    }

    private val emptyResp = NetworkResult.Success(HubDiscoveryResponse(items = emptyList()))

    private val peopleResp =
        NetworkResult.Success(
            HubDiscoveryResponse(
                items =
                    listOf(
                        item(
                            "u1",
                            "person",
                            "Maria Kovacs",
                            subtitle = "Elm Park, OR",
                            verified = true,
                        ),
                        item("u2", "person", "David Chen", subtitle = "Elm Park, OR"),
                    ),
            ),
        )

    private val businessesResp =
        NetworkResult.Success(
            HubDiscoveryResponse(
                items =
                    listOf(
                        item(
                            "b1",
                            "business",
                            "Big Tree Handyman",
                            subtitle = "Handyman · Portland",
                            category = "Handyman",
                            verified = true,
                        ),
                    ),
            ),
        )

    private val gigsResp =
        NetworkResult.Success(
            HubDiscoveryResponse(
                items =
                    listOf(
                        item(
                            "g1",
                            "gig",
                            "Assemble bed frame",
                            subtitle = "Posted by Sara T.",
                            price = "$80",
                            category = "Handyman",
                        ),
                    ),
            ),
        )

    private val listingsResp =
        NetworkResult.Success(
            HubDiscoveryResponse(
                items =
                    listOf(
                        item(
                            "l1",
                            "listing",
                            "Mid-century walnut credenza",
                            subtitle = "Anika R. · Portland",
                            price = "$240",
                            avatarUrl = "https://example.com/c.jpg",
                            category = "Furniture",
                        ),
                    ),
            ),
        )

    private fun fail(): NetworkResult<HubDiscoveryResponse> = NetworkResult.Failure(NetworkError.Server(500, "boom"))

    // MARK: - Lifecycle

    @Test
    fun load_all_empty_transitions_to_whole_screen_empty() =
        runTest {
            stubAll(emptyResp, emptyResp, emptyResp, emptyResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Empty, got $state", state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("Nothing to discover yet", empty.headline)
            assertEquals(PantopusIcon.Compass, empty.icon)
            assertNull(empty.ctaTitle)
        }

    @Test
    fun load_all_failed_transitions_to_error() =
        runTest {
            stubAll(fail(), fail(), fail(), fail())
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun load_populated_renders_four_sections_in_design_order() =
        runTest {
            stubAll(peopleResp, businessesResp, gigsResp, listingsResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(4, loaded.sections.size)
            assertEquals(
                listOf(
                    DiscoverHubSection.PEOPLE,
                    DiscoverHubSection.BUSINESSES,
                    DiscoverHubSection.GIGS,
                    DiscoverHubSection.LISTINGS,
                ),
                loaded.sections.map { it.id },
            )
            assertEquals(
                listOf("People", "Businesses", "Gigs", "Listings"),
                loaded.sections.map { it.header },
            )
            for (section in loaded.sections) {
                assertEquals(SectionStyle.Card, section.style)
                assertNotNull("every section must wire See all", section.onSeeAll)
                assertEquals(section.rows.size, section.count)
            }
        }

    @Test
    fun empty_section_is_hidden() =
        runTest {
            stubAll(peopleResp, emptyResp, gigsResp, emptyResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(2, loaded.sections.size)
            assertEquals(
                listOf(DiscoverHubSection.PEOPLE, DiscoverHubSection.GIGS),
                loaded.sections.map { it.id },
            )
        }

    @Test
    fun transport_failure_on_one_type_still_renders_others() =
        runTest {
            stubAll(peopleResp, fail(), gigsResp, listingsResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(
                listOf(
                    DiscoverHubSection.PEOPLE,
                    DiscoverHubSection.GIGS,
                    DiscoverHubSection.LISTINGS,
                ),
                loaded.sections.map { it.id },
            )
        }

    // MARK: - Row mapping

    @Test
    fun row_for_person_sets_avatar_small_verified() {
        val vm = DiscoverHubViewModel(repo)
        val row =
            vm.rowForPerson(
                item("u1", "person", "Maria", subtitle = "Elm Park, OR", verified = true),
            )
        assertEquals("Maria", row.title)
        assertEquals("Elm Park, OR", row.subtitle)
        val leading = row.leading
        assertTrue("Expected AvatarWithBadge, got $leading", leading is RowLeading.AvatarWithBadge)
        leading as RowLeading.AvatarWithBadge
        assertEquals(AvatarBadgeSize.Small, leading.size)
        assertTrue(leading.verified)
        assertTrue("Expected chevron, got ${row.trailing}", row.trailing is RowTrailing.Chevron)
    }

    @Test
    fun row_for_gig_sets_category_icon_and_price_stack() {
        val vm = DiscoverHubViewModel(repo)
        val row =
            vm.rowForGig(
                item(
                    "g1",
                    "gig",
                    "Assemble bed frame",
                    subtitle = "Posted by Sara T.",
                    price = "$80",
                    category = "Handyman",
                ),
            )
        assertTrue(row.leading is RowLeading.CategoryGradientIcon)
        val trailing = row.trailing
        assertTrue("Expected PriceStack, got $trailing", trailing is RowTrailing.PriceStack)
        assertEquals("$80", (trailing as RowTrailing.PriceStack).amount)
    }

    @Test
    fun row_for_listing_sets_thumbnail_medium_and_price_stack() {
        val vm = DiscoverHubViewModel(repo)
        val row =
            vm.rowForListing(
                item(
                    "l1",
                    "listing",
                    "Walnut credenza",
                    subtitle = "Anika R. · Portland",
                    price = "$240",
                    avatarUrl = "https://example.com/c.jpg",
                    category = "Furniture",
                ),
            )
        val leading = row.leading
        assertTrue("Expected Thumbnail, got $leading", leading is RowLeading.Thumbnail)
        leading as RowLeading.Thumbnail
        assertEquals(ThumbnailSize.Medium, leading.size)
        val trailing = row.trailing
        assertTrue(trailing is RowTrailing.PriceStack)
        assertEquals("$240", (trailing as RowTrailing.PriceStack).amount)
    }

    // MARK: - See all routing

    @Test
    fun see_all_people_emits_see_all_people_target() =
        runTest {
            stubAll(peopleResp, emptyResp, emptyResp, emptyResp)
            var captured: DiscoverHubTarget? = null
            val vm = DiscoverHubViewModel(repo)
            vm.onSelect = { captured = it }
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val people = loaded.sections.first { it.id == DiscoverHubSection.PEOPLE }
            people.onSeeAll!!.invoke()
            assertEquals(DiscoverHubTarget.SeeAllPeople, captured)
        }

    @Test
    fun see_all_listings_emits_see_all_listings_target() =
        runTest {
            stubAll(emptyResp, emptyResp, emptyResp, listingsResp)
            var captured: DiscoverHubTarget? = null
            val vm = DiscoverHubViewModel(repo)
            vm.onSelect = { captured = it }
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val listings = loaded.sections.first { it.id == DiscoverHubSection.LISTINGS }
            listings.onSeeAll!!.invoke()
            assertEquals(DiscoverHubTarget.SeeAllListings, captured)
        }

    // MARK: - Chip selection

    @Test
    fun select_chip_updates_selection_and_refetches() =
        runTest {
            stubAll(peopleResp, emptyResp, emptyResp, emptyResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            assertEquals(DiscoverHubChip.NEARBY, vm.selectedChip.value)

            vm.selectChip(DiscoverHubChip.VERIFIED)
            assertEquals(DiscoverHubChip.VERIFIED, vm.selectedChip.value)
            // Eight calls = 2 fetchAll * 4 types.
            coVerify(exactly = 2) {
                repo.discovery(
                    filter = "people",
                    limit = any(),
                    since = any(),
                    verified = any(),
                    freeOrWanted = any(),
                )
            }
            coVerify(exactly = 1) {
                repo.discovery(
                    filter = "people",
                    limit = any(),
                    since = any(),
                    verified = true,
                    freeOrWanted = any(),
                )
            }
        }

    @Test
    fun select_new_today_chip_passes_since_today() =
        runTest {
            stubAll(peopleResp, emptyResp, emptyResp, emptyResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            vm.selectChip(DiscoverHubChip.NEW_TODAY)
            coVerify(exactly = 1) {
                repo.discovery(
                    filter = "people",
                    limit = any(),
                    since = "today",
                    verified = any(),
                    freeOrWanted = any(),
                )
            }
        }

    // MARK: - Chrome

    @Test
    fun top_bar_action_is_sliders_horizontal() {
        val vm = DiscoverHubViewModel(repo)
        val action = vm.topBarAction.value
        assertNotNull(action)
        assertEquals(PantopusIcon.SlidersHorizontal, action!!.icon)
    }

    @Test
    fun chip_strip_exposes_all_four_chips_with_nearby_default() {
        val vm = DiscoverHubViewModel(repo)
        val chip = vm.chipStrip.value
        assertEquals(
            listOf(
                DiscoverHubChip.NEARBY,
                DiscoverHubChip.NEW_TODAY,
                DiscoverHubChip.VERIFIED,
                DiscoverHubChip.FREE_OR_WANTED,
            ),
            chip.chips.map { it.id },
        )
        assertEquals(DiscoverHubChip.NEARBY, chip.selectedId)
    }

    // MARK: - Filters (P5.2)

    @Test
    fun default_top_bar_action_has_no_badge() {
        val vm = DiscoverHubViewModel(repo)
        assertNull(vm.topBarAction.value?.badgeCount)
        assertEquals(0, vm.filters.value.activeCount)
    }

    @Test
    fun present_and_dismiss_toggles_sheet_flag() {
        val vm = DiscoverHubViewModel(repo)
        assertEquals(false, vm.showFilterSheet.value)
        vm.presentFilters()
        assertEquals(true, vm.showFilterSheet.value)
        vm.dismissFilters()
        assertEquals(false, vm.showFilterSheet.value)
    }

    @Test
    fun apply_filters_content_type_shows_only_selected_sections() =
        runTest {
            stubAll(peopleResp, businessesResp, gigsResp, listingsResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            vm.applyFilters(
                DiscoverHubFilters(
                    contentTypes = setOf(DiscoverHubSection.PEOPLE, DiscoverHubSection.GIGS),
                ),
            )
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(
                listOf(DiscoverHubSection.PEOPLE, DiscoverHubSection.GIGS),
                loaded.sections.map { it.id },
            )
            assertEquals(1, vm.filters.value.activeCount)
            assertEquals(1, vm.topBarAction.value?.badgeCount)
        }

    @Test
    fun apply_filters_verified_only_passes_verified_true() =
        runTest {
            stubAll(peopleResp, emptyResp, emptyResp, emptyResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            vm.applyFilters(DiscoverHubFilters(verifiedOnly = true))
            coVerify {
                repo.discovery(
                    filter = "people",
                    limit = any(),
                    since = any(),
                    verified = true,
                    freeOrWanted = any(),
                )
            }
            assertEquals(1, vm.topBarAction.value?.badgeCount)
        }

    @Test
    fun apply_filters_newest_first_reorders_by_created_at() =
        runTest {
            val gigsWithDates =
                NetworkResult.Success(
                    HubDiscoveryResponse(
                        items =
                            listOf(
                                DiscoveryItem(
                                    id = "g1", type = "gig", title = "Earlier", meta = "",
                                    category = "Handyman", avatarUrl = null, route = "/gig/g1",
                                    subtitle = null, price = "$10", rating = null, verified = null,
                                    isFree = null, isWanted = null, createdAt = "2026-05-14T08:00:00Z",
                                ),
                                DiscoveryItem(
                                    id = "g2", type = "gig", title = "Later", meta = "",
                                    category = "Handyman", avatarUrl = null, route = "/gig/g2",
                                    subtitle = null, price = "$20", rating = null, verified = null,
                                    isFree = null, isWanted = null, createdAt = "2026-05-14T09:00:00Z",
                                ),
                            ),
                    ),
                )
            stubAll(emptyResp, emptyResp, gigsWithDates, emptyResp)
            val vm = DiscoverHubViewModel(repo)
            vm.load()
            vm.applyFilters(DiscoverHubFilters(newestFirst = true))

            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val gigs = loaded.sections.first { it.id == DiscoverHubSection.GIGS }
            // Newest-first: g2 (09:00) ahead of g1 (08:00).
            assertEquals(listOf("gig-g2", "gig-g1"), gigs.rows.map { it.id })
        }
}
