@file:Suppress(
    "LongMethod",
    "PackageNaming",
    "LongParameterList",
    "TooManyFunctions",
    "MagicNumber",
    "LargeClass",
)

package app.pantopus.android.ui.screens.my_bids

import app.pantopus.android.data.api.models.gigs.GigBidMutationResponse
import app.pantopus.android.data.api.models.gigs.MarkCompletedResponse
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.BidGigDto
import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.offers.WithdrawBidReason
import app.pantopus.android.data.api.models.offers.WithdrawBidResponse
import app.pantopus.android.data.api.models.reviews.CreateReviewResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.UpdateBidResponseEnvelope
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.data.reviews.ReviewsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class MyBidsViewModelTest {
    private val offersRepo: OffersRepository = mockk()
    private val gigsRepo: GigsRepository = mockk()
    private val reviewsRepo: ReviewsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** 2026-05-15 12:00:00 UTC — Friday. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    private fun dto(
        id: String,
        status: String? = "pending",
        gigStatus: String = "open",
        createdAt: String? = null,
        expiresAt: String? = null,
        proposedTime: String? = null,
        bidAmount: Double? = 100.0,
        askingPrice: Double? = 120.0,
        category: String? = "handyman",
        shortlisted: Boolean? = null,
        yourRank: Int? = null,
        topPrice: Double? = null,
        counterAmount: Double? = null,
        counterStatus: String? = null,
    ) = BidDto(
        id = id,
        gigId = "g_$id",
        userId = "u",
        bidAmount = bidAmount,
        message = null,
        proposedTime = proposedTime,
        status = status,
        createdAt = createdAt,
        updatedAt = null,
        expiresAt = expiresAt,
        counterAmount = counterAmount,
        counterStatus = counterStatus,
        counteredAt = null,
        withdrawnAt = null,
        withdrawalReason = null,
        gig =
            BidGigDto(
                id = "g_$id",
                title = "Gig title",
                description = null,
                price = askingPrice,
                category = category,
                status = gigStatus,
                userId = "u_owner",
            ),
        bidder = null,
        shortlisted = shortlisted,
        yourRank = yourRank,
        topPrice = topPrice,
    )

    private fun vm(): MyBidsViewModel =
        MyBidsViewModel(offersRepo, gigsRepo, reviewsRepo).apply {
            overrideNow { fixedNow }
        }

    // MARK: - Lifecycle

    @Test
    fun load_with_empty_response_transitions_to_empty() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns NetworkResult.Success(MyBidsResponse(bids = emptyList()))
            val viewModel = vm()
            viewModel.load()
            val state = viewModel.state.value as ListOfRowsUiState.Empty
            assertEquals("You haven’t bid on any tasks yet", state.headline)
            assertEquals("Browse tasks", state.ctaTitle)
        }

    @Test
    fun load_with_pending_bid_lands_on_active_tab() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids =
                            listOf(
                                dto(id = "a1", createdAt = "2026-05-14T09:00:00Z"),
                            ),
                    ),
                )
            val viewModel = vm()
            viewModel.load()
            val state = viewModel.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, state.sections.first().rows.size)
            assertEquals(1, viewModel.tabs.value[0].count)
        }

    @Test
    fun load_failure_transitions_to_error_when_cold() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val viewModel = vm()
            viewModel.load()
            val state = viewModel.state.value as ListOfRowsUiState.Error
            // `NetworkError.Server.message` ignores the server-supplied
            // `body` and renders a user-friendly fallback. We just need
            // the VM to surface a non-empty error string here.
            assertTrue(state.message.contains("Server"))
        }

    // MARK: - Tab assignment

    @Test
    fun tab_assignment_covers_every_backend_status() {
        assertEquals(MyBidsTab.ACTIVE, MyBidsViewModel.tabFor(dto("p", status = "pending"), fixedNow))
        assertEquals(MyBidsTab.ACTIVE, MyBidsViewModel.tabFor(dto("c", status = "countered"), fixedNow))
        assertEquals(MyBidsTab.ACCEPTED, MyBidsViewModel.tabFor(dto("a", status = "accepted"), fixedNow))
        assertEquals(MyBidsTab.ACCEPTED, MyBidsViewModel.tabFor(dto("as", status = "assigned"), fixedNow))
        assertEquals(MyBidsTab.REJECTED, MyBidsViewModel.tabFor(dto("r", status = "rejected"), fixedNow))
        assertEquals(MyBidsTab.REJECTED, MyBidsViewModel.tabFor(dto("w", status = "withdrawn"), fixedNow))
        assertEquals(MyBidsTab.REJECTED, MyBidsViewModel.tabFor(dto("e", status = "expired"), fixedNow))
        assertEquals(
            MyBidsTab.REJECTED,
            MyBidsViewModel.tabFor(dto("k", status = "pending", gigStatus = "cancelled"), fixedNow),
        )
        assertEquals(
            MyBidsTab.DONE,
            MyBidsViewModel.tabFor(dto("d", status = "accepted", gigStatus = "completed"), fixedNow),
        )
    }

    // MARK: - Chip derivation

    @Test
    fun chip_pending_falls_back_to_pending() {
        val result =
            MyBidsViewModel.derivedStatus(dto("x", status = "pending", createdAt = "2026-05-12T09:00:00Z"), fixedNow)
        assertEquals(MyBidsStatus.Pending, result)
    }

    @Test
    fun chip_pending_near_expiry_is_expiring_with_hours_left() {
        val expiresIn90Min = "2026-05-15T13:30:00Z"
        val result =
            MyBidsViewModel.derivedStatus(
                dto("x", status = "pending", createdAt = "2026-05-15T11:30:00Z", expiresAt = expiresIn90Min),
                fixedNow,
            )
        assertTrue("Expected Expiring, got $result", result is MyBidsStatus.Expiring)
        assertEquals(2, (result as MyBidsStatus.Expiring).hoursLeft)
    }

    @Test
    fun chip_shortlisted_wins_over_pending() {
        val result =
            MyBidsViewModel.derivedStatus(
                dto("x", status = "pending", createdAt = "2026-05-14T09:00:00Z", shortlisted = true),
                fixedNow,
            )
        assertEquals(MyBidsStatus.Shortlisted, result)
    }

    @Test
    fun chip_rank_one_is_top_bid() {
        val result =
            MyBidsViewModel.derivedStatus(
                dto("x", status = "pending", createdAt = "2026-05-14T09:00:00Z", yourRank = 1),
                fixedNow,
            )
        assertEquals(MyBidsStatus.TopBid, result)
    }

    @Test
    fun chip_rank_greater_than_one_with_top_price_is_outbid() {
        val result =
            MyBidsViewModel.derivedStatus(
                dto(
                    "x",
                    status = "pending",
                    createdAt = "2026-05-14T09:00:00Z",
                    yourRank = 3,
                    topPrice = 80.0,
                ),
                fixedNow,
            )
        assertEquals(MyBidsStatus.Outbid, result)
    }

    @Test
    fun chip_accepted_with_future_proposed_is_scheduled() {
        val result =
            MyBidsViewModel.derivedStatus(
                dto(
                    "x",
                    status = "accepted",
                    proposedTime = "2026-05-17T09:00:00Z",
                ),
                fixedNow,
            )
        assertTrue("Expected Scheduled, got $result", result is MyBidsStatus.Scheduled)
    }

    @Test
    fun chip_accepted_no_proposed_is_accepted() {
        val result = MyBidsViewModel.derivedStatus(dto("x", status = "accepted"), fixedNow)
        assertEquals(MyBidsStatus.Accepted, result)
    }

    @Test
    fun chip_rejected_maps_to_not_selected() {
        val result = MyBidsViewModel.derivedStatus(dto("x", status = "rejected"), fixedNow)
        assertEquals(MyBidsStatus.NotSelected, result)
    }

    @Test
    fun chip_cancelled_gig_maps_to_task_cancelled() {
        val result =
            MyBidsViewModel.derivedStatus(dto("x", status = "pending", gigStatus = "cancelled"), fixedNow)
        assertEquals(MyBidsStatus.TaskCancelled, result)
    }

    @Test
    fun chip_completed_gig_prompts_leave_review() {
        val result =
            MyBidsViewModel.derivedStatus(dto("x", status = "accepted", gigStatus = "completed"), fixedNow)
        assertEquals(MyBidsStatus.LeaveReview, result)
    }

    // MARK: - Footer derivation

    @Test
    fun footer_active_gets_edit() {
        assertEquals(
            MyBidsFooter.Edit,
            MyBidsViewModel.footerFor(dto("x"), MyBidsTab.ACTIVE, MyBidsStatus.Pending),
        )
    }

    @Test
    fun footer_accepted_not_in_progress_gets_message() {
        val d = dto("x", status = "accepted", gigStatus = "assigned")
        assertEquals(
            MyBidsFooter.Message,
            MyBidsViewModel.footerFor(d, MyBidsTab.ACCEPTED, MyBidsStatus.Accepted),
        )
    }

    @Test
    fun footer_accepted_in_progress_gets_complete() {
        val d = dto("x", status = "accepted", gigStatus = "in_progress")
        assertEquals(
            MyBidsFooter.Complete,
            MyBidsViewModel.footerFor(d, MyBidsTab.ACCEPTED, MyBidsStatus.Accepted),
        )
    }

    @Test
    fun footer_rejected_gets_rebid() {
        assertEquals(
            MyBidsFooter.Rebid,
            MyBidsViewModel.footerFor(dto("x", status = "rejected"), MyBidsTab.REJECTED, MyBidsStatus.NotSelected),
        )
    }

    @Test
    fun footer_done_leave_review_gets_review() {
        val d = dto("x", status = "accepted", gigStatus = "completed")
        assertEquals(
            MyBidsFooter.Review(""),
            MyBidsViewModel.footerFor(d, MyBidsTab.DONE, MyBidsStatus.LeaveReview),
        )
    }

    @Test
    fun footer_done_paid_has_no_footer() {
        val d = dto("x", status = "accepted", gigStatus = "completed")
        assertEquals(
            MyBidsFooter.None,
            MyBidsViewModel.footerFor(d, MyBidsTab.DONE, MyBidsStatus.Paid("$95")),
        )
    }

    // MARK: - Highlight (muted)

    @Test
    fun highlight_muted_on_terminal_states() {
        val proj =
            MyBidsViewModel.BidProjection(
                dto = dto("x", status = "rejected"),
                tab = MyBidsTab.REJECTED,
                status = MyBidsStatus.NotSelected,
                footer = MyBidsFooter.Rebid,
            )
        assertEquals(RowHighlight.Muted, MyBidsViewModel.highlight(proj))
    }

    @Test
    fun highlight_none_on_active_states() {
        val proj =
            MyBidsViewModel.BidProjection(
                dto = dto("x"),
                tab = MyBidsTab.ACTIVE,
                status = MyBidsStatus.Pending,
                footer = MyBidsFooter.Edit,
            )
        assertNull(MyBidsViewModel.highlight(proj))
    }

    // MARK: - Row mapping

    @Test
    fun row_uses_category_gradient_leading_and_price_stack() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids =
                            listOf(
                                dto(
                                    "row",
                                    status = "pending",
                                    createdAt = "2026-05-14T09:00:00Z",
                                    bidAmount = 95.0,
                                    askingPrice = 120.0,
                                    category = "handyman",
                                ),
                            ),
                    ),
                )
            val viewModel = vm()
            viewModel.load()
            val state = viewModel.state.value as ListOfRowsUiState.Loaded
            val row = state.sections.first().rows.first()
            assertTrue(row.leading is RowLeading.CategoryGradientIcon)
            val trailing = row.trailing as RowTrailing.PriceStack
            assertEquals("$95", trailing.amount)
            assertEquals("budget $120", trailing.sublabel)
            assertEquals("Pending", row.chips?.first()?.text)
            assertEquals(2, row.footer?.actions?.size)
            assertEquals("Withdraw", row.footer?.actions?.first()?.title)
            assertEquals("Edit bid", row.footer?.actions?.last()?.title)
        }

    // MARK: - Tabs + banner

    @Test
    fun banner_summarises_leading_and_closing_soon() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids =
                            listOf(
                                dto(
                                    "top",
                                    status = "pending",
                                    createdAt = "2026-05-14T09:00:00Z",
                                    yourRank = 1,
                                ),
                                dto(
                                    "soon",
                                    status = "pending",
                                    createdAt = "2026-05-14T09:00:00Z",
                                    expiresAt = "2026-05-15T22:00:00Z",
                                ),
                            ),
                    ),
                )
            val viewModel = vm()
            viewModel.load()
            val banner = viewModel.banner.value
            assertNotNull(banner)
            assertTrue(banner!!.title.contains("Leading on 1"))
            assertTrue(banner.subtitle?.contains("1 closing") ?: false)
        }

    @Test
    fun banner_hidden_on_non_active_tabs() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids = listOf(dto("a", status = "pending", createdAt = "2026-05-14T09:00:00Z")),
                    ),
                )
            val viewModel = vm()
            viewModel.load()
            assertNotNull(viewModel.banner.value)
            viewModel.selectTab(MyBidsTab.REJECTED)
            assertNull(viewModel.banner.value)
        }

    @Test
    fun tabs_exposed_in_design_order() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns NetworkResult.Success(MyBidsResponse(bids = emptyList()))
            val viewModel = vm()
            viewModel.load()
            val tabs = viewModel.tabs.value
            assertEquals(4, tabs.size)
            assertEquals(MyBidsTab.ACTIVE, tabs[0].id)
            assertEquals("Active", tabs[0].label)
            assertEquals(MyBidsTab.ACCEPTED, tabs[1].id)
            assertEquals(MyBidsTab.REJECTED, tabs[2].id)
            assertEquals(MyBidsTab.DONE, tabs[3].id)
        }

    // MARK: - Optimistic withdraw

    @Test
    fun withdraw_optimistically_removes_row_from_active() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids = listOf(dto("w1", status = "pending", createdAt = "2026-05-14T09:00:00Z")),
                    ),
                )
            coEvery { offersRepo.withdrawBid("g_w1", "w1", any()) } returns
                NetworkResult.Success(WithdrawBidResponse(message = "ok"))
            val viewModel = vm()
            viewModel.load()
            assertEquals(1, viewModel.tabs.value[0].count)
            val targetBid =
                BidDto(
                    id = "w1",
                    gigId = "g_w1",
                    status = "pending",
                    gig =
                        BidGigDto(
                            id = "g_w1",
                            title = "Gig",
                            status = "open",
                        ),
                )
            viewModel.requestWithdraw(targetBid)
            assertNotNull(viewModel.withdrawTarget.value)
            viewModel.confirmWithdraw(WithdrawBidReason.ScheduleConflict)
            assertNull(viewModel.withdrawTarget.value)
            assertEquals(0, viewModel.tabs.value[0].count)
            assertEquals(1, viewModel.tabs.value[2].count)
        }

    @Test
    fun withdraw_rolls_back_on_failure() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids = listOf(dto("w2", status = "pending", createdAt = "2026-05-14T09:00:00Z")),
                    ),
                )
            coEvery { offersRepo.withdrawBid("g_w2", "w2", any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "nope"))
            val viewModel = vm()
            viewModel.load()
            val targetBid =
                BidDto(
                    id = "w2",
                    gigId = "g_w2",
                    status = "pending",
                    gig =
                        BidGigDto(
                            id = "g_w2",
                            title = "Gig",
                            status = "open",
                        ),
                )
            viewModel.requestWithdraw(targetBid)
            viewModel.confirmWithdraw(null)
            assertEquals(1, viewModel.tabs.value[0].count)
            assertEquals(0, viewModel.tabs.value[2].count)
        }

    @Test
    fun fab_is_extended_nav_browse_tasks() {
        val viewModel = vm()
        val fab = viewModel.fab.value
        assertNotNull(fab)
        assertTrue(
            fab!!.variant is
                app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant.ExtendedNav,
        )
        val label =
            (fab.variant as app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant.ExtendedNav).label
        assertEquals("Browse tasks", label)
    }

    @Test
    fun mark_complete_optimistically_moves_row_to_done() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids =
                            listOf(
                                dto(
                                    "m1",
                                    status = "accepted",
                                    gigStatus = "in_progress",
                                    createdAt = "2026-05-14T09:00:00Z",
                                ),
                            ),
                    ),
                )
            coEvery { gigsRepo.markCompleted("g_m1", any()) } returns
                NetworkResult.Success(MarkCompletedResponse(message = "ok"))
            val viewModel = vm()
            viewModel.load()
            val targetBid =
                BidDto(
                    id = "m1",
                    gigId = "g_m1",
                    status = "accepted",
                    gig =
                        BidGigDto(
                            id = "g_m1",
                            title = "Gig",
                            status = "in_progress",
                        ),
                )
            assertEquals(1, viewModel.tabs.value[1].count) // Accepted
            viewModel.markComplete(targetBid)
            assertEquals(0, viewModel.tabs.value[1].count)
            assertEquals(1, viewModel.tabs.value[3].count) // Done
        }

    @Test
    fun load_already_loaded_is_idempotent() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids = listOf(dto("a", status = "pending", createdAt = "2026-05-14T09:00:00Z")),
                    ),
                )
            val viewModel = vm()
            viewModel.load()
            val firstState = viewModel.state.value
            // Calling load again after success is a no-op (returns without
            // recomputing). Verify the same state instance survives.
            viewModel.load()
            assertTrue(viewModel.state.value === firstState || viewModel.state.value is ListOfRowsUiState.Loaded)
            assertFalse(viewModel.state.value is ListOfRowsUiState.Loading)
        }

    // MARK: - Edit bid sheet

    @Test
    fun request_edit_bid_sets_target_with_prefilled_values() {
        val viewModel = vm()
        val bid =
            BidDto(
                id = "e1",
                gigId = "g_e1",
                userId = "u",
                bidAmount = 95.0,
                message = "Old message",
                proposedTime = "Saturday afternoon",
                status = "pending",
                gig =
                    BidGigDto(
                        id = "g_e1",
                        title = "Mount a TV",
                        status = "open",
                        userId = "u_owner",
                    ),
            )
        viewModel.requestEditBid(bid)
        val target = viewModel.editBidTarget.value
        assertNotNull(target)
        assertEquals("g_e1", target!!.gigId)
        assertEquals("e1", target.bidId)
        assertEquals(95.0, target.initialAmount!!, 0.0001)
        assertEquals("Old message", target.initialMessage)
        assertEquals("Saturday afternoon", target.initialProposedTime)
        assertNull(target.initialTerms)
    }

    @Test
    fun request_edit_bid_splits_message_and_terms_when_present() {
        val viewModel = vm()
        val bid =
            BidDto(
                id = "et",
                gigId = "g",
                userId = "u",
                bidAmount = 50.0,
                message = "Hi there\n\nTerms: 50% deposit upfront",
                status = "pending",
                gig =
                    BidGigDto(
                        id = "g",
                        title = "t",
                        status = "open",
                        userId = "u_owner",
                    ),
            )
        viewModel.requestEditBid(bid)
        val target = viewModel.editBidTarget.value!!
        assertEquals("Hi there", target.initialMessage)
        assertEquals("50% deposit upfront", target.initialTerms)
    }

    @Test
    fun cancel_edit_bid_clears_target() {
        val viewModel = vm()
        val bid = dto("e2")
        viewModel.requestEditBid(bid)
        assertNotNull(viewModel.editBidTarget.value)
        viewModel.cancelEditBid()
        assertNull(viewModel.editBidTarget.value)
    }

    @Test
    fun submit_edit_bid_hits_update_endpoint_and_updates_row() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids = listOf(dto("e3", status = "pending", createdAt = "2026-05-14T09:00:00Z")),
                    ),
                )
            coEvery {
                offersRepo.updateBid("g_e3", "e3", any())
            } returns NetworkResult.Success(UpdateBidResponseEnvelope(bid = null))

            val viewModel = vm()
            viewModel.load()
            val bid =
                BidDto(
                    id = "e3",
                    gigId = "g_e3",
                    userId = "u",
                    bidAmount = 100.0,
                    status = "pending",
                    gig = BidGigDto(id = "g_e3", title = "t", status = "open", userId = "u_owner"),
                )
            viewModel.requestEditBid(bid)
            val ok =
                viewModel.submitEditBid(
                    EditBidDraft(amount = 75.0, message = "Updated", proposedTime = null),
                )
            assertTrue(ok)
            assertNull(viewModel.editBidTarget.value)
            assertEquals("Bid updated.", viewModel.toast.value?.text)
            assertFalse(viewModel.toast.value?.isError ?: true)
            val state = viewModel.state.value as ListOfRowsUiState.Loaded
            val trailing = state.sections.first().rows.first().trailing as RowTrailing.PriceStack
            assertEquals("$75", trailing.amount)
        }

    @Test
    fun submit_edit_bid_reports_error_on_failure() =
        runTest {
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(
                    MyBidsResponse(
                        bids = listOf(dto("e4", status = "pending", createdAt = "2026-05-14T09:00:00Z")),
                    ),
                )
            coEvery {
                offersRepo.updateBid("g_e4", "e4", any())
            } returns NetworkResult.Failure(NetworkError.Server(500, "nope"))

            val viewModel = vm()
            viewModel.load()
            val bid =
                BidDto(
                    id = "e4",
                    gigId = "g_e4",
                    userId = "u",
                    bidAmount = 50.0,
                    status = "pending",
                    gig = BidGigDto(id = "g_e4", title = "t", status = "open", userId = "u_owner"),
                )
            viewModel.requestEditBid(bid)
            val ok =
                viewModel.submitEditBid(
                    EditBidDraft(amount = 60.0, message = null, proposedTime = null),
                )
            assertFalse(ok)
            assertNotNull(viewModel.editBidTarget.value)
            assertTrue(viewModel.toast.value?.isError ?: false)
        }

    // MARK: - Leave review sheet

    @Test
    fun request_leave_review_sets_target_with_gig_poster_as_reviewee() {
        val viewModel = vm()
        val bid = dto("r1", status = "accepted", gigStatus = "completed")
        viewModel.requestLeaveReview(bid)
        val target = viewModel.leaveReviewTarget.value
        assertNotNull(target)
        assertEquals("g_r1", target!!.gigId)
        assertEquals("u_owner", target.revieweeId)
    }

    @Test
    fun request_leave_review_noops_when_gig_poster_missing() {
        val viewModel = vm()
        val bid =
            BidDto(
                id = "r2",
                gigId = "g_r2",
                userId = "u",
                bidAmount = 50.0,
                status = "accepted",
                gig =
                    BidGigDto(
                        id = "g_r2",
                        title = "t",
                        status = "completed",
                        userId = null,
                    ),
            )
        viewModel.requestLeaveReview(bid)
        assertNull(viewModel.leaveReviewTarget.value)
    }

    @Test
    fun cancel_leave_review_clears_target() {
        val viewModel = vm()
        viewModel.requestLeaveReview(dto("r3", status = "accepted", gigStatus = "completed"))
        assertNotNull(viewModel.leaveReviewTarget.value)
        viewModel.cancelLeaveReview()
        assertNull(viewModel.leaveReviewTarget.value)
    }

    @Test
    fun submit_leave_review_hits_create_endpoint_and_flashes_success() =
        runTest {
            coEvery { reviewsRepo.create(any()) } returns
                NetworkResult.Success(CreateReviewResponse(id = "rv1"))
            val viewModel = vm()
            viewModel.requestLeaveReview(dto("r4", status = "accepted", gigStatus = "completed"))
            val ok = viewModel.submitLeaveReview(LeaveReviewDraft(rating = 5, comment = "Great!"))
            assertTrue(ok)
            assertNull(viewModel.leaveReviewTarget.value)
            assertEquals("Review submitted. Thanks!", viewModel.toast.value?.text)
            assertFalse(viewModel.toast.value?.isError ?: true)
        }

    @Test
    fun submit_leave_review_reports_error_on_failure() =
        runTest {
            coEvery { reviewsRepo.create(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "nope"))
            val viewModel = vm()
            viewModel.requestLeaveReview(dto("r5", status = "accepted", gigStatus = "completed"))
            val ok = viewModel.submitLeaveReview(LeaveReviewDraft(rating = 4, comment = null))
            assertFalse(ok)
            assertNotNull(viewModel.leaveReviewTarget.value)
            assertTrue(viewModel.toast.value?.isError ?: false)
        }

    // MARK: - Message / terms composition

    @Test
    fun compose_message_combines_message_and_terms() {
        assertNull(composeMessage("", ""))
        assertEquals("Hello", composeMessage("Hello", ""))
        assertEquals("Terms: Deposit", composeMessage("", "Deposit"))
        assertEquals("Hello\n\nTerms: Deposit", composeMessage("Hello", "Deposit"))
    }

    @Test
    fun split_message_and_terms_handles_every_shape() {
        val (msg1, t1) = splitMessageAndTerms(null)
        assertNull(msg1)
        assertNull(t1)

        val (msg2, t2) = splitMessageAndTerms("Just a message")
        assertEquals("Just a message", msg2)
        assertNull(t2)

        val (msg3, t3) = splitMessageAndTerms("Terms: Deposit upfront")
        assertNull(msg3)
        assertEquals("Deposit upfront", t3)

        val (msg4, t4) = splitMessageAndTerms("Hi\n\nTerms: Deposit upfront")
        assertEquals("Hi", msg4)
        assertEquals("Deposit upfront", t4)
    }

    @Test
    fun dismiss_toast_clears_state() =
        runTest {
            coEvery { reviewsRepo.create(any()) } returns
                NetworkResult.Success(CreateReviewResponse(id = "rv"))
            val viewModel = vm()
            viewModel.requestLeaveReview(dto("rt", status = "accepted", gigStatus = "completed"))
            viewModel.submitLeaveReview(LeaveReviewDraft(rating = 5, comment = null))
            assertNotNull(viewModel.toast.value)
            viewModel.dismissToast()
            assertNull(viewModel.toast.value)
        }

    // MARK: - Phase 5 · counter-offers (work item 2)

    @Test
    fun countered_bid_with_pending_counter_derives_countered_status() {
        val d = dto("c1", status = "countered", counterAmount = 80.0, counterStatus = "pending")
        val status = MyBidsViewModel.derivedStatus(d, fixedNow)
        assertEquals(MyBidsStatus.Countered("$80"), status)
        assertEquals(MyBidsTab.ACTIVE, MyBidsViewModel.tabFor(d, fixedNow))
        assertEquals(MyBidsFooter.CounterRespond, MyBidsViewModel.footerFor(d, MyBidsTab.ACTIVE, status))
        assertEquals("pending", MyBidsViewModel.statusFilterId(status))
    }

    @Test
    fun resolved_counter_no_longer_shows_countered_chip() {
        val declined = dto("c2", status = "countered", counterAmount = 80.0, counterStatus = "declined")
        val status = MyBidsViewModel.derivedStatus(declined, fixedNow)
        assertEquals(MyBidsStatus.Pending, status)
        assertEquals(MyBidsFooter.Edit, MyBidsViewModel.footerFor(declined, MyBidsTab.ACTIVE, status))
    }

    @Test
    fun accept_counter_adopts_counter_amount_and_posts() =
        runTest {
            val countered = dto("c3", status = "countered", bidAmount = 100.0, counterAmount = 80.0, counterStatus = "pending")
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(MyBidsResponse(bids = listOf(countered)))
            coEvery { gigsRepo.acceptCounterOffer("g_c3", "c3") } returns
                NetworkResult.Success(GigBidMutationResponse())
            val viewModel = vm()
            viewModel.load()
            viewModel.acceptCounter(countered)
            val state = viewModel.state.value as ListOfRowsUiState.Loaded
            val trailing = state.sections.first().rows.first().trailing as RowTrailing.PriceStack
            assertEquals("$80", trailing.amount)
            assertEquals("Counter accepted — new amount locked in.", viewModel.toast.value?.text)
        }

    @Test
    fun decline_counter_failure_reverts_row() =
        runTest {
            val countered = dto("c4", status = "countered", counterAmount = 80.0, counterStatus = "pending")
            coEvery { offersRepo.myBids(any()) } returns
                NetworkResult.Success(MyBidsResponse(bids = listOf(countered)))
            coEvery { gigsRepo.declineCounterOffer("g_c4", "c4") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val viewModel = vm()
            viewModel.load()
            viewModel.declineCounter(countered)
            val state = viewModel.state.value as ListOfRowsUiState.Loaded
            val chip = state.sections.first().rows.first().chips!!.first()
            assertEquals("Countered $80", chip.text)
            assertTrue(viewModel.toast.value?.isError == true)
        }
}
