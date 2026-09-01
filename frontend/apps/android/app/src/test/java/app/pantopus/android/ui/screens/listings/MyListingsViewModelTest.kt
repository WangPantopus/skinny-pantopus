package app.pantopus.android.ui.screens.listings

import app.cash.turbine.test
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.MyListingsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailImage
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class MyListingsViewModelTest {
    private val repo: ListingsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private val fixedNow: Instant = Instant.parse("2026-05-17T12:00:00Z")

    private fun listing(
        id: String,
        status: String,
        price: Double? = 250.0,
        views: Int = 0,
        offers: Int = 0,
        mediaUrls: List<String>? = listOf("https://x/$id.jpg"),
    ) = ListingDto(
        id = id,
        userId = "u_me",
        title = "Listing $id",
        description = null,
        price = price,
        isFree = false,
        category = null,
        condition = null,
        status = status,
        mediaUrls = mediaUrls,
        firstImage = null,
        layer = null,
        listingType = null,
        latitude = null,
        longitude = null,
        locationName = null,
        distanceMeters = null,
        createdAt = "2026-05-15T08:00:00Z",
        userHasSaved = null,
        approxLocation = null,
        viewCount = views,
        activeOfferCount = offers,
        soldAt = null,
        archivedAt = null,
    )

    private fun vmWith(rows: List<ListingDto>): MyListingsViewModel {
        coEvery { repo.myListings(any(), any(), any()) } returns
            NetworkResult.Success(MyListingsResponse(listings = rows, pagination = null))
        return MyListingsViewModel(repo).also { it.now = { fixedNow } }
    }

    @Test
    fun load_buckets_tabs_and_active_tab_includes_pending_pickup() =
        runTest {
            val vm =
                vmWith(
                    listOf(
                        listing("l1", "active", views = 2400, offers = 5),
                        listing("l2", "pending_pickup", views = 120, offers = 3, mediaUrls = emptyList()),
                        listing("l3", "sold", views = 89, offers = 0),
                        listing("l4", "draft", price = null, mediaUrls = emptyList()),
                    ),
                )
            vm.load()
            val tabs = vm.tabs.value
            assertEquals(2, tabs.first { it.id == "active" }.count)
            assertEquals(1, tabs.first { it.id == "sold" }.count)
            assertEquals(1, tabs.first { it.id == "drafts" }.count)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val rows = loaded.sections.first().rows
            assertEquals(listOf("l1", "l2"), rows.map { it.id })
            // First row: chips are views / offers / status; thumbnail uses
            // remote URL when media_urls is non-empty.
            assertEquals(3, rows[0].chips!!.size)
            assertEquals("2400 views", rows[0].chips!![0].text)
            assertEquals("5 offers", rows[0].chips!![1].text)
            assertEquals("Active", rows[0].chips!![2].text)
            val leading = rows[0].leading as RowLeading.Thumbnail
            assertTrue(leading.image is ThumbnailImage.Remote)
            // Pending-pickup row with empty media falls back to icon
            // thumbnail.
            val pendingLeading = rows[1].leading as RowLeading.Thumbnail
            assertTrue(pendingLeading.image is ThumbnailImage.IconOnGradient)
            assertEquals("Pickup pending", rows[1].chips!![2].text)
        }

    @Test
    fun switching_to_sold_tab_renders_only_sold_row() =
        runTest {
            val vm =
                vmWith(
                    listOf(
                        listing("l1", "active"),
                        listing("l3", "sold"),
                    ),
                )
            vm.load()
            vm.selectTab("sold")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("l3"), loaded.sections.first().rows.map { it.id })
            assertEquals("Sold", loaded.sections.first().rows.first().chips!!.last().text)
        }

    @Test
    fun empty_active_tab_renders_empty_state_with_compose_cta() =
        runTest {
            val vm = vmWith(emptyList())
            var composed = false
            vm.configureNavigation(onOpenListing = {}, onCompose = { composed = true })
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No active listings", empty.headline)
            assertEquals("List something", empty.ctaTitle)
            empty.onCta?.invoke()
            assertTrue(composed)
        }

    @Test
    fun failure_surfaces_error_state() =
        runTest {
            coEvery { repo.myListings(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = MyListingsViewModel(repo)
            vm.state.test {
                awaitItem()
                vm.load()
                assertTrue(awaitItem() is ListOfRowsUiState.Error)
                cancelAndConsumeRemainingEvents()
            }
        }
}
