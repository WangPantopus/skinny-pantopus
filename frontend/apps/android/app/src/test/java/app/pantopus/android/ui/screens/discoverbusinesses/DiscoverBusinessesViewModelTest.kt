@file:Suppress("LongMethod", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.discoverbusinesses

import app.pantopus.android.data.api.models.businessdiscovery.BusinessDiscoveryItem
import app.pantopus.android.data.api.models.businessdiscovery.BusinessDiscoverySearchResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businessdiscovery.BusinessDiscoveryRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DiscoverBusinessesViewModelTest {
    private val repo: BusinessDiscoveryRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ───────── Fixtures ─────────

    private fun item(
        id: String,
        name: String,
        category: String,
        description: String? = null,
        isOpenNow: Boolean? = null,
        distanceMiles: Double = 0.5,
    ): BusinessDiscoveryItem =
        BusinessDiscoveryItem(
            businessUserId = id,
            username = id,
            name = name,
            profilePictureUrl = null,
            categories = listOf(category),
            description = description,
            businessType = "company",
            averageRating = 4.5,
            reviewCount = 10,
            distanceMiles = distanceMiles,
            isOpenNow = isOpenNow,
            isNewBusiness = false,
            city = "Portland",
            state = "OR",
            verificationStatus = "document_verified",
            verificationBadge = "verified",
            foundingBadge = false,
        )

    private fun response(items: List<BusinessDiscoveryItem>): BusinessDiscoverySearchResponse =
        BusinessDiscoverySearchResponse(
            results = items,
            pagination =
                BusinessDiscoverySearchResponse.Pagination(
                    page = 1,
                    pageSize = items.size,
                    totalCount = items.size,
                    totalPages = 1,
                    hasMore = false,
                ),
            sort = "relevance",
            sortLabel = "Most hired nearby",
            banner = null,
        )

    private val mixed =
        listOf(
            item("b1", "Big Tree Handyman", "handyman", "Old-house specialist", isOpenNow = true),
            item("b2", "Northwest Fixers", "handyman", "Small jobs", isOpenNow = false),
            item("b3", "Clean Bee PDX", "cleaning", "Eco-friendly", isOpenNow = true),
            item("b4", "Weird Co.", "nightclub", description = null),
        )

    // ───────── Lifecycle ─────────

    @Test
    fun loadEmptyTransitionsToEmptyState() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Success(response(emptyList()))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()

            val state = vm.state.value
            assertTrue("Expected Empty, got $state", state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No verified businesses nearby yet", empty.headline)
            assertEquals("Invite a business", empty.ctaTitle)
        }

    @Test
    fun load400TransitionsToNoLocationEmptyState() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Failure(NetworkError.ClientError(400, "Location required"))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()

            val state = vm.state.value
            assertTrue("Expected Empty, got $state", state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("Set a home address", empty.headline)
            assertEquals("Set a home address", empty.ctaTitle)
        }

    @Test
    fun loadServerErrorTransitionsToError() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()

            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun loadPopulatedGroupsByCategoryInChipOrder() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()

            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(
                listOf(
                    DiscoverBusinessesChip.HANDYMAN,
                    DiscoverBusinessesChip.CLEANING,
                    DiscoverBusinessesSection.OTHER,
                ),
                loaded.sections.map { it.id },
            )
            assertEquals(
                listOf("Handyman", "Cleaning", "Other"),
                loaded.sections.map { it.header },
            )
            loaded.sections.forEach { section ->
                assertEquals(SectionStyle.Card, section.style)
                assertEquals(section.count, section.rows.size)
            }
            assertEquals(2, loaded.sections[0].rows.size)
            assertEquals(
                listOf("business-b1", "business-b2"),
                loaded.sections[0].rows.map { it.id },
            )
        }

    // ───────── Chip filtering ─────────

    @Test
    fun chipSelectionCollapsesToSingleSection() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()
            vm.selectChip(DiscoverBusinessesChip.HANDYMAN)

            assertEquals(DiscoverBusinessesChip.HANDYMAN, vm.selectedChip.value)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.size)
            assertEquals(DiscoverBusinessesChip.HANDYMAN, loaded.sections[0].id)
            assertEquals("Handyman", loaded.sections[0].header)
        }

    @Test
    fun chipSelectionPassesCategoriesArgument() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()
            coVerify {
                repo.search(
                    q = null,
                    categories = null,
                    sort = null,
                    page = 1,
                    pageSize = 50,
                )
            }

            vm.selectChip(DiscoverBusinessesChip.CLEANING)
            coVerify {
                repo.search(
                    q = null,
                    categories = listOf("cleaning"),
                    sort = null,
                    page = 1,
                    pageSize = 50,
                )
            }
        }

    // ───────── Search ─────────

    @Test
    fun submitSearchPassesQueryArgument() =
        runTest {
            coEvery {
                repo.search(
                    q = any(),
                    categories = any(),
                    sort = any(),
                    page = any(),
                    pageSize = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()
            vm.setSearchText("tree")
            vm.submitSearch()

            coVerify {
                repo.search(
                    q = "tree",
                    categories = null,
                    sort = null,
                    page = 1,
                    pageSize = 50,
                )
            }
        }

    // ───────── Row mapping ─────────

    @Test
    fun rowForBusinessUsesCategoryGradientIconAndChevron() {
        val vm = DiscoverBusinessesViewModel(repo)
        val row =
            vm.rowForBusiness(
                item(
                    "b1",
                    "Big Tree Handyman",
                    "handyman",
                    description = "Old-house specialist",
                    isOpenNow = true,
                    distanceMiles = 0.4,
                ),
            )
        assertEquals("business-b1", row.id)
        assertEquals("Big Tree Handyman", row.title)
        assertNotNull(row.subtitle)
        assertTrue(row.subtitle?.contains("Old-house specialist") == true)
        assertTrue(row.subtitle?.contains("Open now") == true)
        assertTrue(row.subtitle?.contains("0.4 mi") == true)
        assertTrue(
            "Expected CategoryGradientIcon, got ${row.leading}",
            row.leading is RowLeading.CategoryGradientIcon,
        )
        assertTrue(
            "Expected Chevron, got ${row.trailing}",
            row.trailing is RowTrailing.Chevron,
        )
    }

    @Test
    fun rowTapEmitsBusinessTarget() {
        var captured: DiscoverBusinessesTarget? = null
        val vm = DiscoverBusinessesViewModel(repo)
        vm.onSelect = { captured = it }
        val row =
            vm.rowForBusiness(
                item("b1", "Big Tree Handyman", "handyman"),
            )
        row.onTap()
        assertEquals(
            DiscoverBusinessesTarget.Business(businessId = "b1", name = "Big Tree Handyman"),
            captured,
        )
    }

    // ───────── Primary-category projection ─────────

    @Test
    fun primaryCategoryKeyMatchesFirstKnownCategory() {
        assertEquals(
            DiscoverBusinessesChip.PET_CARE,
            DiscoverBusinessesViewModel.primaryCategoryKey(listOf("unknown", "Pet Care")),
        )
        assertEquals(
            DiscoverBusinessesChip.LAWN_CARE,
            DiscoverBusinessesViewModel.primaryCategoryKey(listOf("lawn_care")),
        )
        assertEquals(
            DiscoverBusinessesSection.OTHER,
            DiscoverBusinessesViewModel.primaryCategoryKey(listOf("totally_made_up")),
        )
    }

    // ───────── Chrome ─────────

    @Test
    fun topBarActionIsSlidersHorizontal() {
        val vm = DiscoverBusinessesViewModel(repo)
        val action = vm.topBarAction.value
        assertNotNull(action)
        assertEquals(app.pantopus.android.ui.theme.PantopusIcon.SlidersHorizontal, action!!.icon)
    }

    @Test
    fun chipStripExposesAllCategoryChipsWithAllDefault() {
        val vm = DiscoverBusinessesViewModel(repo)
        val chipStrip = vm.chipStrip.value
        assertEquals(DiscoverBusinessesChip.ORDER, chipStrip.chips.map { it.id })
        assertEquals(DiscoverBusinessesChip.ALL, chipStrip.selectedId)
    }

    @Test
    fun searchBarSlotIsPresent() {
        val vm = DiscoverBusinessesViewModel(repo)
        val searchBar = vm.searchBar.value
        assertEquals("Search businesses or services", searchBar.placeholder)
    }

    // ───────── Filters (P5.2) ─────────

    @Test
    fun defaultTopBarActionHasNoBadge() {
        val vm = DiscoverBusinessesViewModel(repo)
        assertEquals(null, vm.topBarAction.value?.badgeCount)
        assertEquals(0, vm.filters.value.activeCount)
    }

    @Test
    fun presentAndDismissTogglesSheetFlag() {
        val vm = DiscoverBusinessesViewModel(repo)
        assertEquals(false, vm.showFilterSheet.value)
        vm.presentFilters()
        assertEquals(true, vm.showFilterSheet.value)
        vm.dismissFilters()
        assertEquals(false, vm.showFilterSheet.value)
    }

    @Test
    fun applyFiltersPassesServerParams() =
        runTest {
            coEvery {
                repo.search(
                    q = any(), categories = any(), sort = any(), page = any(),
                    pageSize = any(), radiusMiles = any(), openNow = any(), ratingMin = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()
            vm.applyFilters(
                DiscoverBusinessFilters(
                    categories = setOf("home-services"),
                    radiusMiles = 1.0,
                    openNow = true,
                    ratingFloor = 4.0,
                ),
            )

            coVerify {
                repo.search(
                    q = null,
                    categories = listOf("home-services"),
                    sort = null,
                    page = 1,
                    pageSize = 50,
                    radiusMiles = 1.0,
                    openNow = true,
                    ratingMin = 4.0,
                )
            }
            assertEquals(4, vm.filters.value.activeCount)
            assertEquals(4, vm.topBarAction.value?.badgeCount)
        }

    @Test
    fun applyDefaultFiltersOmitsServerParams() =
        runTest {
            coEvery {
                repo.search(
                    q = any(), categories = any(), sort = any(), page = any(),
                    pageSize = any(), radiusMiles = any(), openNow = any(), ratingMin = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()
            vm.applyFilters(DiscoverBusinessFilters.Default)

            coVerify {
                repo.search(
                    q = null,
                    categories = null,
                    sort = null,
                    page = 1,
                    pageSize = 50,
                    radiusMiles = null,
                    openNow = null,
                    ratingMin = null,
                )
            }
            assertEquals(null, vm.topBarAction.value?.badgeCount)
        }

    @Test
    fun categoryFilterUnionsWithChipSelection() =
        runTest {
            coEvery {
                repo.search(
                    q = any(), categories = any(), sort = any(), page = any(),
                    pageSize = any(), radiusMiles = any(), openNow = any(), ratingMin = any(),
                )
            } returns NetworkResult.Success(response(mixed))

            val vm = DiscoverBusinessesViewModel(repo)
            vm.load()
            vm.selectChip(DiscoverBusinessesChip.HANDYMAN)
            vm.applyFilters(DiscoverBusinessFilters(categories = setOf("home-services")))

            // Sorted union of the chip (handyman) + sheet (home-services).
            coVerify {
                repo.search(
                    q = null,
                    categories = listOf("handyman", "home-services"),
                    sort = null,
                    page = 1,
                    pageSize = 50,
                    radiusMiles = null,
                    openNow = null,
                    ratingMin = null,
                )
            }
        }
}
