@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.crewday.today

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.crewday.CrewDayCardDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.map.planH4
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.ZoneId

/** What Today's Crew Day cards open. */
data class CrewDayTodayActions(
    /** A booking's page (screen 5). */
    val onOpenBooking: (bookingId: String) -> Unit,
    /** An open day's invitation (screen 1), by its share code. */
    val onOpenInvitation: (code: String) -> Unit,
    /** The conversation with the crew's business. */
    val onMessageCrew: (userId: String, name: String) -> Unit,
)

/**
 * Crew Day on Today (screen 9), right above the Plans cards: the person's booking while it matters, and "Coming to
 * your street". Nothing shows while the `crew_day` key is off or there is no card.
 */
@Composable
fun CrewDayTodayCards(
    actions: CrewDayTodayActions,
    modifier: Modifier = Modifier,
    viewModel: CrewDayTodayViewModel = hiltViewModel(),
) {
    if (!LaunchFeatures.crewDay) return
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(ui.notice) {
        ui.notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    if (ui.mine.isEmpty() && ui.nearby.isEmpty()) return
    Column(modifier = modifier.fillMaxWidth().testTag("crewDayToday"), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        ui.mine.forEach { card ->
            BookingTodayCard(
                card = card,
                working = card.key in ui.working,
                gateTold = card.key in ui.gateTold,
                onOpen = { card.bookingId?.let(actions.onOpenBooking) },
                onMessageCrew =
                    card.crew?.let { crew ->
                        crew.businessUserId?.let { id -> { actions.onMessageCrew(id, crew.name ?: "The crew") } }
                    },
                onGateReady = { viewModel.gateReady(card) },
                onLooksGood = { viewModel.looksGood(card) },
            )
        }
        ui.nearby.forEach { card ->
            NearbyTodayCard(
                card = card,
                onSeePrice = { card.code?.let(actions.onOpenInvitation) },
                onNotForMe = { viewModel.notForMe(card) },
            )
        }
    }
    ToastHost(controller = toast)
}

/** The Plans cards' shape with a thin home-green border. */
private fun Modifier.crewDayCard(): Modifier =
    this
        .planCard()
        .border(1.dp, lerp(PantopusColors.appBorder, PantopusColors.home, 0.4f), RoundedCornerShape(Radii.xl2))

@Composable
private fun CardHeader(
    overline: String,
    title: String,
    line: String,
    onOpen: (() -> Unit)?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(if (onOpen != null) Modifier.clickable(role = Role.Button, onClick = onOpen) else Modifier)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanIconTile(PantopusIcon.CalendarCheck, PantopusColors.homeBg, PantopusColors.home)
        Column(modifier = Modifier.weight(1f)) {
            PlanOverline(overline)
            Text(text = title, style = planH4, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
            Text(text = line, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
    }
}

/** "Your booking" (board `Today`): the overline, the line and the buttons follow what the booking needs now. */
@Composable
private fun BookingTodayCard(
    card: CrewDayCardDto,
    working: Boolean,
    gateTold: Boolean,
    onOpen: () -> Unit,
    onMessageCrew: (() -> Unit)?,
    onGateReady: () -> Unit,
    onLooksGood: () -> Unit,
) {
    val state = card.todayState.takeIf { card.problemStatus != "open" }
    Column(
        modifier = Modifier.fillMaxWidth().crewDayCard().padding(Spacing.s4).testTag("crewDayTodayBooking"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        CardHeader(overline = bookingOverline(card), title = card.title, line = bookingLine(card, state), onOpen = onOpen)
        when (state) {
            "price_ready" -> CardButton("See your price", onOpen, tag = "crewDayTodayOpen")
            "new_dates" -> CardButton("Pick a date", onOpen, tag = "crewDayTodayOpen")
            "on_the_way" ->
                if (gateTold || card.gateReadyAt != null) {
                    Text(text = "We told the crew the gate is ready.", style = PantopusTextStyle.small, color = PantopusColors.appText)
                    CardButton("Open", onOpen, tonal = true, tag = "crewDayTodayOpen")
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (onMessageCrew != null) {
                            CardButton(
                                "Message the crew",
                                onMessageCrew,
                                tonal = true,
                                tag = "crewDayTodayMessage",
                                modifier = Modifier.weight(1f),
                            )
                        } else {
                            CardButton("Open", onOpen, tonal = true, tag = "crewDayTodayOpen", modifier = Modifier.weight(1f))
                        }
                        CardButton(
                            "Gate is ready",
                            onGateReady,
                            loading = working,
                            tag = "crewDayTodayGateReady",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            "done" -> CardButton("Everything looks good", onLooksGood, loading = working, tag = "crewDayTodayLooksGood")
            else -> CardButton("Open", onOpen, tag = "crewDayTodayOpen")
        }
    }
}

/** The board's small card buttons (44 dp, the app's touch-target floor): the primary blue one or the sunken tonal one. */
@Composable
private fun CardButton(
    title: String,
    onClick: () -> Unit,
    tag: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    tonal: Boolean = false,
    loading: Boolean = false,
) {
    if (tonal) {
        PlanTonalButton(title = title, onClick = onClick, height = 44.dp, loading = loading, modifier = modifier.testTag(tag))
    } else {
        PrimaryButton(title = title, onClick = onClick, isLoading = loading, modifier = modifier.testTag(tag))
    }
}

/**
 * The card's line (board `Today`): "Tue, Nov 17 · $260 · approve to book", "Today · expected 10–11 AM", "Charges $180
 * tomorrow at 11:42 AM", "Rain moved it · pick a new date", else "Tue, Nov 17 · 9 AM–1 PM · Booked".
 */
private fun bookingLine(
    card: CrewDayCardDto,
    state: String?,
): String {
    val zone = CrewDayFormat.zone(card.timezone)
    return when (state) {
        "price_ready" ->
            listOfNotNull(CrewDayFormat.shortDate(card.serviceDate), card.priceCents?.let(CrewDayFormat::price), "approve to book")
                .joinToString(" · ")
        "on_the_way" -> "Today · " + (CrewDayFormat.eta(card.eta?.start, card.eta?.end, zone)?.let { "expected $it" } ?: "on the way")
        "new_dates" -> "Rain moved it · pick a new date"
        "done" -> chargeLine(card, zone) ?: defaultLine(card)
        else -> defaultLine(card)
    }
}

private fun defaultLine(card: CrewDayCardDto): String =
    listOfNotNull(
        CrewDayFormat.shortDate(card.serviceDate),
        CrewDayFormat.window(card.windowStart, card.windowEnd),
        statusWord(card.status),
    ).joinToString(" · ")

/** "Charges $180 tomorrow at 11:42 AM" while the charge waits for its time. */
private fun chargeLine(
    card: CrewDayCardDto,
    zone: ZoneId,
): String? {
    val charge = card.charge?.takeIf { it.state == "scheduled" } ?: return null
    val due = CrewDayFormat.instant(charge.dueAt) ?: return null
    val day = due.atZone(zone).toLocalDate()
    val today = LocalDate.now(zone)
    val whenWord =
        when (day) {
            today -> "today"
            today.plusDays(1) -> "tomorrow"
            else -> CrewDayFormat.shortDate(day).orEmpty()
        }
    return "Charges ${CrewDayFormat.price(charge.amountCents ?: card.priceCents)} $whenWord at ${CrewDayFormat.clock(due, zone)}"
}

/** "Coming to your street": an open day near the person's home. */
@Composable
private fun NearbyTodayCard(
    card: CrewDayCardDto,
    onSeePrice: () -> Unit,
    onNotForMe: () -> Unit,
) {
    val line =
        listOfNotNull(
            CrewDayFormat.shortDate(card.serviceDate),
            card.priceFromCents?.let { "from ${CrewDayFormat.price(it)}" },
        ).joinToString(" · ")
    Column(
        modifier = Modifier.fillMaxWidth().crewDayCard().padding(Spacing.s4).testTag("crewDayTodayNearby"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        CardHeader(overline = "Coming to your street", title = card.title, line = line, onOpen = onSeePrice)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CardButton("Not for me", onNotForMe, tonal = true, tag = "crewDayTodayNotForMe", modifier = Modifier.weight(1f))
            CardButton("See my price", onSeePrice, tag = "crewDayTodaySeePrice", modifier = Modifier.weight(1f))
        }
    }
}

/** The card's overline, by what the booking needs now (the server's `today_state`). */
private fun bookingOverline(card: CrewDayCardDto): String =
    if (card.problemStatus == "open") {
        "Pantopus support has this"
    } else {
        when (card.todayState ?: card.status) {
            "price_ready", "price_offered" -> "Your price is ready"
            "new_dates" -> "Pick a new date"
            "payment_failed" -> "Your card didn't go through"
            "done" -> "Done: check the photos"
            "on_the_way" -> "Crew on the way"
            "today" -> "Crew Day today"
            "tomorrow" -> "Crew Day tomorrow"
            "price_pending" -> "The crew is checking your price"
            "paid" -> "Paid"
            else -> "Your Crew Day"
        }
    }

/** Honest status words (01-spec rule 10): "Requested" isn't "Booked". */
private fun statusWord(status: String?): String? =
    when (status) {
        "price_pending" -> "Requested"
        "price_offered" -> "Price ready"
        "booked" -> "Booked"
        "new_dates" -> "Pick a new date"
        "on_the_way" -> "On the way"
        "done" -> "Done"
        "paid" -> "Paid"
        "payment_failed" -> "Card didn't go through"
        "refunded" -> "Refunded"
        "cancelled", "declined" -> "Cancelled"
        else -> null
    }
