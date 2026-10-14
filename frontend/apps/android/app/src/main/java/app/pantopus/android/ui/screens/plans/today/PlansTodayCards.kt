@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.plans.today

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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.plans.accentLight
import app.pantopus.android.ui.screens.plans.components.PlanKindLeading
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.openDirections
import app.pantopus.android.ui.screens.plans.map.planH4
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** What the Today cards open. */
data class PlansTodayActions(
    val onOpenPlan: (String) -> Unit,
    val onOpenChat: (roomId: String, title: String, planId: String) -> Unit,
    val onHostAgain: (kind: String, planId: String) -> Unit,
)

/**
 * Plans on Today (boards A1, A2, A5), above the weather. Nothing shows while the `plans` flag is off or there is
 * no plan today and nothing to ask about.
 */
@Composable
fun PlansTodayCards(
    actions: PlansTodayActions,
    modifier: Modifier = Modifier,
    viewModel: PlansTodayViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(ui.notice) {
        ui.notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    if (!ui.on) return
    val cards = ui.going.size + ui.hosting.size + ui.howWasIt.size + ui.hostAgain.size
    if (cards == 0) return
    Column(modifier = modifier.fillMaxWidth().testTag("plansToday"), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        ui.hosting.forEach { card -> HostingTodayCard(ui.details[card.id] ?: card, actions) }
        ui.going.forEach { card ->
            val plan = ui.details[card.id] ?: card
            GoingTodayCard(plan, working = plan.id in ui.working, onMyWay = { viewModel.onMyWay(plan) }, actions = actions)
        }
        ui.howWasIt.forEach { plan ->
            HowWasItCard(
                plan,
                answered = ui.answered[plan.id],
                working = plan.id in ui.working,
                named = ui.howWasIt.size > 1,
                onAnswer = { viewModel.feedback(plan, it) },
                onDone = { viewModel.dismiss(plan) },
            )
        }
        ui.hostAgain.forEach { plan ->
            HostAgainCard(
                plan,
                named = ui.hostAgain.size > 1,
                onNotNow = { viewModel.dismiss(plan) },
                onHostAgain = { actions.onHostAgain(plan.kind, plan.id) },
            )
        }
    }
    ToastHost(controller = toast)
}

/**
 * "Seahawks game at Sam's" (A1): the game or title, and the host's name for a plan at home. Never the venue:
 * Today carries the area only (brief section 6), as on iOS.
 */
private fun todayTitle(plan: PlanDto): String {
    val short = plan.details?.game?.label?.let { "$it game" } ?: plan.title
    val host = plan.host?.displayName?.takeIf { plan.placeKind == "home" }?.let { "${PlanFormat.firstName(it)}'s" }
    return if (host != null) "$short at $host" else short
}

/** A1 and A2: a card whose border carries the type's color. */
private fun Modifier.todayCard(kind: PlanKind?): Modifier =
    this
        .planCard()
        .then(
            kind?.let {
                Modifier.border(1.dp, lerp(PantopusColors.appBorder, it.accentLight, 0.4f), RoundedCornerShape(Radii.xl2))
            } ?: Modifier,
        )

@Composable
private fun TodayCardHeader(
    plan: PlanDto,
    overline: String,
    title: String,
    caption: String,
    onOpen: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onOpen).semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanKindLeading(plan.planKind)
        Column(modifier = Modifier.weight(1f)) {
            PlanOverline(overline)
            Text(text = title, style = planH4, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
            Text(text = caption, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
    }
}

private val clock = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

private fun startClock(plan: PlanDto): String? = PlanFormat.instant(plan.startsAt)?.atZone(PlanFormat.zone(plan.timezone))?.format(clock)

/** A1: going today. */
@Composable
private fun GoingTodayCard(
    plan: PlanDto,
    working: Boolean,
    onMyWay: () -> Unit,
    actions: PlansTodayActions,
) {
    val context = LocalContext.current
    val kind = plan.planKind
    val title = todayTitle(plan)
    val start = if (plan.planState == PlanState.LIVE) "Happening now" else startClock(plan)
    val caption = listOfNotNull(start, PlanFormat.distance(plan.distanceBand), "${plan.goingCount} going").joinToString(" · ")
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .todayCard(kind)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        TodayCardHeader(plan, "Going today", title, caption) { actions.onOpenPlan(plan.id) }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PlanTonalButton(
                title = "Directions",
                icon = PantopusIcon.Navigation,
                onClick = { context.openDirections(plan) },
                height = 44.dp,
                modifier = Modifier.weight(1f),
                enabled = plan.place != null,
            )
            val onTheWay = plan.myRequest?.onMyWay == true
            PrimaryButton(
                title = if (onTheWay) "On the way" else "On my way",
                onClick = onMyWay,
                isLoading = working,
                isEnabled = !onTheWay,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/** A2: hosting today. */
@Composable
private fun HostingTodayCard(
    plan: PlanDto,
    actions: PlansTodayActions,
) {
    val kind = plan.planKind
    val requests = plan.requestsCount ?: 0
    val coming = plan.spots - plan.spotsLeft
    val caption =
        listOfNotNull(
            "$coming coming",
            when {
                plan.spotsLeft <= 0 -> "full"
                plan.spotsLeft == 1 -> "1 spot left"
                else -> "${plan.spotsLeft} spots left"
            },
            if (requests > 0) (if (requests == 1) "1 request" else "$requests requests") else null,
        ).joinToString(" · ")
    // "Seahawks game · 1:25 PM", or "· now" once it has started (iOS parity).
    val start = if (plan.planState == PlanState.LIVE) "now" else startClock(plan)
    val title = listOfNotNull(plan.details?.game?.label?.let { "$it game" } ?: plan.title, start).joinToString(" · ")
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .todayCard(kind)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        TodayCardHeader(plan, "You're hosting today", title, caption) { actions.onOpenPlan(plan.id) }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PlanTonalButton(
                title = "Message guests",
                onClick = { plan.chatRoomId?.let { actions.onOpenChat(it, plan.title, plan.id) } },
                height = 44.dp,
                enabled = plan.chatRoomId != null,
                modifier = Modifier.weight(1f),
            )
            PrimaryButton(title = "Open plan", onClick = { actions.onOpenPlan(plan.id) }, modifier = Modifier.weight(1f))
        }
    }
}

/** A5 for guests: "How was Sunday's watch party?" (only Pantopus sees the answer). */
@Composable
private fun HowWasItCard(
    plan: PlanDto,
    answered: String?,
    working: Boolean,
    named: Boolean,
    onAnswer: (String) -> Unit,
    onDone: () -> Unit,
) {
    val kind = plan.planKind ?: return
    val day = recentDay(plan)
    Column(modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PlanKindLeading(kind)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "How was ${day?.let { "$it's " } ?: "the "}${kind.noun}?",
                    style = planH4,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                // Two cards about the same day and kind: each names its plan.
                if (named) {
                    Text(
                        text = plan.title,
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                }
                Text(text = "Only Pantopus sees your answer.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
        }
        if (answered != null) {
            Text(
                text =
                    if (answered == "not_right") {
                        "Thanks for telling us. Someone from Pantopus will look at it."
                    } else {
                        "Thanks. Glad you went."
                    },
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            GhostButton(title = "Done", onClick = onDone)
            return@Column
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            GhostButton(title = "Great", onClick = { onAnswer("great") }, isEnabled = !working)
            GhostButton(title = "It was OK", onClick = { onAnswer("ok") }, isEnabled = !working)
            GhostButton(title = "Something wasn't right", onClick = { onAnswer("not_right") }, isEnabled = !working)
        }
    }
}

/** A5 for hosts: "Host your coffee walk again?" */
@Composable
private fun HostAgainCard(
    plan: PlanDto,
    named: Boolean,
    onNotNow: () -> Unit,
    onHostAgain: () -> Unit,
) {
    val kind = plan.planKind ?: return
    val came = plan.goingCount
    // "came today", "came yesterday", "came last Sunday" (iOS words it the same way).
    val day =
        when (val recent = recentDay(plan)) {
            null -> ""
            TODAY, YESTERDAY -> " $recent"
            else -> " last $recent"
        }
    val caption =
        listOfNotNull(
            if (came > 0) "${if (came == 1) "1 person" else "$came people"} came$day." else null,
            "Same time next week?",
        ).joinToString(" ")
    Column(modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PlanKindLeading(kind)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Host your ${kind.noun} again?",
                    style = planH4,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                // Two plans of the same kind: each card names its plan.
                if (named) {
                    Text(
                        text = plan.title,
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                }
                Text(text = caption, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PlanTonalButton(title = "Not now", onClick = onNotNow, height = 44.dp, modifier = Modifier.weight(1f))
            PrimaryButton(title = "Host again", onClick = onHostAgain, modifier = Modifier.weight(1f))
        }
    }
}

private const val TODAY = "today"
private const val YESTERDAY = "yesterday"

/** When a recent plan was, in its own time zone: "today", "yesterday", or its weekday ("Sunday"). */
private fun recentDay(plan: PlanDto): String? {
    val zone = PlanFormat.zone(plan.timezone)
    val day = PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDate() ?: return null
    val today = LocalDate.now(zone)
    return when (day) {
        today -> TODAY
        today.minusDays(1) -> YESTERDAY
        else -> day.format(DateTimeFormatter.ofPattern("EEEE", Locale.US))
    }
}
