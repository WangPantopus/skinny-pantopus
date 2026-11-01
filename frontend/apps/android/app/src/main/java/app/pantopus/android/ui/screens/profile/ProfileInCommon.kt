@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.profile.ProfileContributions
import app.pantopus.android.data.api.models.profile.ProfileInCommonResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * PRF step 4 (`Main.dc.html`): "You and <name>", what you share with someone (plans, Support Trains, connections,
 * skills; at most two lines), and About's "Around the neighborhood" (only the counts that aren't zero). Both read SRV-1
 * and hide whenever the server sends nothing (an older server, a 503, an empty answer).
 */

/** Where a "You and …" line goes when tapped. */
internal sealed interface InCommonTarget {
    data class Plan(
        val id: String,
    ) : InCommonTarget

    data class SupportTrain(
        val id: String,
    ) : InCommonTarget
}

/** What you share with someone, and whose ids it was read for: the plan line says who hosts. */
internal data class ProfileInCommon(
    val response: ProfileInCommonResponse,
    val personId: String,
    val viewerId: String,
)

/** One "You and …" line: what you share (the shared thing in bold), a muted detail, where it opens (null: nowhere). */
internal data class InCommonLine(
    val kind: Kind,
    val text: AnnotatedString,
    val detail: String? = null,
    val target: InCommonTarget? = null,
) {
    enum class Kind { Plans, SupportTrains, Connections, Skills }
}

/**
 * At most two lines, one per kind, the first two kinds that exist in the brief's order: the soonest plan, the first
 * Support Train, people you both know, shared skills. The words match web and iOS (QUESTIONS.md, 11:55Z).
 */
internal fun inCommonLines(
    inCommon: ProfileInCommon,
    firstName: String,
    zone: ZoneId = ZoneId.systemDefault(),
): List<InCommonLine> {
    val shared = inCommon.response
    val plan = shared.plans.firstOrNull { !it.title.isNullOrBlank() }
    val train = shared.supportTrains.firstOrNull { !it.title.isNullOrBlank() }
    val connections = shared.connections
    // First names, as the drawing's "You both know Ava, Ben and 1 other".
    val people = connections?.people.orEmpty().mapNotNull { it.name?.trim()?.split(" ")?.firstOrNull()?.takeIf(String::isNotEmpty) }
    return listOfNotNull(
        plan?.let {
            val before =
                when (it.hostId) {
                    inCommon.viewerId -> "$firstName's going to your "
                    inCommon.personId -> "You're going to $firstName's "
                    else -> "You're both going to "
                }
            InCommonLine(
                InCommonLine.Kind.Plans,
                emphasized(before, it.title.orEmpty().trim()),
                detail = planStart(it.startsAt, zone),
                target = InCommonTarget.Plan(it.id),
            )
        },
        train?.let {
            InCommonLine(
                InCommonLine.Kind.SupportTrains,
                emphasized("You both signed up to help with ", it.title.orEmpty().trim()),
                target = InCommonTarget.SupportTrain(it.id),
            )
        },
        connections?.takeIf { it.count > 0 && people.isNotEmpty() }?.let {
            InCommonLine(InCommonLine.Kind.Connections, peopleLine(people, it.count))
        },
        shared.skills.filter { it.isNotBlank() }.takeIf { it.isNotEmpty() }?.let {
            InCommonLine(InCommonLine.Kind.Skills, emphasized("You both help with ", joinAnd(it.take(3))))
        },
    ).take(IN_COMMON_LINES)
}

private const val IN_COMMON_LINES = 2

private val PLAN_START = DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US)

private fun planStart(
    startsAt: String?,
    zone: ZoneId,
): String? = startsAt?.let { runCatching { PLAN_START.format(Instant.parse(it).atZone(zone)) }.getOrNull() }

private fun emphasized(
    before: String,
    bold: String,
): AnnotatedString =
    buildAnnotatedString {
        append(before)
        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(bold) }
    }

/** "You both know **Ava** and **Ben**", "…, **Ben** and 1 other". */
private fun peopleLine(
    names: List<String>,
    count: Int,
): AnnotatedString {
    val others = count - names.size
    return buildAnnotatedString {
        append("You both know ")
        names.forEachIndexed { index, name ->
            if (index > 0) append(if (index == names.lastIndex && others <= 0) " and " else ", ")
            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(name) }
        }
        if (others > 0) append(" and $others ${if (others == 1) "other" else "others"}")
    }
}

private fun joinAnd(words: List<String>): String =
    when (words.size) {
        0 -> ""
        1 -> words[0]
        else -> words.dropLast(1).joinToString(", ") + " and " + words.last()
    }

/** Reads "You and …" for someone else's profile; hides it on any failure (a 503 included). */
internal class ProfileInCommonLoader(
    private val scope: CoroutineScope,
    private val profiles: ProfileRepository,
) {
    private val _state = MutableStateFlow<ProfileInCommon?>(null)
    val state: StateFlow<ProfileInCommon?> = _state.asStateFlow()
    private var job: Job? = null

    fun load(
        personId: String,
        viewerId: String,
    ) {
        job?.cancel()
        job =
            scope.launch {
                val shared = (profiles.inCommon(personId) as? NetworkResult.Success)?.data
                _state.value = shared?.let { ProfileInCommon(it, personId, viewerId) }
            }
    }

    /** A block or a disconnect: nothing shared stays on screen while the read comes back. */
    fun clear() {
        job?.cancel()
        _state.value = null
    }
}

/** "You and Rowan": the shared people's photos, then at most two lines. Hidden when there's nothing in common. */
@Composable
internal fun YouAndCard(
    firstName: String,
    inCommon: ProfileInCommon?,
    onOpen: (InCommonTarget) -> Unit,
) {
    val lines = inCommon?.let { inCommonLines(it, firstName) }.orEmpty()
    if (lines.isEmpty()) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                // The page's inset, as About and the header use.
                .padding(start = Spacing.s5, end = Spacing.s5, top = Spacing.s5)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(vertical = Spacing.s2)
                .testTag("profileYouAnd"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "You and $firstName",
                fontSize = 17.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            inCommon?.response?.connections?.takeIf { lines.any { it.kind == InCommonLine.Kind.Connections } }?.let { shared ->
                SharedPeople(people = shared.people.map { it.id to it.name.orEmpty() }, extra = shared.count - shared.people.size)
            }
        }
        lines.forEach { line -> YouAndLine(line = line, onOpen = onOpen) }
    }
}

/** Up to two shared people's initials or photos, then "+N" for the rest; the line beside it names them. */
@Composable
private fun SharedPeople(
    people: List<Pair<String, String>>,
    extra: Int,
) {
    Row(modifier = Modifier.clearAndSetSemantics { }, verticalAlignment = Alignment.CenterVertically) {
        people.take(2).forEachIndexed { index, (id, name) ->
            Box(modifier = Modifier.offset(x = (-8 * index).dp).border(2.dp, PantopusColors.appSurface, CircleShape)) {
                ProfileAvatar(name = name, photoUrl = null, seed = id, size = 28.dp)
            }
        }
        if (extra > 0) {
            Box(
                modifier =
                    Modifier
                        .offset(x = (-8 * people.take(2).size).dp)
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "+$extra", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextStrong)
            }
        }
    }
}

@Composable
private fun YouAndLine(
    line: InCommonLine,
    onOpen: (InCommonTarget) -> Unit,
) {
    val icon =
        when (line.kind) {
            InCommonLine.Kind.Plans -> PantopusIcon.Calendar
            InCommonLine.Kind.SupportTrains -> PantopusIcon.Heart
            InCommonLine.Kind.Connections -> PantopusIcon.Users
            InCommonLine.Kind.Skills -> PantopusIcon.Hand
        }
    val target = line.target
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .then(if (target != null) Modifier.clickable(role = Role.Button) { onOpen(target) } else Modifier)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.primary600)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = line.text, fontSize = 15.sp, lineHeight = 20.sp, color = PantopusColors.appText)
            line.detail?.let { Text(text = it, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted) }
        }
        if (target != null) {
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

/** About's "Around the neighborhood": only the counts above zero; hidden when none are. */
@Composable
internal fun AroundTheNeighborhood(
    firstName: String,
    contributions: ProfileContributions?,
) {
    val rows = aroundRows(firstName, contributions ?: return)
    if (rows.isEmpty()) return
    Column {
        AboutHeading("Around the neighborhood")
        AboutCard(tag = "publicProfileAboutAround") {
            rows.forEachIndexed { index, row ->
                if (index > 0) AboutDivider()
                AboutRow(row)
            }
        }
    }
}

internal fun aroundRows(
    firstName: String,
    contributions: ProfileContributions,
): List<AboutRowSpec> {
    fun count(
        n: Int?,
        one: String,
        many: String,
    ) = n?.takeIf { it > 0 }?.let { if (it == 1) one else many.replace("#", "$it") }
    return listOfNotNull(
        count(contributions.supportTrainsHelped, "Helped on 1 Support Train", "Helped on # Support Trains")?.let {
            AboutRowSpec(icon = PantopusIcon.Heart, title = it)
        },
        count(contributions.plansHosted, "Hosted 1 plan", "Hosted # plans")?.let {
            AboutRowSpec(icon = PantopusIcon.Calendar, title = it)
        },
        count(
            contributions.helpfulMarks,
            "Neighbors marked $firstName's posts helpful once",
            "Neighbors marked $firstName's posts helpful # times",
        )?.let { AboutRowSpec(icon = PantopusIcon.ThumbsUp, title = it) },
    )
}
