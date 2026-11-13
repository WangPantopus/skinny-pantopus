@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.plans.map

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.api.models.plans.PlanMoreTimeDto
import app.pantopus.android.data.api.models.plans.PlanMoreTimesDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanHostFilter
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.PlanWindow
import app.pantopus.android.data.plans.hostApproves
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.isBusiness
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.LocalPlanSheet
import app.pantopus.android.ui.screens.plans.components.PLAN_BUSINESS_SPOKEN
import app.pantopus.android.ui.screens.plans.components.PLAN_FREE
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanHostRow
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanKindLeading
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.screens.plans.components.PlanSegmented
import app.pantopus.android.ui.screens.plans.components.PlanSpotsCaption
import app.pantopus.android.ui.screens.plans.components.PlanSpotsMeter
import app.pantopus.android.ui.screens.plans.components.PlanStackButton
import app.pantopus.android.ui.screens.plans.components.PlanSwatch
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTypeTag
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.teams.PlansSportsEmpty
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import app.pantopus.android.ui.screens.plans.components.PlanGuestsSeeCard
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow

/** h4 on the boards: 17/22 semibold. */
internal val planH4 = PantopusTextStyle.body.copy(fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold)

/** h3 on the boards: 20/26 semibold. */
internal val planH3 = PantopusTextStyle.h3.copy(lineHeight = 26.sp)

/** h2 on the boards: 24/30 bold. */
internal val planH2 = PantopusTextStyle.h2.copy(lineHeight = 30.sp, fontWeight = FontWeight.Bold)

/** The words a row shows at its end for [plan] (board P2: one thing only). */
internal fun rowEnd(
    plan: PlanDto,
    mine: Boolean,
): PlanRowEnd =
    when {
        mine && plan.standing == PlanViewerStanding.HOSTING -> hostingEnd(plan)
        plan.standing == PlanViewerStanding.REQUESTED -> PlanRowEnd.Status("Requested", PantopusIcon.Clock)
        plan.standing == PlanViewerStanding.WAITLISTED ->
            PlanRowEnd.Status(plan.viewer?.waitlistPosition?.let { "On the waitlist · ${ordinal(it)}" } ?: "On the waitlist")
        plan.standing == PlanViewerStanding.IN -> PlanRowEnd.Status("You're in", PantopusIcon.Check, PantopusColors.success)
        plan.standing == PlanViewerStanding.NONE && plan.myInvite?.status == "pending" ->
            PlanRowEnd.Status("Invited", PantopusIcon.UserPlus, PantopusColors.primary600)
        mine -> PlanRowEnd.Chevron
        else -> spotsEnd(plan)
    }

/** A plan the viewer has no part in: how many are going or spots left; a business's shows its price instead (G2). */
private fun spotsEnd(plan: PlanDto): PlanRowEnd =
    when {
        // "Free" in step 2 (no price exists yet).
        plan.isBusiness && !plan.isFull -> if (plan.price == null) PlanRowEnd.Price(PLAN_FREE) else PlanRowEnd.None
        plan.planState == PlanState.LIVE -> PlanRowEnd.Note("${plan.goingCount} going")
        plan.isFull -> PlanRowEnd.Note("Full")
        plan.spotsLeft == 1 -> PlanRowEnd.Note("1 spot")
        else -> PlanRowEnd.Note("${plan.spotsLeft} spots")
    }

/** A hosted plan's row end: its requests, else how many are going. */
private fun hostingEnd(plan: PlanDto): PlanRowEnd {
    val requests = plan.requestsCount ?: 0
    return if (requests > 0) {
        PlanRowEnd.Status(if (requests == 1) "1 request" else "$requests requests", PantopusIcon.Bell, PantopusColors.primary600)
    } else {
        // The subtitle already says "You're hosting" (board F2); iOS shows how many are going here too.
        PlanRowEnd.Note("${plan.goingCount} going")
    }
}

/** "1st", "2nd", "3rd", "4th". */
internal fun ordinal(n: Int): String {
    val suffix =
        if (n % 100 in 11..13) {
            "th"
        } else {
            when (n % 10) {
                1 -> "st"
                2 -> "nd"
                3 -> "rd"
                else -> "th"
            }
        }
    return "$n$suffix"
}

/** TalkBack for a plan row: type, title, when and where, and its status. */
internal fun rowSpoken(
    plan: PlanDto,
    end: PlanRowEnd,
): String {
    val endWords =
        when (end) {
            is PlanRowEnd.Status -> end.text
            is PlanRowEnd.Note -> end.text
            is PlanRowEnd.Price -> end.text
            else -> null
        }
    // A business's plan: what it calls it ("Clinic"), and that a business hosts it (the badge's words).
    val kind = plan.labelText?.takeIf { plan.isBusiness } ?: plan.planKind?.label
    val business = PLAN_BUSINESS_SPOKEN.takeIf { plan.isBusiness }
    return listOfNotNull(kind, business, plan.title, PlanFormat.rowSubtitle(plan), endWords).joinToString(", ")
}

/** One plan as a row of the list; at the sheet's lowest stop ([peek], board F1) a chevron ends it, as on iOS. */
@Composable
internal fun PlanListRow(
    plan: PlanDto,
    first: Boolean,
    mine: Boolean,
    onOpen: (PlanDto) -> Unit,
    peek: Boolean = false,
    /** Opens one of a venue's later plans from its fold (the full list only; null leaves the fold out). */
    fold: PlanFoldScope? = null,
) {
    val status = rowEnd(plan, mine)
    PlanRow(
        title = plan.title,
        subtitle = PlanFormat.rowSubtitle(plan),
        end = if (peek) PlanRowEnd.Chevron else status,
        first = first,
        leading = { PlanKindLeading(plan.planKind, business = plan.isBusiness) },
        // TalkBack still hears the status or spots a peek row doesn't show (as VoiceOver does on iOS).
        spoken = rowSpoken(plan, status),
        onClick = { onOpen(plan) },
    )
    val more = plan.moreTimes?.takeIf { it.count > 0 && plan.isBusiness }
    if (fold != null && more != null) PlanFold(plan.id, more, fold)
}

/** What a venue's fold needs from the list: the window it says "this week" by, and how to open a plan by id. */
internal class PlanFoldScope(
    val window: PlanWindow,
    val onOpenId: (String) -> Unit,
)

/**
 * A venue's later plans, folded under its soonest (boards G2 and P3): "3 more times this week at this place", and
 * opened, a short line for each ("Open play · Sun 2:00 PM") and "Show less". Its own control under the row, so
 * TalkBack reaches it.
 */
@Composable
private fun PlanFold(
    planId: String,
    more: PlanMoreTimesDto,
    scope: PlanFoldScope,
) {
    var open by rememberSaveable(planId) { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth().padding(start = FOLD_INDENT)) {
        if (open) {
            more.items.forEach { item ->
                PlanDivider()
                PlanFoldLine(item, onClick = { scope.onOpenId(item.id) })
            }
            val unlisted = more.count - more.items.size
            if (unlisted > 0) {
                PlanDivider()
                Text(
                    text = "And $unlisted more",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(vertical = 10.dp),
                )
            }
        }
        PlanFoldToggle(
            planId = planId,
            text = if (open) "Show less" else foldLine(more.count, scope.window),
            open = open,
            onClick = { open = !open },
        )
    }
}

/** "3 more times this week at this place", "1 more time today at this place". */
internal fun foldLine(
    count: Int,
    window: PlanWindow,
): String {
    val times = if (count == 1) "1 more time" else "$count more times"
    val span =
        when (window) {
            PlanWindow.NOW, PlanWindow.TODAY -> "today"
            PlanWindow.WEEKEND -> "this weekend"
            PlanWindow.WEEK -> "this week"
        }
    return "$times $span at this place"
}

@Composable
private fun PlanFoldToggle(
    planId: String,
    text: String,
    open: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag("planFold.$planId")
                .semantics(mergeDescendants = true) { stateDescription = if (open) "Open" else "Closed" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = if (open) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary700,
        )
        Text(
            text = text,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.primary700,
        )
    }
}

/** One folded plan: its label (or title) in bold and when ("Open play · Sun 2:00 PM"); opens that plan. */
@Composable
private fun PlanFoldLine(
    item: PlanMoreTimeDto,
    onClick: () -> Unit,
) {
    val name = item.labelText?.takeIf(String::isNotBlank) ?: item.title.orEmpty()
    val whenText = PlanFormat.instant(item.startsAt)?.let { PlanFormat.shortWhen(it, PlanFormat.zone(item.timezone)) }
    Text(
        text =
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append(name) }
                whenText?.let { append(" · $it") }
            },
        style = PantopusTextStyle.small.copy(fontSize = 14.sp),
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(vertical = 12.dp)
                .testTag("planFoldItem.${item.id}"),
    )
}

/** The fold lines up under the row's words, past the 44 dp tile and its 12 dp gap. */
private val FOLD_INDENT = 56.dp

/**
 * The All / Neighbors / Businesses filter under the list's title (boards G1, G2 and P3): only once a business has a
 * plan in the area, so Plans looks as it always has until then.
 */
@Composable
internal fun PlansHostFilterBar(
    state: PlansMapUiState,
    onSelect: (PlanHostFilter) -> Unit,
) {
    if (!state.showsHostFilter) return
    PlanSegmented(
        options = PlanHostFilter.entries.map { it.wire to it.label },
        selected = state.hostShown.wire,
        onSelect = { onSelect(PlanHostFilter.from(it)) },
        modifier = Modifier.padding(top = Spacing.s2, bottom = Spacing.s1).testTag("plansHostFilter"),
        optionTags = listOf("plansHostFilterAll", "plansHostFilterNeighbors", "plansHostFilterBusinesses"),
    )
}

/** Nothing for the filter chosen (the design's states table): says so, with a way back to every plan. */
@Composable
private fun PlansHostFilterEmpty(
    state: PlansMapUiState,
    onShowAll: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3).testTag("plansHostFilterEmpty"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // "Other" when the person's own plans of this filter are listed just above.
        val other = if (state.mineShown.isNotEmpty()) "other " else ""
        Text(
            text =
                if (state.hostShown == PlanHostFilter.BUSINESSES) {
                    "No ${other}businesses have plans here ${state.window.phrase}."
                } else {
                    "No ${other}neighbors have plans here ${state.window.phrase}."
                },
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        GhostButton(title = "Show all plans", onClick = onShowAll, modifier = Modifier.testTag("plansHostFilterShowAll"))
    }
}

/** The sheet at its lowest stop (board F1): "This week near you", "See all", the two soonest plans. */
@Composable
internal fun ColumnScope.PlansPeekContent(
    state: PlansMapUiState,
    onSeeAll: () -> Unit,
    onOpen: (PlanDto) -> Unit,
    onRetry: () -> Unit,
    onHostFilter: (PlanHostFilter) -> Unit = {},
) {
    val all = state.mineShown + state.others
    val sheet = LocalPlanSheet.current
    // The lowest stop shows the title and the soonest plan over the map (as on iOS); the next one waits just below it.
    Column(modifier = Modifier.fillMaxWidth().onSizeChanged { sheet?.reportPeek(it.height) }) {
        PeekTitle(state, all, onSeeAll)
        PlansHostFilterBar(state, onHostFilter)
        when (state.listStatus) {
            PlansListStatus.Loading -> PlanRowsSkeleton(rows = 2)
            is PlansListStatus.Failed -> PlansFailed(state.listStatus.message, onRetry = onRetry)
            PlansListStatus.Loaded -> {
                val soonest = all.firstOrNull()
                if (soonest == null && state.hostFiltered) {
                    PlansHostFilterEmpty(state, onShowAll = { onHostFilter(PlanHostFilter.ALL) })
                } else if (soonest == null) {
                    Text(
                        text = "Nothing within 5 miles ${state.window.phrase}. Plans farther away show on the map.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(vertical = Spacing.s3),
                    )
                } else {
                    PlanListRow(soonest, first = true, mine = soonest in state.mineShown, onOpen = onOpen, peek = true)
                }
            }
        }
    }
    if (state.listStatus == PlansListStatus.Loaded) {
        all.drop(1).take(PEEK_ROWS - 1).forEach { plan ->
            PlanListRow(plan, first = false, mine = plan in state.mineShown, onOpen = onOpen, peek = true)
        }
    }
}

/** "This week near you", and "See all" when the list holds more than the rows below (as on iOS). */
@Composable
private fun PeekTitle(
    state: PlansMapUiState,
    all: List<PlanDto>,
    onSeeAll: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "${state.window.label} near you",
            style = planH4,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        if (all.size > PEEK_ROWS) {
            Text(
                text = "See all ${all.size}",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.primary700,
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clickable(role = Role.Button, onClick = onSeeAll)
                        .padding(horizontal = Spacing.s1, vertical = 12.dp),
            )
        }
    }
}

private const val PEEK_ROWS = 2

/**
 * The list pulled up (board F2): your plans, today, tomorrow, the rest of the week, then Pulse and Connections. With the
 * Pulse redesign off the list ends at the plans: Nearby is its own tab beside Plans, and it has Pulse and Connections.
 */
@Suppress("LongParameterList")
@Composable
internal fun PlansListContent(
    state: PlansMapUiState,
    onBackToMap: () -> Unit,
    onOpen: (PlanDto) -> Unit,
    onOpenPulse: () -> Unit,
    onOpenConnections: () -> Unit,
    onRetry: () -> Unit,
    onOpenId: (String) -> Unit = {},
    onHostFilter: (PlanHostFilter) -> Unit = {},
) {
    val sections = remember(state.others, state.mineShown) { daySections(state.others) }
    val fold = remember(state.window, onOpenId) { PlanFoldScope(state.window, onOpenId) }
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        item(key = "header") {
            PlansListHeader(state, onBackToMap)
            PlansHostFilterBar(state, onHostFilter)
        }
        if (state.listStatus is PlansListStatus.Failed && state.list.isEmpty()) {
            item(key = "failed") { PlansFailed(state.listStatus.message, onRetry) }
        }
        if (state.listStatus == PlansListStatus.Loading) {
            item(key = "loading") { PlanRowsSkeleton(rows = 4) }
        }
        if (state.mineShown.isNotEmpty()) {
            item(key = "mine-title") { SectionTitle("Your plans", top = 10.dp) }
            items(state.mineShown, key = { "mine-${it.id}" }) { plan ->
                PlanListRow(plan, first = plan == state.mineShown.first(), mine = true, onOpen = onOpen)
            }
        }
        sections.forEach { (title, plans) ->
            item(key = "title-$title") { SectionTitle(title, top = 14.dp) }
            items(plans, key = { "row-${it.id}" }) { plan ->
                PlanListRow(plan, first = plan == plans.first(), mine = false, onOpen = onOpen, fold = fold)
            }
        }
        // The filter chosen has nothing here: say so, with a way back to every plan.
        if (sections.isEmpty() && state.listStatus == PlansListStatus.Loaded && state.hostFiltered) {
            item(key = "host-empty") { PlansHostFilterEmpty(state, onShowAll = { onHostFilter(PlanHostFilter.ALL) }) }
        } else if (sections.isEmpty() && state.listStatus == PlansListStatus.Loaded) {
            // Only your own plans nearby (as on iOS): say so instead of ending the list in silence.
            item(key = "no-others") {
                Text(
                    text = "No other ${state.kind?.label?.lowercase() ?: "plans"} near you yet.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(vertical = Spacing.s3),
                )
            }
        }
        item(key = "more") {
            if (LaunchFeatures.pulseRedesign) {
                SectionTitle("More nearby", top = 14.dp)
                MoreNearbyRow(PantopusIcon.Megaphone, "Pulse", "Local posts and questions", first = true, onClick = onOpenPulse)
                MoreNearbyRow(PantopusIcon.Users, "Connections", "Keep up with people you know", first = false, onClick = onOpenConnections)
            }
            Spacer(modifier = Modifier.height(Spacing.s6))
        }
    }
}

@Composable
private fun PlansListHeader(
    state: PlansMapUiState,
    onBackToMap: () -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Plans near ${state.location?.label ?: "you"}",
                style = planH3,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "${state.window.label} · within 5 mi",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable(role = Role.Button, onClick = onBackToMap)
                    .clearAndSetSemantics {
                        contentDescription = "Back to the map"
                        role = Role.Button
                    },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Map, contentDescription = null, size = 20.dp, tint = PantopusColors.appText)
        }
        // Ask is the chrome's sparkle just above: the list stops under it now (as on iOS).
    }
}

@Composable
private fun SectionTitle(
    title: String,
    top: androidx.compose.ui.unit.Dp,
) {
    PlanOverline(text = title, modifier = Modifier.padding(top = top, bottom = 2.dp))
}

@Composable
private fun MoreNearbyRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String,
    first: Boolean,
    onClick: () -> Unit,
) {
    PlanRow(
        title = title,
        subtitle = subtitle,
        end = PlanRowEnd.Chevron,
        first = first,
        leading = { PlanIconTile(icon = icon, background = PantopusColors.primary600, tint = PantopusColors.appTextInverse) },
        spoken = "$title, $subtitle",
        onClick = onClick,
    )
}

/** The window inside a sentence: "right now", "today", "this week", "this weekend" (as on iOS). */
private val PlanWindow.phrase: String
    get() = if (this == PlanWindow.NOW) "right now" else label.lowercase()

/** Plans grouped by day: "Today", "Tomorrow", then the weekday ("Saturday"), soonest first. */
internal fun daySections(plans: List<PlanDto>): List<Pair<String, List<PlanDto>>> {
    val dayName = DateTimeFormatter.ofPattern("EEEE", Locale.US)
    return plans
        .groupBy { plan ->
            val zone = PlanFormat.zone(plan.timezone)
            val today = LocalDate.now(zone)
            val date =
                PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDate()
                    ?: plan.localDateRaw?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            when {
                plan.planState == PlanState.LIVE -> "Today"
                date == null -> "This week"
                date == today -> "Today"
                date == today.plusDays(1) -> "Tomorrow"
                date.isBefore(today.plusDays(7)) -> date.format(dayName)
                else -> "Later"
            }
        }.toList()
}

/** Three grey rows while the list loads (the loading state mirrors the loaded rows). */
@Composable
internal fun PlanRowsSkeleton(rows: Int) {
    Column(modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Loading plans" }) {
        repeat(rows) { index ->
            if (index > 0) PlanDivider()
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 44.dp, height = 44.dp, cornerRadius = 13.dp)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Shimmer(width = 180.dp, height = 16.dp)
                    Shimmer(width = 130.dp, height = 12.dp)
                }
            }
        }
    }
}

/** The list couldn't load and there is no copy to show. */
@Composable
internal fun PlansFailed(
    message: String,
    onRetry: (() -> Unit)?,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Couldn't load plans near you.",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        Text(text = message, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        if (onRetry != null) GhostButton(title = "Try again", onClick = onRetry)
    }
}

/** A pin tapped (board F3): the plan's public card in the sheet. */
@Composable
internal fun PlanCardContent(
    plan: PlanDto,
    onClose: () -> Unit,
    onDetails: () -> Unit,
    onPrimary: () -> Unit,
) {
    val kind = plan.planKind ?: return
    val scroll = rememberScrollState()
    val sheet = LocalPlanSheet.current
    Column(
        modifier = Modifier.fillMaxWidth().reportsFit(scroll).verticalScroll(scroll),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Pulled down, the card keeps its type, title, when and where over the map.
        Column(
            modifier = Modifier.onSizeChanged { sheet?.reportPeek(it.height) },
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PlanTypeTag(kind, label = plan.labelText.takeIf { plan.isBusiness })
                Spacer(modifier = Modifier.weight(1f))
                CardCloseButton(onClose)
            }
            Text(
                text = plan.title,
                style = planH3,
                color = PantopusColors.appText,
                modifier = Modifier.clickable(role = Role.Button, onClick = onDetails).semantics { heading() },
            )
            Text(text = cardWhereLine(plan), style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        plan.business?.let { business ->
            PlanHostRow(
                name = business.name ?: plan.host?.displayName ?: "A business",
                verified = business.verified,
                caption = hostCaption(plan),
                avatarUrl = business.avatarUrl,
                business = true,
            )
        } ?: plan.host?.let { host ->
            PlanHostRow(
                name = host.displayName ?: "Neighbor",
                verified = host.verifiedAddress,
                caption = hostCaption(plan),
                seed = host.userId,
                avatarUrl = host.avatarUrl,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val (going, left) = PlanFormat.goingLine(plan)
            // Someone already in (or hosting) doesn't need to hear how to get in (as on iOS).
            val inAlready = plan.standing == PlanViewerStanding.HOSTING || plan.standing == PlanViewerStanding.IN
            PlanSpotsCaption(going = going, left = left, note = if (inAlready) null else PlanFormat.howPeopleGetIn(plan))
            PlanSpotsMeter(spots = plan.spots, taken = plan.spots - plan.spotsLeft)
        }
        val main = mainAction(plan)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 2.dp)) {
            GhostButton(title = "Details", onClick = onDetails, modifier = Modifier.weight(1f))
            when {
                main == null -> Unit
                main.isPrimary -> PrimaryButton(title = main.title, onClick = onPrimary, modifier = Modifier.weight(1f))
                else -> GhostButton(title = main.title, onClick = onPrimary, modifier = Modifier.weight(1f))
            }
        }
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

/** A tapped pin whose plan can't be loaded (as on iOS): it may have ended or been cancelled. */
@Composable
internal fun PlanCardUnavailable(onClose: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "This plan isn't available",
                style = planH4,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            CardCloseButton(onClose)
        }
        Text(text = "It may have ended or been cancelled.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
    }
}

/** The card's close button: a 36 dp circle in a 44 dp target. */
@Composable
private fun CardCloseButton(onClose: () -> Unit) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clickable(role = Role.Button, onClick = onClose)
                .clearAndSetSemantics {
                    contentDescription = "Close"
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 16.dp, tint = PantopusColors.appText)
        }
    }
}

/** "Sun, Oct 18 · 1:25–4:45 PM · Near Prune Hill · under 1 mi" (a business's plan names its place, not an area). */
internal fun cardWhereLine(plan: PlanDto): String =
    listOfNotNull(
        PlanFormat.whenLine(plan),
        if (plan.isBusiness) plan.place?.name ?: plan.area?.label else plan.area?.label,
        PlanFormat.distance(plan.distanceBand),
    ).joinToString(" · ")

/** "Hosted 3 plans · 2 mutual connections" (a playdate host's playdates, from `kind_hosted`, as on iOS). */
internal fun hostCaption(plan: PlanDto): String {
    // A business: how many plans it has hosted (the proof line waits for check-in), never connections.
    plan.business?.let { business ->
        val hosted = business.plansHosted
        return if (hosted > 0) "Hosted $hosted plan${if (hosted == 1) "" else "s"}" else "New to hosting"
    }
    val host = plan.host ?: return ""
    val parts = mutableListOf<String>()
    val playdates = host.kindHosted ?: 0
    if (plan.isPlaydate && playdates > 0) {
        parts += "Hosted $playdates playdate${if (playdates == 1) "" else "s"}"
    } else if (host.plansHosted > 0) {
        parts += "Hosted ${host.plansHosted} plan${if (host.plansHosted == 1) "" else "s"}"
    }
    if (host.mutualConnections > 0) {
        parts += "${host.mutualConnections} mutual connection${if (host.mutualConnections == 1) "" else "s"}"
    }
    if (parts.isEmpty()) parts += "New to hosting"
    return parts.joinToString(" · ")
}

/** The card's one main action next to "Details" (as on iOS). */
internal data class PlanMainAction(
    val title: String,
    val isPrimary: Boolean,
    /** Opens "Ask to join" (J3) rather than the plan. */
    val asks: Boolean = false,
)

/**
 * By where the viewer stands: "Your plan", "You're in", "Requested", "On the waitlist", "Ask to join" or "Join the
 * waitlist"; none when they can't ask (too far, not verified, declined, ended), so "Details" alone explains why.
 */
internal fun mainAction(plan: PlanDto): PlanMainAction? {
    val viewer = plan.viewer
    return when (plan.standing) {
        PlanViewerStanding.HOSTING -> PlanMainAction("Your plan", isPrimary = true)
        PlanViewerStanding.IN -> PlanMainAction("You're in", isPrimary = true)
        PlanViewerStanding.REQUESTED -> PlanMainAction("Requested", isPrimary = false)
        PlanViewerStanding.WAITLISTED -> PlanMainAction("On the waitlist", isPrimary = false)
        else ->
            when {
                plan.planState == PlanState.ENDED || plan.planState == PlanState.CANCELLED -> null
                // The host's invitation: "I'm in" (as on iOS).
                plan.myInvite?.isOpen == true && (viewer?.canAsk == true || viewer?.cannotAskReason == "full_use_waitlist") ->
                    PlanMainAction(if (plan.isFull) "Join the waitlist" else "I'm in", isPrimary = true, asks = true)
                viewer == null -> PlanMainAction(askWord(plan), isPrimary = true, asks = true)
                viewer.canAsk -> PlanMainAction(if (plan.isFull) "Join the waitlist" else askWord(plan), isPrimary = true, asks = true)
                viewer.cannotAskReason == "full_use_waitlist" -> PlanMainAction("Join the waitlist", isPrimary = true, asks = true)
                else -> null
            }
    }
}

/** "Join" for a business's plan that lets people in right away (board G3), "Ask to join" otherwise. */
internal fun askWord(plan: PlanDto): String = if (plan.isBusiness && !plan.hostApproves) "Join" else "Ask to join"

/** What "Invite a neighbor" shares (board F4, the same words as iOS). */
const val PLANS_INVITE_MESSAGE = "I'm on Pantopus to make small plans with neighbors. Join me."

/** Nothing planned this week (board F4): a game to host if there is one, the other types, and an invite. */
@Composable
internal fun PlansEmptyContent(
    state: PlansMapUiState,
    onHost: (PlanKind, PlanGameDto?) -> Unit,
    onInvite: () -> Unit,
    onShowElsewhere: () -> Unit,
    onGamesChanged: () -> Unit,
) {
    val scroll = rememberScrollState()
    val sheet = LocalPlanSheet.current
    Column(
        // One drag up shows all of it: the middle stop fits the whole message.
        modifier = Modifier.fillMaxWidth().reportsFit(scroll).verticalScroll(scroll),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // The lowest stop shows down to here: the title and the suggestion over the map.
        Column(
            modifier = Modifier.onSizeChanged { sheet?.reportPeek(it.height) },
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = "Nothing planned yet",
                    style = planH3,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = "Plans here start with one neighbor. Yours could be the first.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
            // The next game as a watch-party nudge; without one, the plain invitation (as on iOS).
            PlansSportsEmpty(state.games, state.sports, onGamesChanged) { game, onLongClick ->
                GameSuggestion(game, onLongClick) { onHost(PlanKind.WATCH_PARTY, game) }
            }
        }
        val others = state.kinds.filter { it != PlanKind.WATCH_PARTY }
        Text(
            text = "Or start something else",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            others.forEach { kind ->
                PlanStackButton(
                    title = kind.label,
                    onClick = { onHost(kind, null) },
                    modifier = Modifier.weight(1f),
                    leading = { PlanSwatch(kind) },
                    spoken = "Host a ${kind.noun}",
                )
            }
        }
        PlanDivider(modifier = Modifier.padding(top = Spacing.s1))
        state.elsewhere?.takeIf { it.count > 0 && !it.city.isNullOrBlank() }?.let { other ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text =
                        "${other.count} plan${if (other.count == 1) "" else "s"} in ${other.city}" +
                            (other.miles?.let { ", $it mi away" } ?: ""),
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "Show",
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary700,
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clickable(role = Role.Button, onClick = onShowElsewhere)
                            .padding(horizontal = Spacing.s1, vertical = 12.dp),
                )
            }
        }
        GhostButton(title = "Invite a neighbor", onClick = onInvite)
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GameSuggestion(
    game: PlanGameDto?,
    onLongClick: (() -> Unit)?,
    onClick: () -> Unit,
) {
    val colors = PlanKind.WATCH_PARTY.colors
    // The label ("Seahawks"), never `team`, which is the list's internal id ("seahawks").
    val title = game?.let(::gameLine) ?: "Watch a game together"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(colors.tint)
                .combinedClickable(role = Role.Button, onClick = onClick, onLongClick = onLongClick)
                .padding(14.dp)
                .semantics(mergeDescendants = true) { role = Role.Button },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanSwatch(PlanKind.WATCH_PARTY, size = 40.dp, glyph = 20.dp, corner = 12.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            Text(text = "Host a watch party", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** "Seahawks play Sunday at 1:25", "Seahawks play today at 7:15" (board F4, as on iOS). */
internal fun gameLine(game: PlanGameDto): String {
    val start = PlanFormat.instant(game.startsAt)?.atZone(java.time.ZoneId.systemDefault()) ?: return "${game.label} play soon"
    val day =
        when (ChronoUnit.DAYS.between(LocalDate.now(start.zone), start.toLocalDate())) {
            0L -> "today"
            1L -> "tomorrow"
            else -> start.format(DateTimeFormatter.ofPattern("EEEE", Locale.US))
        }
    val matchup = if (game.opponent.isNullOrBlank()) "${game.label} play" else game.matchupLabel()
    return "$matchup $day at ${start.format(DateTimeFormatter.ofPattern("h:mm", Locale.US))}"
}

/** No location yet (board F5); after a refusal it says location is off, with Settings when there's no home (as on iOS). */
@Composable
internal fun PlansNoLocationContent(
    canUseHome: Boolean,
    locationOff: Boolean,
    onUseLocation: () -> Unit,
    onUseHome: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val scroll = rememberScrollState()
    Column(
        // The question and its buttons all show at the middle stop when they fit.
        modifier = Modifier.fillMaxWidth().reportsFit(scroll).verticalScroll(scroll).padding(top = Spacing.s1),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        PlanIconTile(
            icon = PantopusIcon.Navigation,
            background = PantopusColors.primary100,
            tint = PantopusColors.primary700,
            size = 52.dp,
            glyph = 28.dp,
            corner = 15.dp,
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(text = "See plans near you", style = planH2, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
            Text(
                text = "Pantopus uses your location to show what neighbors are planning close by.",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanScopeLine("Hosts and guests never see where you are. They see a distance like “about 1 mi”.")
        if (locationOff) {
            Text(
                text =
                    if (canUseHome) {
                        "Location is off for Pantopus. You can use your home instead."
                    } else {
                        "Location is off for Pantopus. You can turn it on in Settings."
                    },
                style = PantopusTextStyle.small,
                color = PantopusColors.warning,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.padding(top = Spacing.s1)) {
            PrimaryButton(title = "Use my location", onClick = onUseLocation, modifier = Modifier.height(50.dp))
            if (canUseHome) GhostButton(title = "Use my home instead", onClick = onUseHome, modifier = Modifier.height(50.dp))
            if (locationOff && !canUseHome) PlanTextButton(title = "Open Settings", onClick = onOpenSettings)
        }
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

/**
 * Reports this scrolling card or message's whole height (what shows plus what scrolls) to the sheet it sits in, so
 * the middle stop can fit it. Put it before [verticalScroll], where the size is the visible part.
 */
@Composable
private fun Modifier.reportsFit(scroll: ScrollState): Modifier {
    val sheet = LocalPlanSheet.current ?: return this
    var viewport by remember { mutableIntStateOf(0) }
    LaunchedEffect(scroll, sheet) {
        snapshotFlow { viewport + scroll.maxValue }.collect { if (viewport > 0) sheet.reportFit(it) }
    }
    return onSizeChanged { viewport = it.height }
}

/** The area pill's choices. */
internal val windowChoices = listOf(PlanWindow.NOW, PlanWindow.TODAY, PlanWindow.WEEK, PlanWindow.WEEKEND)

/**
 * Posted as a business (board B3): what guests see, then how to bring the business's own customers: its link,
 * invitations by email, and people who came before (the last two are today's invite sheet). No rates line: step 2
 * has no price.
 */
@Composable
internal fun PlanPostedBusinessContent(
    plan: PlanDto,
    onCopyLink: () -> Unit,
    onSeePlan: () -> Unit,
    onDone: () -> Unit,
    onInvite: (() -> Unit)?,
) {
    val kind = plan.planKind ?: return
    val scroll = rememberScrollState()
    Column(
        modifier = Modifier.fillMaxWidth().reportsFit(scroll).verticalScroll(scroll).testTag("planPostedBusiness"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "Your ${plan.labelText?.lowercase(Locale.US) ?: "plan"} is posted",
                style = planH2,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = PlanFormat.whenLine(plan, long = true), style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlanOverline("What guests see")
            PlanGuestsSeeCard(
                kind = kind,
                label = plan.labelText,
                title = plan.title,
                whenText = PlanFormat.whenLine(plan, long = true),
                spots = plan.spots,
                place = listOfNotNull(plan.place?.name, plan.place?.address).joinToString(" · "),
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlanOverline("Bring your regulars")
            PlanFormCard {
                RegularsRow(
                    first = true,
                    icon = PantopusIcon.Link,
                    title = "Copy your link",
                    caption = "For your site, your texts, your front desk",
                    onClick = onCopyLink,
                    tag = "planPostedCopyLink",
                )
                if (onInvite != null) {
                    RegularsRow(
                        first = false,
                        icon = PantopusIcon.Mail,
                        title = "Invite by email",
                        caption = "Paste your customer list",
                        onClick = onInvite,
                        tag = "planPostedInviteEmail",
                    )
                    RegularsRow(
                        first = false,
                        icon = PantopusIcon.Users,
                        title = "Invite people who came before",
                        caption = "People who came to your plans",
                        onClick = onInvite,
                        tag = "planPostedInvitePeople",
                    )
                }
            }
        }
        PrimaryButton(title = "See your plan", onClick = onSeePlan, modifier = Modifier.height(50.dp))
        PlanTextButton(title = "Done", onClick = onDone)
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

@Composable
private fun RegularsRow(
    first: Boolean,
    icon: PantopusIcon,
    title: String,
    caption: String,
    onClick: () -> Unit,
    tag: String,
) {
    PlanOptionRow(
        first = first,
        onClick = onClick,
        modifier = Modifier.testTag(tag).semantics(mergeDescendants = true) { role = Role.Button },
    ) {
        PlanIconTile(icon = icon, background = PantopusColors.primary100, tint = PantopusColors.primary700, size = 36.dp, glyph = 18.dp, corner = 10.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            Text(text = caption, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** Posted (board H8): the plan is on the map, with a way to invite friends. */
@Composable
internal fun PlanPostedContent(
    plan: PlanDto,
    onShare: () -> Unit,
    onSeePlan: () -> Unit,
    onDone: () -> Unit,
    onInvite: (() -> Unit)? = null,
) {
    val scroll = rememberScrollState()
    Column(
        modifier = Modifier.fillMaxWidth().reportsFit(scroll).verticalScroll(scroll),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "Your plan is on the map",
                style = planH2,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "Neighbors near you can see it now. We'll tell you when someone asks to join.",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
        }
        Column(
            modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                PlanIconTile(
                    icon = if (onInvite != null) PantopusIcon.UserPlus else PantopusIcon.Link,
                    background = PantopusColors.primary100,
                    tint = PantopusColors.primary700,
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Invite friends",
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(
                        text =
                            when {
                                // People invited are in when they say yes (planInvites.js), as on iOS.
                                onInvite != null && plan.isAtHome ->
                                    "People you invite are in when they say yes, and see your address then."
                                onInvite != null -> "People you invite are in as soon as they say yes."
                                plan.isAtHome -> "They see the plan's card, never your address."
                                else -> "They see the plan's card and its area."
                            },
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (onInvite != null) {
                    GhostButton(title = "Invite", onClick = onInvite, modifier = Modifier.weight(1f).testTag("planPostedInvite"))
                }
                GhostButton(title = "Share link", onClick = onShare, modifier = Modifier.weight(1f))
            }
        }
        PrimaryButton(title = "See your plan", onClick = onSeePlan, modifier = Modifier.height(50.dp))
        PlanTextButton(title = "Done", onClick = onDone)
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}
