@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.detail

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanAvatarStack
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanStackButton
import app.pantopus.android.ui.screens.plans.map.planH2
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * J7: you're in. The exact place, the host's note, the people going and the group chat, only for people who are
 * in. [reveal] slides "You're in" up 8 dp and fades it in (300 to 450 ms of the reveal; a crossfade under Reduce
 * Motion).
 */
@Composable
internal fun ColumnScope.PlanInBody(
    plan: PlanDto,
    reveal: Boolean,
    reduceMotion: Boolean,
    busy: Boolean,
    viewerId: String?,
    onStillComing: (Boolean) -> Unit,
    onOpenChat: () -> Unit,
) {
    val context = LocalContext.current
    if (plan.myRequest?.reconfirmNeeded == true) StillComingCard(plan, busy, onStillComing)
    InBanner(plan, reveal, reduceMotion)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = plan.title, style = planH2, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
        plan.place?.let { place ->
            Row(
                modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = if (plan.placeKind == "home") PantopusIcon.Home else PantopusIcon.MapPin,
                    contentDescription = null,
                    size = Spacing.s4,
                    tint = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(
                    text =
                        buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(place.name ?: "The place") }
                            place.address?.takeIf(String::isNotBlank)?.let { address ->
                                append(" · ")
                                append(address)
                            }
                        },
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextStrong,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        PlanInfoLine(PantopusIcon.Calendar, PlanFormat.whenLine(plan, long = true))
    }
    plan.place?.note?.takeIf(String::isNotBlank)?.let { note -> HostNote(plan, note) }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanStackButton(title = "Directions", icon = PantopusIcon.Navigation, onClick = {
            context.openDirections(plan)
        }, modifier = Modifier.weight(1f))
        PlanStackButton(
            title = "Calendar",
            icon = PantopusIcon.Calendar,
            onClick = { context.addToCalendar(plan) },
            modifier = Modifier.weight(1f),
            spoken = "Add to calendar",
        )
        if (plan.chatRoomId != null) {
            PlanStackButton(title = "Group chat", icon = PantopusIcon.MessageCircle, onClick = onOpenChat, modifier = Modifier.weight(1f))
        }
    }
    PeopleLine(plan, viewerId)
}

@Composable
private fun InBanner(
    plan: PlanDto,
    reveal: Boolean,
    reduceMotion: Boolean,
) {
    val progress = remember { Animatable(if (reveal) 0f else 1f) }
    LaunchedEffect(reveal) {
        if (!reveal) return@LaunchedEffect
        progress.snapTo(0f)
        if (!reduceMotion) kotlinx.coroutines.delay(300)
        progress.animateTo(1f, tween(150))
    }
    val mine = plan.myRequest
    // "Sam said yes · just now" (board J7), "· 12 min ago" later; a rule's yes gets its time too, as on iOS.
    val said = if (mine?.decidedBy == "rule") "You got in right away" else "${plan.hostFirst} said yes"
    val subtitle = listOfNotNull(said, PlanFormat.ago(mine?.decidedAt)).joinToString(" · ")
    PlanBanner(
        title = "You're in",
        subtitle = subtitle,
        icon = PantopusIcon.Check,
        tone = PlanBannerTone.Ok,
        modifier =
            Modifier.graphicsLayer {
                alpha = progress.value
                translationY = if (reduceMotion) 0f else (1f - progress.value) * 8.dp.toPx()
            },
    )
}

@Composable
private fun HostNote(
    plan: PlanDto,
    note: String,
) {
    val kind = plan.planKind
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(kind?.colors?.tint ?: PantopusColors.appSurfaceSunken)
                .padding(14.dp)
                .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PlanLockLine("From ${plan.hostFirst}, only for people who are in")
        Text(text = note, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}

/** "Sam (host), you + 1, Alex + 1, Jordan and 2 more", with their initials: parties and up to 4 names, as on iOS. */
@Composable
private fun PeopleLine(
    plan: PlanDto,
    viewerId: String?,
) {
    val people = plan.people.orEmpty()
    if (people.isEmpty()) return
    val myParty = plan.myRequest?.partySize ?: 1
    val you = if (plan.isPlaydate || myParty <= 1) "you" else "you + ${myParty - 1}"
    val names =
        people
            .map { person ->
                val first = PlanFormat.firstName(person.displayName)
                when {
                    viewerId != null && person.userId == viewerId -> you
                    person.isHost -> "$first (host)"
                    person.partySize > 1 -> "$first + ${person.partySize - 1}"
                    else -> first
                }
            }.toMutableList()
    // The server lists everyone in; if this phone's account isn't among them yet, "you" still goes after the host.
    if (you !in names) names.add(if (people.firstOrNull()?.isHost == true) 1 else 0, you)
    val shown = names.take(4)
    val rest = names.size - shown.size
    val line =
        when {
            rest > 0 -> shown.joinToString(", ") + " and $rest more"
            shown.size > 1 -> shown.dropLast(1).joinToString(", ") + " and " + shown.last()
            else -> shown.joinToString()
        }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        PlanAvatarStack(names = people.take(4).map { it.displayName to it.userId })
        Text(text = line, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary, modifier = Modifier.weight(1f))
    }
}

/** "Sam moved the watch party. Still coming?" with its two answers (the in-app side of the H11 push). */
@Composable
private fun StillComingCard(
    plan: PlanDto,
    busy: Boolean,
    onAnswer: (Boolean) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.warningBg)
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "${plan.hostFirst} moved the ${PlanFormat.noun(plan)}",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        Text(
            text = "Now ${PlanFormat.dayAt(plan)}. Still coming?",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GhostButton(title = "Can't make it", onClick = { onAnswer(false) }, modifier = Modifier.weight(1f), isEnabled = !busy)
            PrimaryButton(title = "Still coming", onClick = { onAnswer(true) }, modifier = Modifier.weight(1f), isLoading = busy)
        }
    }
}
