@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile.tabs

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigsListResponse
import app.pantopus.android.data.api.models.profile.FileDeleteResponse
import app.pantopus.android.data.api.models.profile.GigReviewCountsDto
import app.pantopus.android.data.api.models.profile.GigReviewDto
import app.pantopus.android.data.api.models.profile.GigReviewReviewerDto
import app.pantopus.android.data.api.models.profile.GigReviewsResponse
import app.pantopus.android.data.api.models.profile.PortfolioFileDto
import app.pantopus.android.data.api.models.profile.PortfolioFileMetadataDto
import app.pantopus.android.data.api.models.profile.PortfolioListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.profile.ProfileTabsRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Projections behind the three public-profile tabs now mounted on
 * `PublicProfileScreen` — Portfolio, Gigs and (gig) Reviews.
 *
 *   GET /api/files/portfolio        backend/routes/files.js:489
 *   GET /api/files/portfolio/{id}   backend/routes/files.js:526
 *   GET /api/gigs?user_id=…         backend/routes/gigs.js:2089
 *   GET /api/reviews/user/{userId}  backend/routes/reviews.js:149
 *
 * iOS counterpart: `PantopusTests/Features/Profile/ProfileTabsViewModelTests.swift`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ProfileTabsViewModelTest {
    private val tabsRepo: ProfileTabsRepository = mockk()
    private val gigsRepo: GigsRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // region Portfolio

    private fun portfolioFile(
        id: String,
        fileType: String,
        originalFilename: String? = null,
        metadata: PortfolioFileMetadataDto? = null,
        fileUrl: String? = null,
    ) = PortfolioFileDto(
        id = id,
        fileUrl = fileUrl,
        originalFilename = originalFilename,
        fileType = fileType,
        metadata = metadata,
    )

    @Test
    fun portfolio_reads_public_route_for_someone_else_and_projects_cards() =
        runTest {
            coEvery { tabsRepo.portfolio("u2", false) } returns
                NetworkResult.Success(
                    PortfolioListResponse(
                        files =
                            listOf(
                                portfolioFile(
                                    id = "f1",
                                    fileType = "portfolio_image",
                                    originalFilename = "a.jpg",
                                    fileUrl = "https://cdn.test/a.jpg",
                                    metadata =
                                        PortfolioFileMetadataDto(
                                            title = "Deck rebuild",
                                            description = "Two weekends",
                                            thumbnails = mapOf("medium" to "https://cdn.test/a-m.webp"),
                                        ),
                                ),
                                portfolioFile(id = "f2", fileType = "portfolio_video", originalFilename = "b.mp4"),
                            ),
                    ),
                )

            val vm = ProfilePortfolioViewModel(tabsRepo)
            vm.load("u2", isOwnProfile = false)

            val loaded = vm.state.value as ProfilePortfolioUiState.Loaded
            assertEquals(2, loaded.items.size)
            assertEquals("Deck rebuild", loaded.items[0].title)
            assertEquals("Two weekends", loaded.items[0].subtitle)
            assertEquals(PortfolioItemKind.Photo, loaded.items[0].kind)
            // The medium thumbnail drives the grid; the raw file drives the viewer.
            assertEquals("https://cdn.test/a-m.webp", loaded.items[0].imageUrl)
            assertEquals("https://cdn.test/a.jpg", loaded.items[0].fullUrl)
            // No metadata title → the original filename stands in.
            assertEquals("b.mp4", loaded.items[1].title)
            assertEquals(PortfolioItemKind.Video, loaded.items[1].kind)

            assertFalse(vm.canEdit)
            assertEquals(listOf(PortfolioItemKind.Photo, PortfolioItemKind.Video), vm.availableFilters())
            assertEquals(1, vm.countOf(PortfolioItemKind.Photo))
            coVerify(exactly = 1) { tabsRepo.portfolio("u2", false) }
        }

    @Test
    fun portfolio_own_profile_reads_authenticated_route_and_unlocks_editing() =
        runTest {
            coEvery { tabsRepo.portfolio("me", true) } returns
                NetworkResult.Success(
                    PortfolioListResponse(
                        files = listOf(portfolioFile(id = "f9", fileType = "resume", originalFilename = "cv.pdf")),
                    ),
                )

            val vm = ProfilePortfolioViewModel(tabsRepo)
            vm.load("me", isOwnProfile = true)

            val loaded = vm.state.value as ProfilePortfolioUiState.Loaded
            assertEquals(PortfolioItemKind.Article, loaded.items.first().kind)
            assertTrue(vm.canEdit)
            coVerify(exactly = 1) { tabsRepo.portfolio("me", true) }
        }

    @Test
    fun portfolio_filter_narrows_to_one_kind() =
        runTest {
            coEvery { tabsRepo.portfolio("u2", false) } returns
                NetworkResult.Success(
                    PortfolioListResponse(
                        files =
                            listOf(
                                portfolioFile(id = "f1", fileType = "portfolio_image", originalFilename = "a.jpg"),
                                portfolioFile(id = "f2", fileType = "certification", originalFilename = "cert.pdf"),
                            ),
                    ),
                )

            val vm = ProfilePortfolioViewModel(tabsRepo)
            vm.load("u2", isOwnProfile = false)

            assertEquals(2, vm.filteredItems().size)
            vm.setFilter(PortfolioItemKind.Certificate)
            assertEquals(listOf("f2"), vm.filteredItems().map { it.id })
        }

    @Test
    fun portfolio_empty_and_error_states() =
        runTest {
            coEvery { tabsRepo.portfolio("u2", false) } returns NetworkResult.Success(PortfolioListResponse())
            val empty = ProfilePortfolioViewModel(tabsRepo)
            empty.load("u2", isOwnProfile = false)
            assertEquals(ProfilePortfolioUiState.Empty, empty.state.value)

            coEvery { tabsRepo.portfolio("u3", false) } returns NetworkResult.Failure(NetworkError.Forbidden)
            val denied = ProfilePortfolioViewModel(tabsRepo)
            denied.load("u3", isOwnProfile = false)
            assertEquals(
                ProfilePortfolioUiState.Error("This portfolio is private."),
                denied.state.value,
            )
        }

    @Test
    fun portfolio_refused_delete_leaves_the_grid_untouched() =
        runTest {
            coEvery { tabsRepo.portfolio("me", true) } returns
                NetworkResult.Success(
                    PortfolioListResponse(
                        files = listOf(portfolioFile(id = "f1", fileType = "portfolio_image", originalFilename = "a.jpg")),
                    ),
                )
            coEvery { tabsRepo.deleteFile("f1") } returns NetworkResult.Failure(NetworkError.Forbidden)

            val vm = ProfilePortfolioViewModel(tabsRepo)
            vm.load("me", isOwnProfile = true)
            vm.requestDelete(vm.filteredItems().first())
            vm.confirmDelete()

            val loaded = vm.state.value as ProfilePortfolioUiState.Loaded
            assertEquals(listOf("f1"), loaded.items.map { it.id })
            assertNull(vm.pendingDelete.value)
            assertFalse(vm.isMutating.value)
            assertEquals("You don't have permission to do that.", vm.toastMessage.value)
        }

    @Test
    fun portfolio_successful_delete_refetches_the_grid() =
        runTest {
            coEvery { tabsRepo.portfolio("me", true) } returnsMany
                listOf(
                    NetworkResult.Success(
                        PortfolioListResponse(
                            files = listOf(portfolioFile(id = "f1", fileType = "portfolio_image", originalFilename = "a.jpg")),
                        ),
                    ),
                    NetworkResult.Success(PortfolioListResponse()),
                )
            coEvery { tabsRepo.deleteFile("f1") } returns NetworkResult.Success(FileDeleteResponse("deleted"))

            val vm = ProfilePortfolioViewModel(tabsRepo)
            vm.load("me", isOwnProfile = true)
            vm.requestDelete((vm.state.value as ProfilePortfolioUiState.Loaded).items.first())
            vm.confirmDelete()

            assertEquals(ProfilePortfolioUiState.Empty, vm.state.value)
            coVerify(exactly = 2) { tabsRepo.portfolio("me", true) }
        }

    @Test
    fun portfolio_upload_refuses_a_blank_title_or_missing_file() =
        runTest {
            coEvery { tabsRepo.portfolio("me", true) } returns NetworkResult.Success(PortfolioListResponse())
            val vm = ProfilePortfolioViewModel(tabsRepo)
            vm.load("me", isOwnProfile = true)

            vm.upload(
                file = PickedPortfolioFile("a.jpg", "image/jpeg", byteArrayOf(1)),
                title = "   ",
                description = "",
                category = PortfolioItemKind.Photo,
            )
            assertEquals("Please enter a title for your portfolio item.", vm.toastMessage.value)

            vm.upload(file = null, title = "Deck", description = "", category = PortfolioItemKind.Photo)
            assertEquals("Couldn't read that file. Pick it again.", vm.toastMessage.value)
        }

    // endregion

    // region Gigs

    @Test
    fun gigs_project_rows_and_price_formatting() =
        runTest {
            coEvery { gigsRepo.userGigs("u2", 20) } returns
                NetworkResult.Success(
                    GigsListResponse(
                        gigs =
                            listOf(
                                GigDto(
                                    id = "g1",
                                    title = "Move a couch",
                                    description = "Third floor walk-up",
                                    price = 120.0,
                                    category = "moving",
                                    status = "open",
                                ),
                                GigDto(id = "g2", title = "Fix a faucet", price = 45.5, status = "completed"),
                            ),
                        total = 2,
                    ),
                )

            val vm = ProfileGigsViewModel(gigsRepo)
            vm.load("u2")

            val loaded = vm.state.value as ProfileGigsUiState.Loaded
            assertEquals(listOf("g1", "g2"), loaded.rows.map { it.id })
            assertEquals("$120", loaded.rows[0].price)
            assertEquals("moving", loaded.rows[0].category)
            assertTrue(loaded.rows[0].isOpen)
            assertEquals("$45.50", loaded.rows[1].price)
            assertNull(loaded.rows[1].summary)
            assertFalse(loaded.rows[1].isOpen)
        }

    @Test
    fun gigs_request_is_scoped_to_the_poster() =
        runTest {
            coEvery { gigsRepo.userGigs("u2", 20) } returns NetworkResult.Success(GigsListResponse(gigs = emptyList(), total = 0))

            val vm = ProfileGigsViewModel(gigsRepo)
            vm.load("u2")

            assertEquals(ProfileGigsUiState.Empty, vm.state.value)
            coVerify(exactly = 1) { gigsRepo.userGigs("u2", 20) }
        }

    @Test
    fun gigs_error_state() =
        runTest {
            coEvery { gigsRepo.userGigs("u2", 20) } returns
                NetworkResult.Failure(NetworkError.Server(500, "Failed to fetch gigs"))

            val vm = ProfileGigsViewModel(gigsRepo)
            vm.load("u2")

            assertTrue(vm.state.value is ProfileGigsUiState.Error)
        }

    // endregion

    // region Gig reviews

    @Test
    fun reviews_project_summary_role_labels_and_distribution() =
        runTest {
            coEvery { tabsRepo.userGigReviews("u2", 50) } returns
                NetworkResult.Success(
                    GigReviewsResponse(
                        reviews =
                            listOf(
                                GigReviewDto(
                                    id = "r1",
                                    rating = 5,
                                    comment = "On time",
                                    receivedAs = "worker",
                                    reviewerName = "Sam Lee",
                                    reviewerAvatar = "https://cdn.test/s.png",
                                    mediaUrls = listOf("https://cdn.test/r1.jpg"),
                                ),
                                GigReviewDto(
                                    id = "r2",
                                    rating = 3,
                                    comment = "Fine",
                                    receivedAs = "poster",
                                    reviewer = GigReviewReviewerDto(id = "u9", username = "dana", name = "Dana Ray"),
                                ),
                                GigReviewDto(id = "r3", rating = 4, receivedAs = "unknown"),
                            ),
                        total = 7,
                        averageRating = 4.25,
                        counts = GigReviewCountsDto(worker = 4, poster = 2, unknown = 1),
                    ),
                )

            val vm = ProfileGigReviewsViewModel(tabsRepo)
            vm.load("u2")

            val loaded = vm.state.value as ProfileGigReviewsUiState.Loaded
            // The header reads the server's totals, not the page size.
            assertEquals(7, loaded.summary.total)
            assertEquals(4.25, loaded.summary.average, 0.001)
            assertEquals(4, loaded.summary.workerCount)
            assertEquals(2, loaded.summary.posterCount)
            assertEquals(7, vm.totalCount.value)
            assertEquals(1, loaded.summary.distribution.getValue(5))
            assertEquals(1, loaded.summary.distribution.getValue(4))
            assertEquals(0, loaded.summary.distribution.getValue(1))

            assertEquals("Sam Lee", loaded.reviews[0].reviewerName)
            assertEquals(ProfileReviewFilter.Worker, loaded.reviews[0].receivedAs)
            assertEquals("Review as worker", loaded.reviews[0].roleLabel)
            assertEquals(1, loaded.reviews[0].mediaUrls.size)
            assertEquals("Dana Ray", loaded.reviews[1].reviewerName)
            assertEquals("u9", loaded.reviews[1].reviewerId)
            assertEquals("Review as gig poster", loaded.reviews[1].roleLabel)
            // `unknown` carries no role chip and belongs to neither filter.
            assertNull(loaded.reviews[2].receivedAs)
            assertNull(loaded.reviews[2].roleLabel)
            assertEquals("Anonymous", loaded.reviews[2].reviewerName)
        }

    @Test
    fun reviews_filter_splits_by_received_as() =
        runTest {
            coEvery { tabsRepo.userGigReviews("u2", 50) } returns
                NetworkResult.Success(
                    GigReviewsResponse(
                        reviews =
                            listOf(
                                GigReviewDto(id = "r1", rating = 5, receivedAs = "worker"),
                                GigReviewDto(id = "r2", rating = 4, receivedAs = "poster"),
                                GigReviewDto(id = "r3", rating = 3, receivedAs = "worker"),
                            ),
                        total = 3,
                        averageRating = 4.0,
                        counts = GigReviewCountsDto(worker = 2, poster = 1),
                    ),
                )

            val vm = ProfileGigReviewsViewModel(tabsRepo)
            vm.load("u2")

            assertEquals(3, vm.filteredReviews().size)
            vm.setFilter(ProfileReviewFilter.Worker)
            assertEquals(listOf("r1", "r3"), vm.filteredReviews().map { it.id })
            vm.setFilter(ProfileReviewFilter.Poster)
            assertEquals(listOf("r2"), vm.filteredReviews().map { it.id })
        }

    @Test
    fun reviews_empty_and_error_states() =
        runTest {
            coEvery { tabsRepo.userGigReviews("u2", 50) } returns
                NetworkResult.Success(GigReviewsResponse(total = 0, averageRating = 0.0))
            val empty = ProfileGigReviewsViewModel(tabsRepo)
            empty.load("u2")
            assertEquals(ProfileGigReviewsUiState.Empty, empty.state.value)

            coEvery { tabsRepo.userGigReviews("u3", 50) } returns
                NetworkResult.Failure(NetworkError.Server(500, "Failed to fetch reviews"))
            val failed = ProfileGigReviewsViewModel(tabsRepo)
            failed.load("u3")
            assertTrue(failed.state.value is ProfileGigReviewsUiState.Error)
        }

    // endregion
}
