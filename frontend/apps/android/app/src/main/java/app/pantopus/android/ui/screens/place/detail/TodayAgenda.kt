package app.pantopus.android.ui.screens.place.detail

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.place.BallotDeadline
import app.pantopus.android.data.api.models.place.BallotSummary
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanFormat
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/** Who a row is for: a general date for the address, the household's own, a plan the person hosts or goes to (TPR 7.2). */
enum class AgendaAudience(val label: String) {
    ADDRESS("For this address"),
    HOUSEHOLD("Your household"),

    /** The household's pickup day, seen by a guest of the home (contract §6). */
    HOME_PICKUP("This home's pickup day"),
    PLAN("Your plan"),
    GOING("Going"),
}

/** Where a row came from, for its details and its actions. */
sealed interface AgendaSource {
    data class Calendar(val event: PlaceCalendarEvent) : AgendaSource

    /** A ballot deadline, or the election day itself ([deadline] null) with that day's own deadlines ([dayDeadlines]). */
    data class Ballot(
        val card: BallotSummary,
        val deadline: BallotDeadline?,
        val electionName: String?,
        val dayDeadlines: List<BallotDeadline> = emptyList(),
    ) : AgendaSource

    data class Task(val task: HomeTaskDto) : AgendaSource

    data class Plan(val plan: PlanDto, val hosting: Boolean) : AgendaSource
}

/**
 * One row of "Coming up at home". [time] is on the place's clock when the item has one (a plan's start, a task due
 * time); calendar dates have none. [order] sorts one day: timed items, then deadlines, then routine pickups.
 */
data class AgendaItem(
    val id: String,
    val date: LocalDate,
    val time: ZonedDateTime?,
    val title: String,
    val audience: AgendaAudience,
    val order: Int,
    val source: AgendaSource,
)

/** The agenda's rows, built on the phone from what Today already loads (TPR contract §6). */
object TodayAgenda {
    /** Today plus six days. */
    const val WINDOW_DAYS = 7L

    private const val DATE_LENGTH = 10
    private const val TIMED = 0
    private const val DEADLINE = 1
    private const val ROUTINE = 2
    private val ROUTINE_KINDS = setOf("garbage", "recycling", "yard_waste", "bulk_pickup", "pickup_holiday")
    private val CLOSED_TASKS = setOf("completed", "done", "canceled", "cancelled", "archived")

    /**
     * Every row from [today] on, soonest first (the window and, after it, what comes next): [calendar]'s dates, the
     * ballot's next deadline and election day, the household's open tasks due from today (overdue ones belong to
     * Place's "Worth a look"), and the plans the person hosts or is going to.
     */
    @Suppress("LongParameterList")
    fun items(
        today: LocalDate,
        zone: ZoneId,
        calendar: PlaceAddressCalendarData?,
        ballot: BallotSummary?,
        election: Pair<String, String>?,
        tasks: List<HomeTaskDto>,
        plans: List<Pair<PlanDto, Boolean>>,
        guest: Boolean = false,
    ): List<AgendaItem> {
        val ballotRows = ballotRows(today, ballot, election)
        val ballotDays = ballotRows.filter { (it.source as? AgendaSource.Ballot)?.deadline == null }.map { it.date }.toSet()
        val rows =
            buildList {
                calendar?.upcoming.orEmpty().forEach { event ->
                    val date = runCatching { LocalDate.parse(event.date.take(DATE_LENGTH)) }.getOrNull() ?: return@forEach
                    // The ballot's election day and a calendar election rule on that day are one row: the ballot's.
                    if (date in ballotDays && event.kind.contains("election")) return@forEach
                    if (date >= today) add(calendarRow(event, date, guest))
                }
                addAll(ballotRows)
                tasks.forEach { task -> taskRow(task, today, zone)?.let(::add) }
                plans.forEach { (plan, hosting) -> planRow(plan, hosting, today, zone)?.let(::add) }
            }
        return rows
            .distinctBy { it.id }
            .sortedWith(compareBy<AgendaItem> { it.date }.thenBy { it.order }.thenBy { it.time?.toInstant() }.thenBy { it.title })
    }

    /** The rows inside the window. */
    fun window(
        items: List<AgendaItem>,
        today: LocalDate,
    ): List<AgendaItem> = items.filter { it.date < today.plusDays(WINDOW_DAYS) }

    private fun calendarRow(
        event: PlaceCalendarEvent,
        date: LocalDate,
        guest: Boolean,
    ): AgendaItem {
        // The household's own pickup schedule is theirs; city, county and state dates are the address's.
        val household = event.audience == "household" || (event.audience == null && event.scope == "home")
        return AgendaItem(
            id = "calendar:${event.ruleId}:${event.date}:${event.kind}",
            date = date,
            time = null,
            title = event.title,
            audience =
                when {
                    !household -> AgendaAudience.ADDRESS
                    guest -> AgendaAudience.HOME_PICKUP
                    else -> AgendaAudience.HOUSEHOLD
                },
            order = if (event.kind in ROUTINE_KINDS) ROUTINE else DEADLINE,
            source = AgendaSource.Calendar(event),
        )
    }

    /**
     * The election day as one row (titled with the election's name, its own deadlines in its details) and the next
     * deadline before it as another; with no election date, the next deadline alone.
     */
    private fun ballotRows(
        today: LocalDate,
        card: BallotSummary?,
        election: Pair<String, String>?,
    ): List<AgendaItem> {
        card ?: return emptyList()
        val deadlines =
            card.deadlines
                .mapNotNull { d -> runCatching { LocalDate.parse(d.date.take(DATE_LENGTH)) }.getOrNull()?.let { it to d } }
                .filter { (date, _) -> date >= today }
        val electionDay =
            election?.second?.let { runCatching { LocalDate.parse(it.take(DATE_LENGTH)) }.getOrNull() }?.takeIf { it >= today }
        val rows = mutableListOf<AgendaItem>()
        if (election != null && electionDay != null) {
            rows +=
                AgendaItem(
                    id = "ballot:election:${election.second}",
                    date = electionDay,
                    time = null,
                    title = election.first,
                    audience = AgendaAudience.ADDRESS,
                    order = DEADLINE,
                    source =
                        AgendaSource.Ballot(card, null, election.first, deadlines.filter { it.first == electionDay }.map { it.second }),
                )
        }
        deadlines
            .filter { (date, _) -> electionDay == null || date < electionDay }
            .minByOrNull { (date, _) -> date }
            ?.let { (date, deadline) ->
                rows +=
                    AgendaItem(
                        id = "ballot:${deadline.key}:${deadline.date}",
                        date = date,
                        time = null,
                        title = deadline.label,
                        audience = AgendaAudience.ADDRESS,
                        order = DEADLINE,
                        source = AgendaSource.Ballot(card, deadline, election?.first),
                    )
            }
        return rows
    }

    private fun taskRow(
        task: HomeTaskDto,
        today: LocalDate,
        zone: ZoneId,
    ): AgendaItem? {
        if (task.status.lowercase() in CLOSED_TASKS) return null
        val due = PlanFormat.instant(task.dueAt)?.atZone(zone) ?: return null
        if (due.toLocalDate() < today) return null
        return AgendaItem(
            id = "task:${task.id}",
            date = due.toLocalDate(),
            time = due,
            title = task.title,
            audience = AgendaAudience.HOUSEHOLD,
            order = DEADLINE,
            source = AgendaSource.Task(task),
        )
    }

    private fun planRow(
        plan: PlanDto,
        hosting: Boolean,
        today: LocalDate,
        zone: ZoneId,
    ): AgendaItem? {
        if (plan.state in setOf("ended", "cancelled", "canceled")) return null
        val start = PlanFormat.instant(plan.startsAt)?.atZone(zone)
        val date =
            start?.toLocalDate()
                ?: plan.localDateRaw?.let { runCatching { LocalDate.parse(it.take(DATE_LENGTH)) }.getOrNull() }
                ?: return null
        if (date < today) return null
        return AgendaItem(
            id = "plan:${plan.id}",
            date = date,
            time = start,
            title = plan.title,
            audience = if (hosting) AgendaAudience.PLAN else AgendaAudience.GOING,
            order = if (start != null) TIMED else DEADLINE,
            source = AgendaSource.Plan(plan, hosting),
        )
    }
}
