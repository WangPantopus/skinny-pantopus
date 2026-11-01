@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotGovernments
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.ui.screens.place.components.placeSurface
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** The agenda shows its soonest five rows; "Show all N" opens the rest. */
private const val AGENDA_FIRST_ROWS = 5

/** What the agenda's rows open: each is the item's existing destination; null leaves the action out. */
data class AgendaActions(
    val onEditPickup: (() -> Unit)? = null,
    val onOpenTask: ((taskId: String) -> Unit)? = null,
    val onOpenPlan: ((planId: String) -> Unit)? = null,
    val onOpenBallot: (() -> Unit)? = null,
    val onOpenGovernments: ((BallotGovernments) -> Unit)? = null,
)

/**
 * "Coming up at home" (TPR brief 7.2): the next seven days at the address, soonest first, each row with its date,
 * what it is, when, and whose it is; a tap opens its details, source and actions in place. The two-week calendar
 * (its days, every date, the pickup schedule) is the section's second view: "Calendar" / "Agenda".
 */
@Composable
@Suppress("LongParameterList")
fun ComingUpAtHome(
    items: List<AgendaItem>,
    now: ZonedDateTime,
    actions: AgendaActions,
    calendarOpen: Boolean,
    onToggleCalendar: (() -> Unit)?,
    modifier: Modifier = Modifier,
    /** Shown where the agenda would be when the calendar couldn't be read (its fallback card). */
    unavailable: (@Composable () -> Unit)? = null,
    calendar: @Composable () -> Unit = {},
    plans: (@Composable () -> Unit)? = null,
) {
    val today = now.toLocalDate()
    val window = TodayAgenda.window(items, today)
    Column(modifier = modifier.fillMaxWidth().testTag("today.agenda")) {
        AgendaHead(calendarOpen, onToggleCalendar)
        when {
            calendarOpen -> calendar()
            window.isNotEmpty() -> AgendaList(window, now, actions)
            unavailable != null && items.isEmpty() -> unavailable()
            else -> AgendaEmpty(items.firstOrNull(), now, actions, onToggleCalendar)
        }
        plans?.invoke()
    }
}

/** "Coming up at home" / "Next 7 days", and the switch between the agenda and the calendar. */
@Composable
private fun AgendaHead(
    calendarOpen: Boolean,
    onToggle: (() -> Unit)?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 8.dp, start = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) { heading() }) {
            Text(
                "Coming up at home",
                fontSize = 18.sp,
                lineHeight = 23.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.2).sp,
                color = PantopusColors.appText,
            )
            Text("Next 7 days", fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
        }
        onToggle?.let {
            TodayTextAction(
                if (calendarOpen) "Agenda" else "Calendar",
                onClick = it,
                modifier = Modifier.testTag("today.agenda.calendar"),
            )
        }
    }
}

@Composable
private fun AgendaList(
    rows: List<AgendaItem>,
    now: ZonedDateTime,
    actions: AgendaActions,
) {
    // The soonest five; a long week stays one tap away rather than a wall (as on iPhone).
    var showsAll by rememberSaveable { mutableStateOf(false) }
    val shown = if (showsAll) rows else rows.take(AGENDA_FIRST_ROWS)
    Column(modifier = Modifier.fillMaxWidth().placeSurface().padding(horizontal = 14.dp)) {
        shown.forEachIndexed { index, item ->
            if (index > 0) TodayHairline()
            AgendaRow(item, now, actions)
        }
        if (rows.size > AGENDA_FIRST_ROWS) {
            TodayHairline()
            TodayTextAction(
                if (showsAll) "Show fewer" else "Show all ${rows.size}",
                onClick = { showsAll = !showsAll },
                modifier = Modifier.testTag("today.agenda.showAll"),
            )
        }
    }
}

/** Nothing in the window: that the week is empty, what comes next after it, and the full calendar. */
@Composable
private fun AgendaEmpty(
    next: AgendaItem?,
    now: ZonedDateTime,
    actions: AgendaActions,
    onCalendar: (() -> Unit)?,
) {
    Column(modifier = Modifier.fillMaxWidth().placeSurface().padding(horizontal = 14.dp)) {
        Text(
            "Nothing on the calendar this week",
            fontSize = 14.sp,
            lineHeight = 19.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(vertical = 14.dp),
        )
        if (next != null) {
            TodayHairline()
            Text(
                "Next",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(top = 10.dp),
            )
            AgendaRow(next, now, actions)
        }
    }
    onCalendar?.let { TodayTextAction("See full calendar", onClick = it) }
}

@Composable
private fun AgendaRow(
    item: AgendaItem,
    now: ZonedDateTime,
    actions: AgendaActions,
) {
    var open by rememberSaveable(item.id) { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth().animateContentSize().testTag("today.agenda.row")) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .clickable(role = Role.Button, onClickLabel = if (open) "Hide details" else "Show details") { open = !open }
                    .semantics(mergeDescendants = true) { stateDescription = if (open) "Expanded" else "Collapsed" }
                    .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DateBlock(item.date)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(item.title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(agendaSubtitle(item, now), fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
                AudienceLabel(item.audience)
            }
            PantopusIconImage(
                if (open) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (open) {
            Column(modifier = Modifier.padding(start = 58.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AgendaDetail(item, actions)
            }
        }
    }
}

/** "NOV" over "2", the date on the place's calendar; TalkBack says "November 2". */
@Composable
private fun DateBlock(date: LocalDate) {
    Column(
        modifier =
            Modifier.width(46.dp).clearAndSetSemantics {
                contentDescription = date.format(DateTimeFormatter.ofPattern("MMMM d", Locale.US))
            },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            date.month.getDisplayName(TextStyle.SHORT, Locale.US).uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextMuted,
        )
        Text("${date.dayOfMonth}", fontSize = 20.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
    }
}

@Composable
private fun AudienceLabel(audience: AgendaAudience) {
    Text(
        audience.label,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .padding(top = 3.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/** "Tomorrow", "Tuesday · Election day", "Monday · due 9 AM", "Tomorrow · 9 AM · you're hosting" (as on iPhone). */
fun agendaSubtitle(
    item: AgendaItem,
    now: ZonedDateTime,
): String {
    val days = java.time.temporal.ChronoUnit.DAYS.between(now.toLocalDate(), item.date)
    val day =
        when {
            days <= 0L -> "Today"
            days == 1L -> "Tomorrow"
            days < TodayAgenda.WINDOW_DAYS -> item.date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.US)
            else -> item.date.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))
        }
    val time = item.time?.let { AlertWindow.clock(it) }
    val rest =
        when (val source = item.source) {
            // The date's details, holiday move and source open with the row.
            is AgendaSource.Calendar -> emptyList()
            is AgendaSource.Ballot -> listOf(if (source.deadline == null) "Election day" else source.electionName ?: source.card.title)
            is AgendaSource.Task -> listOfNotNull(time?.let { "due $it" })
            is AgendaSource.Plan ->
                listOfNotNull(
                    if (source.plan.state == PlanState.LIVE.wire) "happening now" else time,
                    if (source.hosting) "you're hosting" else "you're going",
                )
        }
    return (listOf(day) + rest).joinToString(" · ")
}

@Composable
@Suppress("CyclomaticComplexMethod")
private fun AgendaDetail(
    item: AgendaItem,
    actions: AgendaActions,
) {
    val links = LocalUriHandler.current
    when (val source = item.source) {
        is AgendaSource.Calendar -> {
            val event = source.event
            event.detail?.takeIf { it.isNotBlank() }?.let { DetailText(it) }
            event.holidayMoveLine?.let { DetailText(it) }
            DetailMuted(
                event.source.orEmpty().ifBlank { "Pantopus registry" } +
                    if (event.confidence == "unverified") " · unconfirmed, please double-check" else "",
            )
            event.sourceUrl?.takeIf { it.isNotBlank() }?.let { url -> TodayTextAction("Open the source", onClick = { links.openUri(url) }) }
            if (item.audience == AgendaAudience.HOUSEHOLD) actions.onEditPickup?.let { TodayTextAction("Pickup schedule", onClick = it) }
        }
        is AgendaSource.Ballot -> {
            val deadline = source.deadline
            if (deadline != null) {
                deadline.detail?.takeIf { it.isNotBlank() }?.let { DetailText(it) }
            } else {
                // The election day's own deadlines: "By 8 p.m.: Drop box by 8 p.m. …".
                source.dayDeadlines.forEach { d ->
                    DetailText(listOfNotNull(d.label, d.detail?.takeIf { it.isNotBlank() }).joinToString(": "))
                }
            }
            source.card.line?.takeIf { it.isNotBlank() }?.let { DetailText(it) }
            source.card.officialLinks.forEach { link -> TodayTextAction(link.label, onClick = { links.openUri(link.url) }) }
            source.card.governments?.let { governments ->
                actions.onOpenGovernments?.let { open ->
                    TodayTextAction("See the governments on your ballot", onClick = { open(governments) })
                }
            }
            actions.onOpenBallot?.let { TodayTextAction("Open your ballot", onClick = it) }
            source.card.sourceLine?.takeIf { it.isNotBlank() }?.let { DetailMuted(it) }
        }
        is AgendaSource.Task -> {
            val task = source.task
            task.description?.takeIf { it.isNotBlank() }?.let { DetailText(it) }
            DetailMuted(
                listOfNotNull(
                    item.time?.let { "Due ${it.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))} ${AlertWindow.clock(it)}" },
                    taskStatusLabel(task.status),
                    task.visibility?.let(::taskVisibilityLabel),
                ).joinToString(" · "),
            )
            actions.onOpenTask?.let { open -> TodayTextAction("Open task", onClick = { open(task.id) }) }
        }
        is AgendaSource.Plan -> {
            val plan = source.plan
            DetailMuted(
                listOfNotNull(
                    if (source.hosting) "You're hosting" else "You're going",
                    "${plan.goingCount} going",
                    app.pantopus.android.data.plans.PlanFormat.distance(plan.distanceBand),
                ).joinToString(" · "),
            )
            actions.onOpenPlan?.let { open -> TodayTextAction("Open plan", onClick = { open(plan.id) }) }
        }
    }
}

private fun taskStatusLabel(status: String): String? =
    when (status.lowercase()) {
        "open" -> "Open"
        "in_progress" -> "In progress"
        "blocked" -> "Waiting"
        else -> null
    }

private fun taskVisibilityLabel(visibility: String): String? =
    when (visibility.lowercase()) {
        "members" -> "Household"
        "managers" -> "Managers only"
        "sensitive" -> "Private"
        "public" -> "Everyone in the home"
        else -> null
    }

@Composable
private fun DetailText(text: String) {
    Text(text, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
}

@Composable
private fun DetailMuted(text: String) {
    if (text.isBlank()) return
    Text(
        text,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        color = PantopusColors.appTextSecondary,
        maxLines = 4,
        overflow = TextOverflow.Ellipsis,
    )
}

/** A thin line between rows of one surface. */
@Composable
fun TodayHairline(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
}
