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
import java.time.temporal.ChronoUnit

/** What Today's Crew Day cards open. */
data class CrewDayTodayActions(
    /** A booking's page (screen 5). */
    val onOpenBooking: (bookingId: String) -> Unit,
    /** An open day's invitation (screen 1), by its share code. */
    val onOpenInvitation: (code: String) -> Unit,
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
                working = card.id in ui.working,
                gateTold = card.id in ui.gateTold,
                onOpen = { card.bookingId?.let(actions.onOpenBooking) },
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

/** "Your booking": the overline and the buttons follow the booking's state. */
@Composable
private fun BookingTodayCard(
    card: CrewDayCardDto,
    working: Boolean,
    gateTold: Boolean,
    onOpen: () -> Unit,
    onGateReady: () -> Unit,
    onLooksGood: () -> Unit,
) {
    val line =
        listOfNotNull(
            CrewDayFormat.shortDate(card.serviceDate),
            CrewDayFormat.window(card.windowStart, card.windowEnd),
            statusWord(card.status),
        ).joinToString(" · ")
    Column(
        modifier = Modifier.fillMaxWidth().crewDayCard().padding(Spacing.s4).testTag("crewDayTodayBooking"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        CardHeader(overline = bookingOverline(card), title = card.title, line = line, onOpen = onOpen)
        when (card.status) {
            "on_the_way" ->
                if (gateTold || card.gateReadyAt != null) {
                    Text(
                        text = "We told the crew the gate is ready.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appText,
                    )
                    PlanTonalButton(title = "Open", onClick = onOpen, height = 44.dp, modifier = Modifier.testTag("crewDayTodayOpen"))
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PlanTonalButton(
                            title = "Open",
                            onClick = onOpen,
                            height = 44.dp,
                            modifier = Modifier.weight(1f).testTag("crewDayTodayOpen"),
                        )
                        PrimaryButton(
                            title = "Gate is ready",
                            onClick = onGateReady,
                            isLoading = working,
                            modifier = Modifier.weight(1f).testTag("crewDayTodayGateReady"),
                        )
                    }
                }
            "done" ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PlanTonalButton(
                        title = "Open",
                        onClick = onOpen,
                        height = 44.dp,
                        modifier = Modifier.weight(1f).testTag("crewDayTodayOpen"),
                    )
                    PrimaryButton(
                        title = "Everything looks good",
                        onClick = onLooksGood,
                        isLoading = working,
                        modifier = Modifier.weight(1f).testTag("crewDayTodayLooksGood"),
                    )
                }
            else -> PrimaryButton(title = "Open", onClick = onOpen, modifier = Modifier.fillMaxWidth().testTag("crewDayTodayOpen"))
        }
    }
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
            PlanTonalButton(
                title = "Not for me",
                onClick = onNotForMe,
                height = 44.dp,
                modifier = Modifier.weight(1f).testTag("crewDayTodayNotForMe"),
            )
            PrimaryButton(title = "See my price", onClick = onSeePrice, modifier = Modifier.weight(1f).testTag("crewDayTodaySeePrice"))
        }
    }
}

/** The card's overline, by what the booking needs now. */
private fun bookingOverline(card: CrewDayCardDto): String =
    when (card.status) {
        "on_the_way" -> "Crew on the way"
        "done" -> "Done: check the photos"
        "new_dates" -> "Pick a new date"
        "price_offered" -> "Your price is ready"
        "price_pending" -> "The crew is checking your price"
        "payment_failed" -> "Your card didn't go through"
        "paid" -> "Paid"
        "cancelled" -> "Cancelled"
        else ->
            when (daysUntil(card)) {
                0L -> "Crew Day today"
                1L -> "Crew Day tomorrow"
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

private fun daysUntil(card: CrewDayCardDto): Long? {
    val date = CrewDayFormat.date(card.serviceDate) ?: return null
    return ChronoUnit.DAYS.between(LocalDate.now(CrewDayFormat.zone(card.timezone)), date)
}
