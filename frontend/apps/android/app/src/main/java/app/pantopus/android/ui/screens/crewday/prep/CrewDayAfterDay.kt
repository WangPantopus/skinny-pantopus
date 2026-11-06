@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.crewday.prep

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.crewday.CrewDayCrewViewDto
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** The route opens from 6 PM the evening before through the day (01-spec rule 7), and while the day is running. */
fun CrewDayCrewViewDto.routeIsOpen(now: Instant = Instant.now()): Boolean {
    if (status == "in_progress") return true
    if (status != "open") return false
    val local = now.atZone(CrewDayFormat.zone(timezone))
    val today = local.toLocalDate()
    val days = dates.mapNotNull(CrewDayFormat::date).ifEmpty { listOfNotNull(CrewDayFormat.date(serviceDate)) }
    return days.any { it == today || (it == today.plusDays(1) && local.hour >= EVENING_HOUR) }
}

private val ENDED = setOf("done", "paid", "payment_failed", "cancelled", "refunded")

/** After the day: the day is done, or it ran and every home on it has an end. */
fun CrewDayCrewViewDto.isAfterTheDay(): Boolean =
    status == "done" || (status == "in_progress" && bookings.isNotEmpty() && bookings.all { it.status in ENDED })

private const val EVENING_HOUR = 18

/** "Today's route · 6 homes" with Open the route, from the evening before. */
@Composable
fun CrewDayRouteCard(
    view: CrewDayCrewViewDto,
    onOpenRoute: () -> Unit,
) {
    val today = CrewDayFormat.date(view.serviceDate) == LocalDate.now(CrewDayFormat.zone(view.timezone))
    val homes = view.bookings.count { it.status !in ENDED || it.status == "done" }
    Column(
        modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4).testTag("crewDayPrepRouteCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "${if (today) "Today's route" else "Tomorrow's route"} · ${if (homes == 1) "1 home" else "$homes homes"}",
            style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = "Addresses, first names and access notes show from 6 PM the evening before through the day.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(title = "Open the route", onClick = onOpenRoute, modifier = Modifier.fillMaxWidth().testTag("crewDayPrepRoute"))
    }
}

/**
 * After the day (screen 19, board `AfterDay`): "All 6 homes done", the date, what was charged, what is scheduled and
 * what is paused with Pantopus support, the share the crew receives, See invoices, the problem rows, and Offer a
 * Crew Day here again (the button sits in the page's footer).
 */
@Composable
fun CrewDayAfterDay(
    view: CrewDayCrewViewDto,
    onSeeInvoices: () -> Unit,
) {
    val money = view.money
    val zone = CrewDayFormat.zone(view.timezone)
    val served = view.bookings.filter { it.status != "cancelled" }
    val done = served.count { it.status in setOf("done", "paid", "payment_failed") }
    val charged = served.count { it.chargeState in setOf("charged", "partially_refunded") }
    val scheduled = served.filter { it.chargeState == "scheduled" }
    val paused = served.filter { it.chargeState == "paused" }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s5), modifier = Modifier.testTag("crewDayAfter")) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.success),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    PantopusIcon.Check,
                    contentDescription = null,
                    size = 28.dp,
                    strokeWidth = 2.6f,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text(
                text = if (done == served.size) "All ${homes(done)} done" else "$done of ${homes(served.size)} done",
                style = PantopusTextStyle.h2.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() }.testTag("crewDayAfterTitle"),
            )
            Text(
                text = CrewDayFormat.shortDate(view.serviceDate).orEmpty(),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlanOverline("Money")
            Column(
                modifier = Modifier.fillMaxWidth().planCard().padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Column {
                    MoneyRow(
                        label = "Charged",
                        line = homes(charged),
                        amount = money.chargedCents,
                        dot = PantopusColors.success,
                        first = true,
                        tag = "crewDayAfterCharged",
                    )
                    if (scheduled.isNotEmpty()) {
                        val next =
                            CrewDayFormat.instant(money.nextChargeAt)
                                ?: scheduled.mapNotNull { CrewDayFormat.instant(it.chargeDueAt) }.minOrNull()
                        MoneyRow(
                            label = "Scheduled",
                            line = next?.let { chargesAt(it, zone) } ?: homes(scheduled.size),
                            amount = money.scheduledCents,
                            dot = PantopusColors.primary600,
                            tag = "crewDayAfterScheduled",
                        )
                    }
                    if (paused.isNotEmpty()) {
                        MoneyRow(
                            label = "Paused",
                            line = "${if (paused.size == 1) "1 problem" else "${paused.size} problems"} with Pantopus support",
                            amount = money.pausedCents,
                            dot = PantopusColors.warningStrong,
                            tag = "crewDayAfterPaused",
                        )
                    }
                }
                Text(
                    text = "You receive ${money.feeRate?.let { "${trim(100 - it)}%" } ?: "your share"} of each charge, 48 hours after it.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                PlanTonalButton(
                    title = "See invoices",
                    onClick = onSeeInvoices,
                    icon = PantopusIcon.ReceiptText,
                    height = 44.dp,
                    modifier = Modifier.fillMaxWidth().testTag("crewDayAfterInvoices"),
                )
            }
        }
        if (paused.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("With Pantopus support")
                paused.forEach { ProblemRow(it) }
            }
        }
        Text(
            text = "Offering it again copies this day's street, prices and notes. You can invite the homes you served.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun homes(count: Int): String = if (count == 1) "1 home" else "$count homes"

/** 90.0 → "90", 87.5 → "87.5". */
private fun trim(value: Double): String = if (value % 1.0 == 0.0) value.toInt().toString() else value.toString()

/** "Charges tomorrow at 11:42 AM" or "Charges Thu, Nov 19 at 11:42 AM". */
private fun chargesAt(
    at: Instant,
    zone: ZoneId,
): String {
    val day = at.atZone(zone).toLocalDate()
    val today = LocalDate.now(zone)
    val whenWord =
        when (day) {
            today -> "today"
            today.plusDays(1) -> "tomorrow"
            else -> CrewDayFormat.shortDate(day).orEmpty()
        }
    return "Charges $whenWord at ${CrewDayFormat.clock(at, zone)}"
}

@Composable
private fun MoneyRow(
    label: String,
    line: String,
    amount: Int,
    dot: Color,
    tag: String,
    first: Boolean = false,
) {
    PlanOptionRow(first = first, modifier = Modifier.testTag(tag).semantics(mergeDescendants = true) {}) {
        Box(modifier = Modifier.padding(top = 6.dp).size(10.dp).clip(CircleShape).background(dot).align(Alignment.Top))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = label, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            Text(text = line, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        Text(
            text = CrewDayFormat.price(amount),
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.align(Alignment.Top),
        )
    }
}

/** "Home 3 · back gutters" / "Pantopus support is on it. This home's charge waits." */
@Composable
private fun ProblemRow(home: CrewDayHomeDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(20.dp))
                .padding(14.dp)
                .semantics(mergeDescendants = true) {}
                .testTag("crewDayAfterProblem_${home.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanIconTile(PantopusIcon.LifeBuoy, PantopusColors.warningLight, PantopusColors.warning)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = listOfNotNull(home.label ?: "A home", home.problem?.note?.lineSequence()?.firstOrNull()).joinToString(" · "),
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = "Pantopus support is on it. This home's charge waits.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}
