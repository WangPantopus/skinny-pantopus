@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.detail

import app.pantopus.android.ui.components.SlotCalendarDay
import app.pantopus.android.ui.components.SlotCalendarState
import java.util.Calendar
import java.util.Date
import java.util.TimeZone

/**
 * Deterministic stub fixtures for the Support Train detail screen.
 * The backend's `GET /api/support-trains/:id` handler is not yet wired
 * to project the full detail payload (slots / contributors / recipient
 * profile), so the view-model reads these fixtures directly and
 * previews + snapshot baselines drive off them. Values mirror the
 * A10.9 design frames in `docs/designs/A10/support-train-frames.jsx`:
 *   - [populated]     12 / 21 slots covered · 9 open
 *   - [fullyCovered]  every slot taken · viewer signed up · split dock
 */
object SupportTrainDetailSampleData {
    /** FRAME 1 · POPULATED — 12 / 21 slots covered, 9 open. */
    val populated: SupportTrainDetailContent by lazy {
        val base = baseStartDate(year = 2025, month = 10, day = 24) // Calendar months are 0-indexed: 10 = November
        SupportTrainDetailContent(
            trainId = "sample-populated",
            recipient = reyesRecipient,
            typeDates =
                TypeDatesCardContent(
                    kind = SupportTrainKind.Meals,
                    title = "Meal train · dinner for 4",
                    dateRange = "Mon Nov 24 → Sun Dec 22",
                    daysLeft = 20,
                    slotsFilled = 12,
                    slotsTotal = 21,
                    contributors = sampleContributors,
                    extraCount = 8,
                ),
            calendarDays = populatedCalendar(base = base),
            sections =
                listOf(
                    SlotSection(
                        id = "open",
                        overline = "Open slots near you",
                        actionLabel = "See all 9",
                        rows =
                            listOf(
                                SlotRowContent(
                                    id = "open-thu-4",
                                    dayLabel = "Thu",
                                    dateLabel = "4",
                                    state = SlotRowState.Open,
                                    title = "Open · dinner for 4",
                                    subtitle = "Drop off by 5:30 pm · porch shelf",
                                ),
                                SlotRowContent(
                                    id = "open-sat-6",
                                    dayLabel = "Sat",
                                    dateLabel = "6",
                                    state = SlotRowState.Open,
                                    title = "Open · dinner for 4",
                                    subtitle = "Drop off by 5:30 pm · porch shelf",
                                ),
                                SlotRowContent(
                                    id = "open-mon-8",
                                    dayLabel = "Mon",
                                    dateLabel = "8",
                                    state = SlotRowState.Open,
                                    title = "Open · dinner for 4",
                                    subtitle = "Drop off by 5:30 pm · porch shelf",
                                ),
                            ),
                    ),
                    SlotSection(
                        id = "covered",
                        overline = "Already on the train",
                        rows =
                            listOf(
                                SlotRowContent(
                                    id = "covered-tue-2",
                                    dayLabel = "Tue",
                                    dateLabel = "2",
                                    state = SlotRowState.Covered,
                                    author =
                                        SlotRowAuthor(
                                            initials = "SK",
                                            displayName = "Sam Kowalski",
                                            tone = ContributorTone.Warning,
                                        ),
                                    title = "Lentil soup + cornbread",
                                    subtitle = "drop 5pm",
                                ),
                                SlotRowContent(
                                    id = "covered-wed-3",
                                    dayLabel = "Wed",
                                    dateLabel = "3",
                                    state = SlotRowState.Covered,
                                    author =
                                        SlotRowAuthor(
                                            initials = "TP",
                                            displayName = "Tomás Pérez",
                                            tone = ContributorTone.Primary,
                                        ),
                                    title = "Chicken & rice (mild)",
                                ),
                                SlotRowContent(
                                    id = "covered-fri-5",
                                    dayLabel = "Fri",
                                    dateLabel = "5",
                                    state = SlotRowState.Covered,
                                    author =
                                        SlotRowAuthor(
                                            initials = "MO",
                                            displayName = "Maya O.",
                                            tone = ContributorTone.Business,
                                        ),
                                    title = "Veg lasagna + salad",
                                ),
                            ),
                    ),
                ),
            hostedBy =
                HostedByFooter(
                    organizerInitials = "DK",
                    organizerDisplayName = "Diane K.",
                    neighborHint = "neighbor at 422 Elm",
                ),
            dock = SupportTrainDock.SignUp(label = "Sign up for a slot"),
            celebrationBanner = null,
        )
    }

    /**
     * FRAME 2 · FULLY COVERED — 21 / 21 slots, viewer signed up for
     * Thu Dec 4 (`myDayIdx == 10` in the JSX).
     */
    val fullyCovered: SupportTrainDetailContent by lazy {
        val base = baseStartDate(year = 2025, month = 10, day = 24)
        SupportTrainDetailContent(
            trainId = "sample-fully-covered",
            recipient = reyesRecipient,
            typeDates =
                TypeDatesCardContent(
                    kind = SupportTrainKind.Meals,
                    title = "Meal train · dinner for 4",
                    dateRange = "Mon Nov 24 → Sun Dec 22",
                    daysLeft = 20,
                    slotsFilled = 21,
                    slotsTotal = 21,
                    contributors = sampleContributors,
                    extraCount = 17,
                ),
            calendarDays = fullyCoveredCalendar(base = base, myDayIdx = 10),
            sections =
                listOf(
                    SlotSection(
                        id = "mine",
                        overline = "Your commitment",
                        rows =
                            listOf(
                                SlotRowContent(
                                    id = "mine-thu-4",
                                    dayLabel = "Thu",
                                    dateLabel = "4",
                                    state = SlotRowState.Covered,
                                    author =
                                        SlotRowAuthor(
                                            initials = "YO",
                                            displayName = "You",
                                            tone = ContributorTone.Primary,
                                        ),
                                    title = "Pad thai (no peanuts) + spring rolls",
                                    subtitle = "6:00 pm",
                                    mine = true,
                                ),
                            ),
                    ),
                    SlotSection(
                        id = "nextup",
                        overline = "Next up",
                        actionLabel = "See all 21",
                        rows =
                            listOf(
                                SlotRowContent(
                                    id = "nextup-tue-2",
                                    dayLabel = "Tue",
                                    dateLabel = "2",
                                    state = SlotRowState.Covered,
                                    author =
                                        SlotRowAuthor(
                                            initials = "SK",
                                            displayName = "Sam Kowalski",
                                            tone = ContributorTone.Warning,
                                        ),
                                    title = "Lentil soup + cornbread",
                                    subtitle = "tonight 5pm",
                                ),
                                SlotRowContent(
                                    id = "nextup-wed-3",
                                    dayLabel = "Wed",
                                    dateLabel = "3",
                                    state = SlotRowState.Covered,
                                    author =
                                        SlotRowAuthor(
                                            initials = "TP",
                                            displayName = "Tomás Pérez",
                                            tone = ContributorTone.Primary,
                                        ),
                                    title = "Chicken & rice (mild)",
                                ),
                            ),
                    ),
                ),
            hostedBy =
                HostedByFooter(
                    organizerInitials = "DK",
                    organizerDisplayName = "Diane K.",
                    neighborHint = "neighbor at 422 Elm",
                ),
            dock = SupportTrainDock.SendCardAndBackup,
            celebrationBanner =
                CelebrationBanner(
                    title = "Every slot is covered",
                    body =
                        "Elm Park showed up — all 21 dinners are spoken for. " +
                            "Sign up as backup in case someone can't make it.",
                ),
        )
    }

    private val reyesRecipient =
        RecipientCardContent(
            initials = "MR",
            householdName = "The Reyes household",
            identityTag = RecipientIdentityTag.Home,
            verified = true,
            address = "418 Elm St",
            proximity = "2 blocks from you",
            quote =
                "Baby Mateo arrived Nov 18 — we're home and overwhelmed in the best way. " +
                    "Soft foods, no peanuts, no fish. Thank you, Elm Park.",
            quoteAttribution = "Ana & Jordan",
        )

    private val sampleContributors =
        listOf(
            ContributorBubble(id = "sk", initials = "SK", tone = ContributorTone.Warning),
            ContributorBubble(id = "tp", initials = "TP", tone = ContributorTone.Primary),
            ContributorBubble(id = "mo", initials = "MO", tone = ContributorTone.Business),
            ContributorBubble(id = "rj", initials = "RJ", tone = ContributorTone.Success),
        )

    /**
     * Cell-state vocabulary mirroring `support-train-frames.jsx`:
     *   R1: all past (Nov week 1)
     *   R2: past (Dec 1) / today (Dec 2) / filled / open / filled / open / filled
     *   R3: open / filled / open / filled / open / open / filled
     *   R4: all open
     */
    private val populatedStates =
        listOf(
            SlotCalendarState.Past, SlotCalendarState.Past, SlotCalendarState.Past,
            SlotCalendarState.Past, SlotCalendarState.Past, SlotCalendarState.Past, SlotCalendarState.Past,
            SlotCalendarState.Past, SlotCalendarState.Today, SlotCalendarState.Filled,
            SlotCalendarState.Open, SlotCalendarState.Filled, SlotCalendarState.Open, SlotCalendarState.Filled,
            SlotCalendarState.Open, SlotCalendarState.Filled, SlotCalendarState.Open,
            SlotCalendarState.Filled, SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Filled,
            SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Open,
            SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Open,
        )

    private fun populatedCalendar(base: Date): List<SlotCalendarDay> {
        val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        return (0 until 28).map { idx ->
            calendar.time = base
            calendar.add(Calendar.DAY_OF_MONTH, idx)
            val date = calendar.time
            SlotCalendarDay(
                id = "pop-$idx",
                date = date,
                dayNumber = calendar.get(Calendar.DAY_OF_MONTH),
                state = populatedStates[idx],
            )
        }
    }

    /**
     * Fully-covered grid: every open cell becomes filled, the viewer's
     * slot at [myDayIdx] becomes `Mine`. Mirrors the JSX
     * `if (fullCover && state === 'open') state = 'filled'` rule.
     */
    private fun fullyCoveredCalendar(
        base: Date,
        myDayIdx: Int,
    ): List<SlotCalendarDay> {
        val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        return (0 until 28).map { idx ->
            calendar.time = base
            calendar.add(Calendar.DAY_OF_MONTH, idx)
            val date = calendar.time
            var resolved = populatedStates[idx]
            if (resolved == SlotCalendarState.Open) {
                resolved = SlotCalendarState.Filled
            }
            if (idx == myDayIdx) {
                resolved = SlotCalendarState.Mine
            }
            SlotCalendarDay(
                id = "full-$idx",
                date = date,
                dayNumber = calendar.get(Calendar.DAY_OF_MONTH),
                state = resolved,
            )
        }
    }

    private fun baseStartDate(
        year: Int,
        month: Int,
        day: Int,
    ): Date {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.clear()
        cal.set(year, month, day, 0, 0, 0)
        return cal.time
    }
}
