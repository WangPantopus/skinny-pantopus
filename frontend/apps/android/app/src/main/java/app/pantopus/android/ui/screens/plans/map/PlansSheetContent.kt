@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.plans.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.PlanWindow
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanHostRow
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanKindLeading
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.screens.plans.components.PlanSpotsCaption
import app.pantopus.android.ui.screens.plans.components.PlanSpotsMeter
import app.pantopus.android.ui.screens.plans.components.PlanStackButton
import app.pantopus.android.ui.screens.plans.components.PlanSwatch
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTypeTag
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

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
        mine && plan.standing == PlanViewerStanding.HOSTING -> {
            val requests = plan.requestsCount ?: 0
            if (requests > 0) {
                PlanRowEnd.Status(if (requests == 1) "1 request" else "$requests requests", PantopusIcon.Bell, PantopusColors.primary600)
            } else {
                // The subtitle already says "You're hosting" (board F2); iOS shows how many are going here too.
                PlanRowEnd.Note("${plan.goingCount} going")
            }
        }
        plan.standing == PlanViewerStanding.REQUESTED -> PlanRowEnd.Status("Requested", PantopusIcon.Clock)
        plan.standing == PlanViewerStanding.WAITLISTED ->
            PlanRowEnd.Status(plan.viewer?.waitlistPosition?.let { "On the waitlist · ${ordinal(it)}" } ?: "On the waitlist")
        plan.standing == PlanViewerStanding.IN -> PlanRowEnd.Status("You're in", PantopusIcon.Check, PantopusColors.success)
        mine -> PlanRowEnd.Chevron
        plan.planState == PlanState.LIVE -> PlanRowEnd.Note("${plan.goingCount} going")
        plan.isFull -> PlanRowEnd.Note("Full")
        plan.spotsLeft == 1 -> PlanRowEnd.Note("1 spot")
        else -> PlanRowEnd.Note("${plan.spotsLeft} spots")
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
            else -> null
        }
    return listOfNotNull(plan.planKind?.label, plan.title, PlanFormat.rowSubtitle(plan), endWords).joinToString(", ")
}

/** One plan as a row of the list. */
@Composable
internal fun PlanListRow(
    plan: PlanDto,
    first: Boolean,
    mine: Boolean,
    onOpen: (PlanDto) -> Unit,
) {
    val end = rowEnd(plan, mine)
    PlanRow(
        title = plan.title,
        subtitle = PlanFormat.rowSubtitle(plan),
        end = end,
        first = first,
        leading = { PlanKindLeading(plan.planKind) },
        spoken = rowSpoken(plan, end),
        onClick = { onOpen(plan) },
    )
}

/** The sheet at its lowest stop (board F1): "This week near you", "See all", the two soonest plans. */
@Composable
internal fun ColumnScope.PlansPeekContent(
    state: PlansMapUiState,
    onSeeAll: () -> Unit,
    onOpen: (PlanDto) -> Unit,
) {
    val all = state.mineShown + state.others
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
        if (all.isNotEmpty()) {
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
    when (state.listStatus) {
        PlansListStatus.Loading -> PlanRowsSkeleton(rows = 2)
        is PlansListStatus.Failed -> PlansFailed(state.listStatus.message, onRetry = null)
        PlansListStatus.Loaded ->
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                if (all.isEmpty()) {
                    Text(
                        text = "Nothing within 5 miles ${state.window.label.lowercase()}. Plans farther away show on the map.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(vertical = Spacing.s3),
                    )
                }
                all.take(PEEK_ROWS).forEachIndexed { index, plan ->
                    PlanListRow(plan, first = index == 0, mine = plan in state.mineShown, onOpen = onOpen)
                }
            }
    }
}

private const val PEEK_ROWS = 2

/** The list pulled up (board F2): your plans, today, tomorrow, the rest of the week, then Pulse and Connections. */
@Composable
internal fun PlansListContent(
    state: PlansMapUiState,
    onBackToMap: () -> Unit,
    onOpen: (PlanDto) -> Unit,
    onOpenPulse: () -> Unit,
    onOpenConnections: () -> Unit,
    onRetry: () -> Unit,
) {
    val sections = remember(state.others, state.mineShown) { daySections(state.others) }
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        item(key = "header") {
            PlansListHeader(state, onBackToMap)
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
                PlanListRow(plan, first = plan == plans.first(), mine = false, onOpen = onOpen)
            }
        }
        item(key = "more") {
            SectionTitle("More nearby", top = 14.dp)
            MoreNearbyRow(PantopusIcon.Megaphone, "Pulse", "Local posts and questions", first = true, onClick = onOpenPulse)
            MoreNearbyRow(PantopusIcon.Users, "Connections", "Keep up with people you know", first = false, onClick = onOpenConnections)
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
    onContentHeight: (Float) -> Unit = {},
) {
    val kind = plan.planKind ?: return
    val scroll = rememberScrollState()
    var viewport by remember { mutableIntStateOf(0) }
    // The card's whole height (what shows plus what scrolls), so the sheet can grow to show the buttons.
    LaunchedEffect(scroll) {
        snapshotFlow { viewport + scroll.maxValue }.collect { if (viewport > 0) onContentHeight(it.toFloat()) }
    }
    Column(
        modifier = Modifier.fillMaxWidth().onSizeChanged { viewport = it.height }.verticalScroll(scroll),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PlanTypeTag(kind)
            Spacer(modifier = Modifier.weight(1f))
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
        Text(
            text = plan.title,
            style = planH3,
            color = PantopusColors.appText,
            modifier = Modifier.clickable(role = Role.Button, onClick = onDetails).semantics { heading() },
        )
        Text(text = cardWhereLine(plan), style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        plan.host?.let { host ->
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
            PlanSpotsCaption(going = going, left = left, note = PlanFormat.howPeopleGetIn(plan))
            PlanSpotsMeter(spots = plan.spots, taken = plan.spots - plan.spotsLeft)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 2.dp)) {
            GhostButton(title = "Details", onClick = onDetails, modifier = Modifier.weight(1f))
            PrimaryButton(title = primaryLabel(plan), onClick = onPrimary, modifier = Modifier.weight(1f))
        }
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

/** "Sun, Oct 18 · 1:25–4:45 PM · Near Prune Hill · under 1 mi". */
internal fun cardWhereLine(plan: PlanDto): String =
    listOfNotNull(
        PlanFormat.whenLine(plan),
        plan.area?.label,
        PlanFormat.distance(plan.distanceBand),
    ).joinToString(" · ")

/** "Hosted 3 plans · 2 mutual connections" (a playdate host's playdates, from `kind_hosted`, as on iOS). */
internal fun hostCaption(plan: PlanDto): String {
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

/** The card's main button, by where the viewer stands. */
internal fun primaryLabel(plan: PlanDto): String =
    when (plan.standing) {
        PlanViewerStanding.HOSTING -> "Your plan"
        PlanViewerStanding.IN -> "You're in"
        PlanViewerStanding.REQUESTED -> "Requested"
        PlanViewerStanding.WAITLISTED -> "On the waitlist"
        else ->
            when {
                plan.planState == PlanState.ENDED || plan.planState == PlanState.CANCELLED -> "Details"
                plan.isFull || plan.viewer?.cannotAskReason == "full_use_waitlist" -> "Join the waitlist"
                else -> "Ask to join"
            }
    }

/** Nothing planned this week (board F4): a game to host if there is one, the other types, and an invite. */
@Composable
internal fun PlansEmptyContent(
    state: PlansMapUiState,
    onHost: (PlanKind, PlanGameDto?) -> Unit,
    onInvite: () -> Unit,
    onShowElsewhere: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = "Nothing planned yet", style = planH3, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
            Text(
                text = "Plans here start with one neighbor. Yours could be the first.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        state.games.firstOrNull()?.let { game -> GameSuggestion(game) { onHost(PlanKind.WATCH_PARTY, game) } }
        val others = if (state.games.isEmpty()) state.kinds else state.kinds.filter { it != PlanKind.WATCH_PARTY }
        Text(
            text = if (state.games.isEmpty()) "Start something" else "Or start something else",
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

@Composable
private fun GameSuggestion(
    game: PlanGameDto,
    onClick: () -> Unit,
) {
    val colors = PlanKind.WATCH_PARTY.colors
    val start = PlanFormat.instant(game.startsAt)?.atZone(java.time.ZoneId.systemDefault())
    val whenText =
        start?.let {
            "${it.format(DateTimeFormatter.ofPattern("EEEE", Locale.US))} at ${it.format(DateTimeFormatter.ofPattern("h:mm", Locale.US))}"
        }
    // The label ("Seahawks"), never `team`, which is the list's internal id ("seahawks").
    val title = listOfNotNull(game.label, whenText?.let { "play $it" }).joinToString(" ")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(colors.tint)
                .clickable(role = Role.Button, onClick = onClick)
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

/** No location yet (board F5). */
@Composable
internal fun PlansNoLocationContent(
    canUseHome: Boolean,
    onUseLocation: () -> Unit,
    onUseHome: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(top = Spacing.s1),
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
        PlanScopeLine("Hosts and guests never see where you are. They see a distance like \"about 1 mi\".")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.padding(top = Spacing.s1)) {
            PrimaryButton(title = "Use my location", onClick = onUseLocation, modifier = Modifier.height(50.dp))
            if (canUseHome) GhostButton(title = "Use my home instead", onClick = onUseHome, modifier = Modifier.height(50.dp))
        }
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

/** The area pill's choices. */
internal val windowChoices = listOf(PlanWindow.NOW, PlanWindow.TODAY, PlanWindow.WEEK, PlanWindow.WEEKEND)

/** Posted (board H8): the plan is on the map, with a way to invite friends. */
@Composable
internal fun PlanPostedContent(
    plan: PlanDto,
    onShare: () -> Unit,
    onSeePlan: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
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
                PlanIconTile(icon = PantopusIcon.Link, background = PantopusColors.primary100, tint = PantopusColors.primary700)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Invite friends",
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(
                        text =
                            if (plan.isAtHome) {
                                "They see the plan's card, never your address."
                            } else {
                                "They see the plan's card and its area."
                            },
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            GhostButton(title = "Share link", onClick = onShare)
        }
        PrimaryButton(title = "See your plan", onClick = onSeePlan, modifier = Modifier.height(50.dp))
        PlanTextButton(title = "Done", onClick = onDone)
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}
