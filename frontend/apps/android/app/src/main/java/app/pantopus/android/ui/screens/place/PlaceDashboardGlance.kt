@file:OptIn(ExperimentalFoundationApi::class)

package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.place.AirQualityCategory
import app.pantopus.android.data.api.models.place.BallotGovernments
import app.pantopus.android.data.api.models.place.BenchmarkComparison
import app.pantopus.android.data.api.models.place.ExemptionFilingStatus
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.screens.ballot.BallotPlacement
import app.pantopus.android.ui.screens.ballot.BallotSeasonBlock
import app.pantopus.android.ui.screens.place.components.PlaceEvidenceLine
import app.pantopus.android.ui.screens.place.components.PlaceGlanceGroupRow
import app.pantopus.android.ui.screens.place.components.PlaceGlanceHeading
import app.pantopus.android.ui.screens.place.components.PlaceGlanceOpenLink
import app.pantopus.android.ui.screens.place.components.PlaceHairline
import app.pantopus.android.ui.screens.place.components.PlaceHeroCard
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceSystemsTimeline
import app.pantopus.android.ui.screens.place.components.WorthItem
import app.pantopus.android.ui.screens.place.components.placeEvidenceResult
import app.pantopus.android.ui.screens.place.components.placeSurface
import app.pantopus.android.ui.screens.place.detail.isLive
import app.pantopus.android.ui.screens.place.detail.section
import app.pantopus.android.ui.screens.place.messaging.PlaceMessagesActionRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/** "Worth a look" shows at most three items (TPR brief 6.5). */
private const val WORTH_MAX = 3

/** A group's summary names its first two topics, then how many more there are. */
private const val SUMMARY_TOPICS = 2

/** Above this many unavailable sections the glance says once that some information isn't available yet. */
private const val UNAVAILABLE_NOTE_FROM = 3

/** The seven groups of "Your home at a glance" (TPR brief 6.6), in order, with the existing page each opens. */
internal enum class GlanceGroup(
    val key: String,
    val title: String,
    val icon: PantopusIcon,
    val page: PlaceDetailGroup,
) {
    TODAY("today", "Today at this address", PantopusIcon.CloudSun, PlaceDetailGroup.TODAY),
    HOME("home", "Home and systems", PantopusIcon.Home, PlaceDetailGroup.YOUR_HOME),
    RISK("risk", "Risk and environment", PantopusIcon.ShieldAlert, PlaceDetailGroup.RISK),
    BLOCK("block", "Your block", PantopusIcon.Users, PlaceDetailGroup.BLOCK),
    COSTS("costs", "Home costs", PantopusIcon.Receipt, PlaceDetailGroup.MONEY),
    CIVIC("civic", "Civic", PantopusIcon.Landmark, PlaceDetailGroup.CIVIC),
    IDENTITY("identity", "Identity and access", PantopusIcon.IdCard, PlaceDetailGroup.IDENTITY),
    ;

    companion object {
        fun of(group: PlaceGroup): GlanceGroup? =
            when (group) {
                PlaceGroup.TODAY -> TODAY
                PlaceGroup.YOUR_HOME -> HOME
                PlaceGroup.RISK_READINESS, PlaceGroup.HEALTH_ENVIRONMENT -> RISK
                PlaceGroup.YOUR_BLOCK -> BLOCK
                PlaceGroup.MONEY_SIGNALS -> COSTS
                PlaceGroup.CIVIC -> CIVIC
                PlaceGroup.IDENTITY -> IDENTITY
                PlaceGroup.UNKNOWN -> null
            }
    }
}

/** What the glance needs beyond the Place itself: who is looking, the dashboard's actions, and the ballot. */
internal class GlanceActions(
    val claimInReview: Boolean,
    val showsVerify: Boolean,
    val onOpenDetail: (PlaceDetailGroup) -> Unit,
    val onOpenPulse: () -> Unit,
    val onVerify: (() -> Unit)?,
    val onRetry: (() -> Unit)?,
    val onOpenPrivacyMirror: () -> Unit,
    val onOpenGovernments: (BallotGovernments) -> Unit,
    val ballotRequester: BringIntoViewRequester,
)

/**
 * "Your home at a glance" (TPR brief 6.6): the seven folded groups on one light surface, each with a one-line summary
 * from real values; open, a group shows its existing rows (each still opening its page, locked rows with their reason
 * and button) and "Open <page>". Unknown groups from a newer server keep their own row with the server's label.
 */
@Composable
@Suppress("LongMethod", "CyclomaticComplexMethod")
internal fun PlaceGlanceSection(
    intel: PlaceIntelligence,
    openGroups: Set<String>,
    onToggle: (String) -> Unit,
    actions: GlanceActions,
    modifier: Modifier = Modifier,
) {
    val zone = intel.homeZone
    val serverGroups = BallotPlacement.groups(intel)
    val sectionsByGlance = GlanceGroup.entries.associateWith { g -> serverGroups.filter { GlanceGroup.of(it.groupId) == g } }
    val unknown = serverGroups.filter { GlanceGroup.of(it.groupId) == null && it.sections.isNotEmpty() }
    val ballot = BallotPlacement.ballot(intel)
    val unavailable =
        serverGroups.flatMap { it.sections }.count { it.status == PlaceSectionStatus.UNAVAILABLE || it.status == PlaceSectionStatus.ERROR }
    val shown =
        GlanceGroup.entries.filter { g ->
            when (g) {
                GlanceGroup.TODAY -> true
                GlanceGroup.CIVIC -> ballot != null || sectionsByGlance.getValue(g).any { it.sections.isNotEmpty() }
                GlanceGroup.IDENTITY -> !actions.claimInReview || sectionsByGlance.getValue(g).any { it.sections.isNotEmpty() }
                else -> sectionsByGlance.getValue(g).any { it.sections.isNotEmpty() }
            }
        }
    Column(modifier = modifier.fillMaxWidth().testTag("place.glance")) {
        PlaceGlanceHeading(Modifier.padding(bottom = 8.dp))
        if (unavailable >= UNAVAILABLE_NOTE_FROM) {
            Text(
                "Some information isn't available for this address yet.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(start = 2.dp, bottom = 8.dp).testTag("place.glance.coverage"),
            )
        }
        Column(modifier = Modifier.fillMaxWidth().placeSurface()) {
            shown.forEachIndexed { index, group ->
                if (index > 0) PlaceHairline()
                val sections = sectionsByGlance.getValue(group).flatMap { it.sections }
                PlaceGlanceGroupRow(
                    icon = group.icon,
                    title = group.title,
                    summary = glanceSummary(group, intel, sections, zone, actions),
                    open = group.key in openGroups,
                    onToggle = { onToggle(group.key) },
                    testTag = "place.glance.${group.key}",
                ) {
                    GlanceGroupBody(group, intel, sections, zone, actions)
                }
            }
            unknown.forEach { block ->
                PlaceHairline()
                val key = "server.${block.group}"
                PlaceGlanceGroupRow(
                    icon = PantopusIcon.LayoutGrid,
                    title = block.label,
                    summary = topicsSummary(block.sections, zone),
                    open = key in openGroups,
                    onToggle = { onToggle(key) },
                    testTag = "place.glance.$key",
                ) {
                    SectionRows(block.sections, onOpen = null, actions = actions, intel = intel, zone = zone, evidence = false)
                }
            }
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun GlanceGroupBody(
    group: GlanceGroup,
    intel: PlaceIntelligence,
    sections: List<PlaceSectionEnvelope>,
    zone: ZoneId?,
    actions: GlanceActions,
) {
    val openPage = { actions.onOpenDetail(group.page) }
    if (group == GlanceGroup.TODAY) {
        // Today's Pulse, as on the dashboard before: chip, headline and nudge; a claim's opens this address's Today.
        val pulse = PlacePresentation.derivePulse(intel)
        PlaceHeroCard(
            variant = pulse.variant,
            chip = pulse.chip,
            heroIcon = pulse.heroIcon,
            headline = pulse.title,
            nudgeIcon = pulse.nudgeIcon,
            nudgeText = pulse.nudgeText.orEmpty(),
            onTap = if (actions.claimInReview) openPage else actions.onOpenPulse,
        )
        if (!actions.claimInReview) PlaceGlanceOpenLink("Open Pulse", actions.onOpenPulse, Modifier.testTag("place.glance.openPulse"))
        PlaceHairline()
    }
    SectionRows(sections, onOpen = openPage, actions = actions, intel = intel, zone = zone, evidence = group == GlanceGroup.RISK)
    if (group == GlanceGroup.HOME) {
        intel.section(PlaceSectionId.HOME_SYSTEMS)?.takeIf { it.isLive() }?.homeSystems?.systems?.takeIf { it.isNotEmpty() }?.let {
            PlaceHairline()
            PlaceSystemsTimeline(it, compact = true, modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp))
        }
    }
    if (group == GlanceGroup.CIVIC) {
        BallotPlacement.ballot(intel)?.let { placed ->
            if (sections.isNotEmpty()) PlaceHairline()
            Column(modifier = Modifier.bringIntoViewRequester(actions.ballotRequester).padding(16.dp).testTag("place.glance.ballot")) {
                BallotSeasonBlock(
                    placed = placed,
                    onOpenGovernments = placed.card.governments?.let { governments -> { actions.onOpenGovernments(governments) } },
                )
            }
        }
    }
    if (group == GlanceGroup.IDENTITY) IdentityRows(sections.isNotEmpty(), actions)
    PlaceHairline()
    PlaceGlanceOpenLink("Open ${group.page.title}", openPage, Modifier.testTag("place.glance.${group.key}.open"))
}

/** A group's section rows, flat on its surface; Risk and environment adds each reading's area and evidence. */
@Composable
private fun SectionRows(
    sections: List<PlaceSectionEnvelope>,
    onOpen: (() -> Unit)?,
    actions: GlanceActions,
    intel: PlaceIntelligence,
    zone: ZoneId?,
    evidence: Boolean,
) {
    // The same verify handler the rows had before (none for a claim in review or a claimed home that can't verify).
    val onVerify = actions.onVerify
    sections.forEachIndexed { index, env ->
        if (index > 0) PlaceHairline()
        Column {
            PlaceSectionView(
                env = env,
                onOpen = onOpen,
                onVerify = onVerify,
                onClaim = onVerify,
                onRetry = actions.onRetry,
                verifiesFirst = intel.verifiesFirst,
            )
            if (evidence) PlaceEvidenceLine(env, zone, Modifier.padding(start = 66.dp, end = 16.dp, bottom = 12.dp))
        }
    }
}

/** Residency letters and passes, the locked-until-verified items, and what neighbors see (not for a claim). */
@Composable
private fun IdentityRows(
    afterSections: Boolean,
    actions: GlanceActions,
) {
    if (actions.claimInReview) return
    if (afterSections) PlaceHairline()
    PlaceMessagesActionRow(
        icon = PantopusIcon.IdCard,
        title = "Residency letters & passes",
        subtitle = "Prove where you live, on your terms.",
        onTap = { actions.onOpenDetail(PlaceDetailGroup.IDENTITY) },
        modifier = Modifier.testTag("place.identityEntry"),
    )
    val verify = actions.onVerify
    if (actions.showsVerify && verify != null) {
        PlaceVerifyLockedItems(verify)
    }
    PlaceHairline()
    PlaceMessagesActionRow(
        icon = PantopusIcon.Eye,
        title = "What neighbors see",
        subtitle = "Private by default. See this address as a neighbor does.",
        onTap = actions.onOpenPrivacyMirror,
        modifier = Modifier.testTag("place.glance.privacyMirror"),
    )
}

/** "Locked until you verify": each item with its reason and "Verify address". */
@Composable
private fun PlaceVerifyLockedItems(onVerify: () -> Unit) {
    PlaceHairline()
    Text(
        "Locked until you verify",
        fontSize = 12.5.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(start = 16.dp, top = 12.dp),
    )
    PlacePresentation.verifyLockedItems.forEach { item ->
        PlaceLockedCard(title = item.title, reason = item.reason, cta = "Verify address", icon = item.icon, onTap = onVerify)
    }
}

/** One line from real values for each group (the TPR wording agreed with iPhone). */
private fun glanceSummary(
    group: GlanceGroup,
    intel: PlaceIntelligence,
    sections: List<PlaceSectionEnvelope>,
    zone: ZoneId?,
    actions: GlanceActions,
): String =
    when (group) {
        GlanceGroup.TODAY -> todaySummary(intel)
        GlanceGroup.HOME -> homeSummary(intel, sections, zone)
        GlanceGroup.IDENTITY ->
            listOfNotNull(
                topicsSummary(sections, zone).takeIf { sections.isNotEmpty() },
                "Residency letters & passes".takeUnless { actions.claimInReview },
                "locked until you verify".takeIf { actions.showsVerify },
                "what neighbors see".takeUnless { actions.claimInReview },
            ).joinToString(" · ")
        GlanceGroup.CIVIC ->
            listOfNotNull(
                topicsSummary(sections, zone).takeIf { sections.isNotEmpty() },
                BallotPlacement.ballot(intel)?.let { "ballot season" },
            ).joinToString(" · ")
        else -> topicsSummary(sections, zone)
    }

/** "39° partly cloudy · air 76 moderate · 1 weather alert" (or "no active weather alerts", "weather alerts unavailable"). */
private fun todaySummary(intel: PlaceIntelligence): String {
    val weather =
        intel.section(PlaceSectionId.WEATHER)?.takeIf { it.isLive() }?.weather?.let {
            "${it.currentTempF.roundToInt()}° ${it.conditionLabel.lowercase(Locale.US)}"
        }
    val air =
        intel.section(PlaceSectionId.AIR_QUALITY)?.takeIf { it.isLive() }?.airQuality
            ?.takeIf { it.category != AirQualityCategory.UNKNOWN }
            ?.let { "air ${it.index} ${it.categoryLabel.lowercase(Locale.US)}" }
    val alertsEnv = intel.section(PlaceSectionId.ALERTS)
    val alerts =
        when {
            alertsEnv == null -> null
            alertsEnv.isLive() ->
                when (val n = alertsEnv.alerts?.active?.size ?: 0) {
                    0 -> "no active weather alerts"
                    1 -> "1 weather alert"
                    else -> "$n weather alerts"
                }
            else -> "weather alerts unavailable"
        }
    val line = listOfNotNull(weather, air, alerts).joinToString(" · ")
    return line.ifEmpty { "weather, air and alerts aren't available here yet" }.replaceFirstChar { it.uppercase(Locale.US) }
}

/** "Built 2011 · 2,858 sq ft · 2 beyond typical range" (or "N install years unknown"), else the topics. */
private fun homeSummary(
    intel: PlaceIntelligence,
    sections: List<PlaceSectionEnvelope>,
    zone: ZoneId?,
): String {
    val home = intel.section(PlaceSectionId.YOUR_HOME)?.takeIf { it.isLive() }?.yourHome
    val systems = intel.section(PlaceSectionId.HOME_SYSTEMS)?.takeIf { it.isLive() }?.homeSystems?.systems.orEmpty()
    val beyond = systems.count { it.status == "past_expected" }
    val unknown = systems.count { it.installedYear == null }
    val parts =
        listOfNotNull(
            home?.yearBuilt?.let { "Built $it" },
            home?.sqft?.let { "${PlacePresentation.grouped(it)} sq ft" },
            beyond.takeIf { it > 0 }?.let { "$it beyond typical range" },
            unknown.takeIf { it > 0 && beyond == 0 }?.let { if (it == 1) "1 install year unknown" else "$it install years unknown" },
        )
    return parts.joinToString(" · ").ifEmpty { topicsSummary(sections, zone) }
}

/** "Flood: Minimal risk · Earthquake: Design category D · 5 more topics", each topic's own result or state. */
private fun topicsSummary(
    sections: List<PlaceSectionEnvelope>,
    zone: ZoneId?,
): String {
    if (sections.isEmpty()) return "Nothing here for this address yet"
    val named = sections.take(SUMMARY_TOPICS).map { "${PlacePresentation.config(it.sectionId).title}: ${placeEvidenceResult(it, zone)}" }
    val more = sections.size - SUMMARY_TOPICS
    return (named + listOfNotNull(more.takeIf { it > 0 }?.let { if (it == 1) "1 more topic" else "$it more topics" })).joinToString(" · ")
}

/**
 * "Worth a look" (TPR brief 6.5), most consequential first: [changes] (since the last visit), systems beyond or nearing a
 * typical range, household tasks overdue or due today that this viewer can read, a homestead exemption the county
 * record doesn't show, a bill above similar homes. At most three; empty when nothing applies.
 */
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod")
internal fun placeWorthItems(
    intel: PlaceIntelligence,
    tasks: List<HomeTaskDto>,
    changes: List<WorthItem>,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    onOpenTask: ((String) -> Unit)?,
    onOpenTasks: (() -> Unit)?,
): List<WorthItem> {
    val zone = intel.homeZone ?: ZoneId.systemDefault()
    val items = changes.toMutableList()
    intel.section(PlaceSectionId.HOME_SYSTEMS)?.takeIf { it.isLive() }?.homeSystems?.systems?.let { systems ->
        val beyond = systems.filter { it.status == "past_expected" }
        val nearing = systems.filter { it.status == "aging" }
        val title =
            when {
                beyond.size > 1 -> "${beyond.size} systems beyond their typical range"
                beyond.size == 1 -> "${beyond.first().label} is beyond its typical range"
                nearing.size > 1 -> "${nearing.size} systems nearing their typical range"
                nearing.size == 1 -> "${nearing.first().label} is nearing its typical range"
                else -> null
            }
        title?.let {
            items +=
                WorthItem(
                    key = "systems",
                    title = it,
                    detail = "Age isn't condition. See install years, how each is known and service dates.",
                    icon = PantopusIcon.Wrench,
                    onOpen = { onOpenDetail(PlaceDetailGroup.YOUR_HOME) },
                )
        }
    }
    val today = LocalDate.now(zone)
    val open = tasks.filter { it.status.lowercase(Locale.US) in setOf("open", "in_progress") }
    val dated = open.mapNotNull { task -> PlanFormat.instant(task.dueAt)?.atZone(zone)?.let { task to it } }
    val overdue = dated.filter { (_, due) -> due.toLocalDate() < today }.sortedBy { it.second }
    val dueToday = dated.filter { (_, due) -> due.toLocalDate() == today }.sortedBy { it.second }
    when {
        overdue.size > 1 ->
            items +=
                WorthItem(
                    key = "tasks.overdue",
                    title = "${overdue.size} overdue household tasks",
                    detail = "The oldest was due ${overdue.first().second.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))}",
                    icon = PantopusIcon.ListChecks,
                    onOpen = onOpenTasks,
                )
        overdue.size == 1 -> {
            val (task, due) = overdue.first()
            items +=
                WorthItem(
                    key = "task.${task.id}",
                    title = "Overdue: ${task.title}",
                    detail = "Was due ${due.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))} · household task",
                    icon = PantopusIcon.ListChecks,
                    onOpen = onOpenTask?.let { open -> { open(task.id) } },
                )
        }
    }
    dueToday.firstOrNull()?.let { (task, due) ->
        val clock = due.format(DateTimeFormatter.ofPattern(if (due.minute == 0) "h a" else "h:mm a", Locale.US))
        items +=
            WorthItem(
                key = "task.${task.id}",
                title = "Due today: ${task.title}",
                detail = "Due $clock · household task",
                icon = PantopusIcon.ListChecks,
                onOpen = onOpenTask?.let { open -> { open(task.id) } },
            )
    }
    intel.section(PlaceSectionId.EXEMPTION_CHECK)?.takeIf { it.isLive() }?.exemptionCheck
        ?.takeIf { it.filingStatus == ExemptionFilingStatus.NONE_ON_FILE }
        ?.let {
            items +=
                WorthItem(
                    key = "exemption",
                    title = "No homestead exemption on file",
                    detail = "The county record shows none. Worth checking whether this home qualifies.",
                    icon = PantopusIcon.Receipt,
                    onOpen = { onOpenDetail(PlaceDetailGroup.MONEY) },
                )
        }
    intel.section(PlaceSectionId.BILL_BENCHMARK)?.takeIf { it.isLive() }
        ?.takeIf { it.billBenchmark?.comparison == BenchmarkComparison.HIGHER }
        ?.let { env ->
            val reading = PlacePresentation.reading(env, intel.homeZone)
            items +=
                WorthItem(
                    key = "bill",
                    title = reading.value ?: "Your bill is above similar homes",
                    detail = "Worth a look: see how it compares.",
                    icon = PantopusIcon.Receipt,
                    onOpen = { onOpenDetail(PlaceDetailGroup.MONEY) },
                )
        }
    return items.distinctBy { it.key }.take(WORTH_MAX)
}
