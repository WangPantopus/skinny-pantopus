@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

class FindATimeSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2600, softButtons = false))

    private val mom = FindMember("u-mom", "Mom")
    private val dad = FindMember("u-dad", "Dad")
    private val ava = FindMember("u-ava", "Ava")
    private val tomek = FindMember("u-tomek", "Tomek")

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    // ─── F4 Setup ────────────────────────────────────────────────────────────

    private fun setupForm() =
        SetupForm(
            homeId = "home-1",
            homeName = "Birch Ln",
            title = "Plan a family call",
            titlePlaceholder = "Plan a family call",
            members = listOf(mom, dad, ava.copy(required = false)),
            mode = FindMode.Collective,
            durationChoice = DurationChoice.Half,
            customDurationMin = 45,
            windowPreset = WindowPreset.ThisWeek,
            explainerExpanded = false,
            today = LocalDate.of(2026, 6, 15),
        )

    @Test
    fun f4_setup_loaded() =
        paparazzi.snapshot {
            Frame {
                FindATimeSetupContent(
                    state = FindATimeSetupUiState.Loaded(setupForm()),
                    onBack = {}, onNext = {}, onRetry = {}, onTitle = {}, onToggleRequired = { _, _ -> },
                    onMode = {}, onDuration = {}, onAdjustCustom = {}, onWindow = {}, onToggleExplainer = {},
                )
            }
        }

    // ─── F5 Suggested slots ──────────────────────────────────────────────────

    private fun header() =
        SlotsHeader(
            peopleLabel = "3 people",
            durationLabel = "30 min",
            windowLabel = "this week",
            tzId = "America/Los_Angeles",
            tzLabel = "PT",
        )

    private fun slotRow(
        time: String,
        free: List<Boolean>,
        best: Boolean = false,
        assignee: String? = null,
    ) = SlotRowUi(
        start = "2026-06-22T${time}Z",
        endIso = "2026-06-22T${time}Z",
        dayLabel = "Mon Jun 22",
        timeLabel = "2:00 PM",
        members = listOf(mom to free[0], dad to free[1], ava to free[2]),
        freeLabel = FindATimeFormat.freeLabel(free.count { it }, 3),
        isBest = best,
        assigneeName = assignee,
    )

    @Test
    fun f5_results() =
        paparazzi.snapshot {
            Frame {
                SuggestedSlotsContent(
                    state =
                        SuggestedSlotsUiState.Loaded(
                            header = header(),
                            slots =
                                listOf(
                                    slotRow("21:00:00", listOf(true, true, true), best = true),
                                    slotRow("01:00:00", listOf(true, true, false)),
                                    slotRow("03:00:00", listOf(true, false, true)),
                                ),
                            expandedStart = "2026-06-22T21:00:00Z",
                            isSingle = false,
                        ),
                    onBack = {},
                    onRetry = {},
                    onToggleExpand = {},
                    onBook = {},
                    onSendProposal = {},
                    onTimezoneClick = {},
                    onViewResponses = {},
                )
            }
        }

    @Test
    fun f5_no_overlap() =
        paparazzi.snapshot {
            Frame {
                SuggestedSlotsContent(
                    state = SuggestedSlotsUiState.Empty(header()),
                    onBack = {},
                    onRetry = {},
                    onToggleExpand = {},
                    onBook = {},
                    onSendProposal = {},
                    onTimezoneClick = {},
                    onViewResponses = {},
                )
            }
        }

    // ─── F6 Poll response ────────────────────────────────────────────────────

    @Test
    fun f6_poll_loaded() =
        paparazzi.snapshot {
            Frame {
                MemberPollResponseContent(
                    state =
                        PollResponseUiState.Loaded(
                            header = PollHeader("Family call", "30 min · respond by Fri"),
                            options =
                                listOf(
                                    PollOptionUi("a", "Mon Jun 22", "2:00 PM", VoteValue.Works),
                                    PollOptionUi("b", "Mon Jun 22", "6:00 PM", VoteValue.Maybe),
                                    PollOptionUi("c", "Tue Jun 23", "7:30 PM", VoteValue.Cant),
                                ),
                            voterName = "Mom",
                            voterEmail = "mom@home.test",
                            needsEmail = false,
                        ),
                    onBack = {},
                    onRetry = {},
                    onVote = { _, _ -> },
                    onName = {},
                    onEmail = {},
                    onSubmit = {},
                )
            }
        }

    // ─── F7 Who's free ───────────────────────────────────────────────────────

    @Test
    fun f7_whos_free_loaded() =
        paparazzi.snapshot {
            val cols = listOf("8a", "10a", "12p", "2p", "4p", "6p").map { GridColumn(it) }

            fun row(
                m: FindMember,
                cells: List<CellState>,
            ) = MemberRow(m, cells)
            val f = CellState.Free
            val b = CellState.Busy
            val u = CellState.Unknown
            Frame {
                WhosFreeContent(
                    state =
                        WhosFreeUiState.Loaded(
                            grid =
                                HeatGrid(
                                    columns = cols,
                                    rows =
                                        listOf(
                                            row(mom, listOf(f, f, b, f, f, b)),
                                            row(dad, listOf(b, f, f, b, f, f)),
                                            row(ava, listOf(b, b, f, f, f, f)),
                                            row(tomek, List(6) { u }),
                                        ),
                                ),
                            filters =
                                listOf(
                                    FilterChip(FILTER_ALL, "All"),
                                    FilterChip("u-mom", "Mom"),
                                    FilterChip("u-dad", "Dad"),
                                    FilterChip("u-ava", "Ava"),
                                    FilterChip("u-tomek", "Tomek"),
                                ),
                            selectedFilter = FILTER_ALL,
                            view = GridView.Day,
                            hasFree = true,
                            emptyAllBusy = false,
                            optedOutNames = listOf("Tomek"),
                            windowLabel = "Wed Jun 17",
                        ),
                    onBack = {}, onRetry = {}, onAdd = {}, onSelectFilter = {}, onSetView = {}, onTryNext = {},
                    onTapFree = { _, _ -> }, tapped = null, onDismissTapped = {}, onFindTimeHere = {}, onAddEvent = {},
                )
            }
        }
}
