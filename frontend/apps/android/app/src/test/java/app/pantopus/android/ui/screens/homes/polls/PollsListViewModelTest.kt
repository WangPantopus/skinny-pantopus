@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.polls

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomePollsResponse
import app.pantopus.android.data.api.models.homes.PollDto
import app.pantopus.android.data.api.models.homes.PollOptionDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
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

/**
 * Covers the Polls VM (T6.3e / P13):
 *  - four-state transitions
 *  - 3-state chip derivation (active / closing / closed)
 *  - kind classification (decision / schedule / yesno / open)
 *  - "Leading: <option>" + "Voted: <option>" chip derivation
 *  - tab filtering / counts
 *  - banner summary projection
 *  - optimistic vote merge
 *  - FAB + top-bar shape
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PollsListViewModelTest {
    private val repo: HomesRepository = mockk()

    /** Fixed clock for deterministic chip derivation — 2026-05-15T12:00:00Z. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Suppress("LongParameterList")
    private fun makePoll(
        id: String = "p",
        title: String = "Paint color?",
        pollType: String = "single_choice",
        options: List<PollOptionDto> =
            listOf(
                PollOptionDto("sage", "Sage"),
                PollOptionDto("white", "White"),
                PollOptionDto("navy", "Navy"),
            ),
        status: String = "open",
        closesAt: String? = "2026-05-20T12:00:00Z",
        voteCount: Int = 0,
        optionCounts: Map<String, Int> = emptyMap(),
        myVote: List<String>? = null,
    ): PollDto =
        PollDto(
            id = id,
            homeId = "home-1",
            title = title,
            pollType = pollType,
            options = options,
            status = status,
            closesAt = closesAt,
            voteCount = voteCount,
            optionCounts = optionCounts,
            myVote = myVote,
        )

    private fun makeVm(): PollsListViewModel =
        PollsListViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(POLLS_HOME_ID_KEY to "home-1")),
            viewerId = "viewer-1",
            clock = { fixedNow },
        )

    // ─── Four states ───────────────────────────────────────────

    @Test
    fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Success(GetHomePollsResponse(polls = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            state as ListOfRowsUiState.Empty
            assertEquals("No active polls", state.headline)
            assertEquals("Start a poll", state.ctaTitle)
        }

    @Test
    fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun loaded_response_maps_row_to_chevron_template() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Success(
                    GetHomePollsResponse(
                        polls =
                            listOf(
                                makePoll(
                                    id = "p1",
                                    voteCount = 2,
                                    optionCounts = mapOf("sage" to 2, "white" to 0),
                                    myVote = listOf("sage"),
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            state as ListOfRowsUiState.Loaded
            assertFalse(state.hasMore)
            val row = state.sections[0].rows[0]
            assertEquals("p1", row.id)
            assertEquals("Paint color?", row.title)
            assertEquals("2 votes · 3 options", row.subtitle)
            assertTrue(row.trailing is RowTrailing.Chevron)
            val leading = row.leading
            assertTrue(leading is RowLeading.TypeIcon)
            leading as RowLeading.TypeIcon
            assertEquals(PantopusIcon.ClipboardList, leading.icon)
            val chips = row.chips.orEmpty()
            assertTrue(chips.size >= 3)
            assertEquals("Active", chips[0].text)
            assertTrue(chips.any { it.text.startsWith("Leading: Sage") })
            assertTrue(chips.any { it.text == "Voted: Sage" })
        }

    // ─── Chip status derivation ───────────────────────────────

    @Test
    fun chipStatus_closed_when_status_closed() {
        assertEquals(
            PollChipStatus.Closed,
            PollsListViewModel.chipStatus(makePoll(status = "closed"), fixedNow),
        )
    }

    @Test
    fun chipStatus_closed_when_status_canceled() {
        assertEquals(
            PollChipStatus.Closed,
            PollsListViewModel.chipStatus(makePoll(status = "canceled"), fixedNow),
        )
    }

    @Test
    fun chipStatus_closed_when_closesAt_past() {
        assertEquals(
            PollChipStatus.Closed,
            PollsListViewModel.chipStatus(
                makePoll(status = "open", closesAt = "2026-05-14T00:00:00Z"),
                fixedNow,
            ),
        )
    }

    @Test
    fun chipStatus_closing_when_closesAt_within_24h() {
        assertEquals(
            PollChipStatus.Closing,
            PollsListViewModel.chipStatus(
                makePoll(status = "open", closesAt = "2026-05-15T20:00:00Z"),
                fixedNow,
            ),
        )
    }

    @Test
    fun chipStatus_active_when_closesAt_beyond_24h() {
        assertEquals(
            PollChipStatus.Active,
            PollsListViewModel.chipStatus(
                makePoll(status = "open", closesAt = "2026-05-20T12:00:00Z"),
                fixedNow,
            ),
        )
    }

    @Test
    fun chipStatus_active_when_no_close_date() {
        assertEquals(
            PollChipStatus.Active,
            PollsListViewModel.chipStatus(
                makePoll(status = "open", closesAt = null),
                fixedNow,
            ),
        )
    }

    // ─── Kind classification ──────────────────────────────────

    @Test
    fun kind_yes_no_wins() {
        assertEquals(PollKind.YesNo, PollKind.from("yes_no", "Replace dishwasher?"))
    }

    @Test
    fun kind_multiple_choice_open() {
        assertEquals(PollKind.Open, PollKind.from("multiple_choice", "Movie picks"))
    }

    @Test
    fun kind_ranking_decision() {
        assertEquals(PollKind.Decision, PollKind.from("ranking", "Rank vendors"))
    }

    @Test
    fun kind_default_decision() {
        assertEquals(PollKind.Decision, PollKind.from("single_choice", "Paint color?"))
    }

    @Test
    fun kind_upgrades_to_schedule_when_weekend_keyword() {
        assertEquals(
            PollKind.Schedule,
            PollKind.from("single_choice", "Garage sale this weekend — Sat or Sun?"),
        )
    }

    @Test
    fun kind_upgrades_to_schedule_when_day_name() {
        assertEquals(PollKind.Schedule, PollKind.from("single_choice", "Saturday or Sunday?"))
    }

    // ─── Projection ───────────────────────────────────────────

    @Test
    fun projection_emits_leading_chip_when_option_counts_present() {
        val poll =
            makePoll(
                voteCount = 3,
                optionCounts = mapOf("sage" to 2, "white" to 1, "navy" to 0),
            )
        val projection = PollsListViewModel.project(poll, fixedNow)
        assertNotNull(projection.leadingChip)
        assertEquals("Leading: Sage · 2 votes", projection.leadingChip?.text)
    }

    @Test
    fun projection_emits_winner_chip_when_closed() {
        val poll =
            makePoll(
                status = "closed",
                voteCount = 3,
                optionCounts = mapOf("sage" to 2, "white" to 1),
            )
        val projection = PollsListViewModel.project(poll, fixedNow)
        assertEquals("Winner: Sage · 2 votes", projection.leadingChip?.text)
        assertEquals("Closed", projection.chipText)
        assertEquals(StatusChipVariant.Neutral, projection.chipVariant)
    }

    @Test
    fun projection_omits_leading_chip_when_no_votes() {
        val poll = makePoll(voteCount = 0, optionCounts = emptyMap())
        val projection = PollsListViewModel.project(poll, fixedNow)
        assertNull(projection.leadingChip)
    }

    @Test
    fun projection_emits_voted_chip_when_viewer_voted() {
        val poll = makePoll(myVote = listOf("white"))
        val projection = PollsListViewModel.project(poll, fixedNow)
        assertEquals("Voted: White", projection.votedChip?.text)
    }

    @Test
    fun projection_time_meta_hours_when_closing() {
        val poll = makePoll(status = "open", closesAt = "2026-05-15T21:00:00Z")
        val projection = PollsListViewModel.project(poll, fixedNow)
        assertEquals(PollChipStatus.Closing, projection.chipStatus)
        assertEquals("Closes in 9 hr", projection.timeMeta)
    }

    @Test
    fun projection_time_meta_date_when_active() {
        val poll = makePoll(status = "open", closesAt = "2026-05-19T12:00:00Z")
        val projection = PollsListViewModel.project(poll, fixedNow)
        assertEquals(PollChipStatus.Active, projection.chipStatus)
        assertEquals("Closes May 19", projection.timeMeta)
    }

    // ─── Tab filtering ────────────────────────────────────────

    @Test
    fun active_tab_excludes_closed_polls() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Success(
                    GetHomePollsResponse(
                        polls =
                            listOf(
                                makePoll(id = "a", status = "open", closesAt = "2026-06-01T00:00:00Z"),
                                makePoll(id = "c", status = "closed", closesAt = "2026-05-10T00:00:00Z"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, state.sections[0].rows.size)
            assertEquals("a", state.sections[0].rows[0].id)
        }

    @Test
    fun closed_tab_shows_only_closed_polls() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Success(
                    GetHomePollsResponse(
                        polls =
                            listOf(
                                makePoll(id = "a", status = "open", closesAt = "2026-06-01T00:00:00Z"),
                                makePoll(id = "c", status = "closed", closesAt = "2026-05-10T00:00:00Z"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.selectTab(PollsTab.Closed.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, state.sections[0].rows.size)
            assertEquals("c", state.sections[0].rows[0].id)
        }

    @Test
    fun tabs_counts_reflect_chip_statuses() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Success(
                    GetHomePollsResponse(
                        polls =
                            listOf(
                                makePoll(id = "a", status = "open", closesAt = "2026-06-01T00:00:00Z"),
                                makePoll(id = "b", status = "open", closesAt = "2026-05-15T18:00:00Z"),
                                makePoll(id = "c", status = "closed"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val tabs = vm.tabs.value.associate { it.id to (it.count ?: 0) }
            assertEquals(2, tabs[PollsTab.Active.id])
            assertEquals(1, tabs[PollsTab.Closed.id])
        }

    // ─── Banner ───────────────────────────────────────────────

    @Test
    fun banner_counts_active_polls_awaiting_viewer_vote() {
        val polls =
            listOf(
                makePoll(id = "a", status = "open", myVote = null),
                makePoll(id = "b", status = "open", myVote = listOf("sage")),
                makePoll(id = "c", status = "closed", myVote = null),
            )
        val summary = PollsListViewModel.summarize(polls, "viewer-1", fixedNow)
        assertEquals(2, summary.totalActive)
        assertEquals(1, summary.awaitingViewerVote)
    }

    @Test
    fun banner_hasContent_false_when_no_active_polls() {
        val polls = listOf(makePoll(id = "c", status = "closed"))
        val summary = PollsListViewModel.summarize(polls, null, fixedNow)
        assertFalse(summary.hasContent)
    }

    // ─── Optimistic vote ──────────────────────────────────────

    @Test
    fun applyOptimisticVote_adds_count_when_no_prior_vote() {
        val poll =
            makePoll(
                voteCount = 1,
                optionCounts = mapOf("white" to 1),
                myVote = null,
            )
        val updated = PollDetailViewModel.applyOptimisticVote(poll, "sage")
        assertEquals(2, updated.voteCount)
        assertEquals(1, updated.optionCounts["sage"])
        assertEquals(1, updated.optionCounts["white"])
        assertEquals(listOf("sage"), updated.myVote)
    }

    @Test
    fun applyOptimisticVote_switches_count_when_changing_vote() {
        val poll =
            makePoll(
                voteCount = 2,
                optionCounts = mapOf("sage" to 1, "white" to 1),
                myVote = listOf("white"),
            )
        val updated = PollDetailViewModel.applyOptimisticVote(poll, "sage")
        assertEquals(2, updated.voteCount)
        assertEquals(2, updated.optionCounts["sage"])
        assertNull(updated.optionCounts["white"])
        assertEquals(listOf("sage"), updated.myVote)
    }

    // ─── FAB / top bar ────────────────────────────────────────

    @Test
    fun fab_is_secondaryCreate_with_home_tint() =
        runTest {
            coEvery { repo.getHomePolls(any()) } returns
                NetworkResult.Success(GetHomePollsResponse(polls = emptyList()))
            val vm = makeVm()
            vm.load()
            val fab = vm.fab()
            assertEquals("Start a poll", fab.contentDescription)
            assertEquals(FabTint.Home, fab.tint)
            assertEquals(FabVariant.SecondaryCreate, fab.variant)
        }

    @Test
    fun topBarAction_is_null_by_design() {
        val vm = makeVm()
        assertNull(vm.topBarAction)
    }

    // ─── Chip status types ────────────────────────────────────

    @Test
    fun active_chip_uses_success_variant() {
        val projection =
            PollsListViewModel.project(
                makePoll(status = "open", closesAt = "2026-06-01T00:00:00Z"),
                fixedNow,
            )
        assertEquals(StatusChipVariant.Success, projection.chipVariant)
        assertEquals(PantopusIcon.Circle, projection.chipIcon)
    }

    @Test
    fun closing_chip_uses_warning_variant() {
        val projection =
            PollsListViewModel.project(
                makePoll(status = "open", closesAt = "2026-05-15T20:00:00Z"),
                fixedNow,
            )
        assertEquals(StatusChipVariant.Warning, projection.chipVariant)
        assertEquals(PantopusIcon.Clock, projection.chipIcon)
    }

    @Test
    fun voted_chip_uses_info_variant_tint() {
        val poll = makePoll(myVote = listOf("white"))
        val projection = PollsListViewModel.project(poll, fixedNow)
        val voted = projection.votedChip
        assertNotNull(voted)
        val tint = voted!!.tint
        assertTrue(tint is RowChip.Tint.Status)
        tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.Info, tint.variant)
    }
}
