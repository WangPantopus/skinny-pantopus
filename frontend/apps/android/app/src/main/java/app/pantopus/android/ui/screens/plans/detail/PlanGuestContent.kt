@file:Suppress("MagicNumber", "TooManyFunctions", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.plans.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.KidsAgeBand
import app.pantopus.android.data.plans.PlanCannotAsk
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanRequestStatus
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.hostApproves
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanHostRow
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanNote
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanSpotsCaption
import app.pantopus.android.ui.screens.plans.components.PlanSpotsMeter
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTypeTag
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.map.PlanListRow
import app.pantopus.android.ui.screens.plans.map.hostCaption
import app.pantopus.android.ui.screens.plans.map.planH2
import app.pantopus.android.ui.screens.plans.map.planH4
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** The host's first name for sentences ("Sam approves each person"). */
internal val PlanDto.hostFirst: String get() = PlanFormat.firstName(host?.displayName)

/** "within an hour": how fast the host usually answers (iOS's table), or null with too little history. */
internal fun answerTime(plan: PlanDto): String? {
    val minutes = plan.host?.typicalAnswerMinutes ?: return null
    return when {
        minutes < 20 -> "within minutes"
        minutes < 75 -> "within an hour"
        minutes < 180 -> "within a few hours"
        minutes < 24 * 60 -> "within a day"
        else -> "in a day or two"
    }
}

/** "Near Prune Hill · under 1 mi · at Sam's place" (or "a public place"). */
internal fun whereLine(plan: PlanDto): String {
    val at =
        when {
            plan.placeKind == "home" -> "at ${plan.hostFirst}'s place"
            else -> "a public place"
        }
    return listOfNotNull(plan.area?.label, PlanFormat.distance(plan.distanceBand), at).joinToString(" · ")
}

/** "Casual · extra paddles", "Easy pace · dogs welcome" (board J6, as on iOS): the per-type facts, or null. */
internal fun detailsLine(plan: PlanDto): String? {
    val d = plan.details ?: return null
    val parts =
        when (plan.planKind) {
            PlanKind.PICKUP_GAME ->
                listOfNotNull(
                    when (d.level) {
                        "casual" -> "Casual"
                        "competitive" -> "Competitive"
                        "any" -> "Any level"
                        else -> null
                    },
                    if (d.extraGear == true) "extra ${extraGearWord(d.sport)}" else null,
                )
            PlanKind.WALK_COFFEE ->
                listOfNotNull(
                    when (d.pace) {
                        "easy" -> "Easy pace"
                        "brisk" -> "Brisk pace"
                        else -> null
                    },
                    if (d.dogsWelcome == true) "dogs welcome" else null,
                )
            else -> emptyList()
        }
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

/** "paddles", "rackets", "balls" or "gear": what a pickup host brings extra (H4 "I have extra paddles"). */
internal fun extraGearWord(sport: String?): String =
    when (sport) {
        "pickleball" -> "paddles"
        "tennis" -> "rackets"
        "basketball", "soccer", "volleyball" -> "balls"
        else -> "gear"
    }

/** The type tag and the title (h2). */
@Composable
internal fun PlanHeading(plan: PlanDto) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        plan.planKind?.let { PlanTypeTag(it) }
        Text(text = plan.title, style = planH2, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
    }
}

/** The heading, then when and where (and the kids' ages for a playdate), as iOS's title block. */
@Composable
internal fun PlanTitleBlock(plan: PlanDto) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanHeading(plan)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PlanInfoLine(PantopusIcon.Calendar, PlanFormat.whenLine(plan, long = true))
            PlanInfoLine(PantopusIcon.MapPin, whereLine(plan))
            if (plan.isPlaydate) {
                KidsAgeBand.rangeLabel(plan.details?.kidsAgeBands)?.let { PlanInfoLine(PantopusIcon.AdultChild, "Kids $it") }
            }
        }
    }
}

/** The host in a card, with how people get in under the name when [ruleCaption] is set. */
@Composable
internal fun PlanHostCard(
    plan: PlanDto,
    ruleCaption: String? = null,
) {
    val host = plan.host ?: return
    PlanHostRow(
        name = host.displayName ?: "Neighbor",
        verified = host.verifiedAddress && ruleCaption == null,
        caption = ruleCaption ?: hostCaption(plan),
        seed = host.userId,
        avatarUrl = host.avatarUrl,
        modifier = Modifier.planCard().padding(14.dp),
    )
}

/** The spots, with a note on the right ("Names show once you're in"). */
@Composable
internal fun PlanSpots(
    plan: PlanDto,
    note: String? = null,
    mine: Int = 0,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (plan.isFull) {
            val noun =
                if (plan.isPlaydate) {
                    "families"
                } else if (plan.planKind == PlanKind.PICKUP_GAME) {
                    "players"
                } else {
                    "people"
                }
            PlanSpotsCaption(going = "Full", left = "${plan.spots} of ${plan.spots} $noun", note = note, noteMuted = true)
        } else {
            val (going, left) = PlanFormat.goingLine(plan)
            PlanSpotsCaption(going = going, left = left, note = note, noteMuted = true)
        }
        PlanSpotsMeter(spots = plan.spots, taken = plan.spots - plan.spotsLeft, mine = mine)
    }
}

/** J1 and J2: a plan before you're in. */
@Composable
internal fun ColumnScope.PlanBeforeInBody(plan: PlanDto) {
    PlanTitleBlock(plan)
    PlanHostCard(plan)
    PlanSpots(plan, note = if (plan.isPlaydate) null else "Names show once you're in")
    plan.about?.takeIf(String::isNotBlank)?.let { Text(text = it, style = PantopusTextStyle.body, color = PantopusColors.appText) }
    detailsLine(plan)?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
    if (plan.isPlaydate) {
        PlanNote(
            "Parents stay with their kids. Only ages are shared, never names, photos or schools. Everyone here has a verified address.",
        )
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlanInfoLine(PantopusIcon.Users, PlanFormat.howPeopleGetIn(plan))
            PlanInfoLine(PantopusIcon.ShieldCheck, "Free, and for adults")
        }
    }
}

/** What the J1 footer offers, by why the person can or can't ask. */
internal data class AskFooter(
    val label: String,
    val enabled: Boolean,
    val caption: String?,
    val action: AskAction,
)

internal enum class AskAction { Ask, Verify, Location, None }

internal fun askFooter(plan: PlanDto): AskFooter {
    val host = plan.hostFirst
    val ended = plan.planState == PlanState.ENDED || plan.planState == PlanState.CANCELLED
    val viewer = plan.viewer
    val approves = answerTime(plan)?.let { "$host usually answers $it" }
    return when {
        ended -> AskFooter("This plan has ended", enabled = false, caption = null, action = AskAction.None)
        viewer?.canAsk == true && (plan.isFull || viewer.cannotAskReason == PlanCannotAsk.FULL_USE_WAITLIST) ->
            AskFooter(
                "Join the waitlist",
                enabled = true,
                caption = "Full for now. If a spot opens, we'll tell you right away.",
                action = AskAction.Ask,
            )
        viewer?.canAsk == true ->
            AskFooter(
                "Ask to join",
                enabled = true,
                caption =
                    when {
                        !plan.hostApproves -> "You're in as soon as you ask, until the spots fill."
                        // J2: a playdate's body has no "approves" line, so the footer says it (the board's words, as iOS).
                        plan.isPlaydate -> "$host approves each family"
                        else -> approves
                    },
                action = AskAction.Ask,
            )
        else -> cannotAskFooter(viewer?.cannotAskReason)
    }
}

/** The J1 footer when the server says the viewer can't ask, and why. */
private fun cannotAskFooter(reason: String?): AskFooter =
    when (reason) {
        PlanCannotAsk.NEEDS_VERIFIED_ADDRESS ->
            AskFooter(
                "Verify your address to join",
                enabled = true,
                caption = "This plan is for verified neighbors.",
                action = AskAction.Verify,
            )
        PlanCannotAsk.NEEDS_LOCATION ->
            AskFooter(
                "Share your location to join",
                enabled = true,
                caption = "Hosts only see a distance like “about 1 mi”.",
                action = AskAction.Location,
            )
        PlanCannotAsk.TOO_FAR ->
            AskFooter(
                "Too far to join",
                enabled = false,
                caption = "This plan is for neighbors who live or are close by.",
                action = AskAction.None,
            )
        PlanCannotAsk.FULL_USE_WAITLIST ->
            AskFooter(
                "Join the waitlist",
                enabled = true,
                caption = "Full for now. If a spot opens, we'll tell you right away.",
                action = AskAction.Ask,
            )
        PlanCannotAsk.TOO_MANY_REQUESTS ->
            AskFooter(
                "Ask to join",
                enabled = false,
                caption = "You have 10 open requests. Withdraw one to ask here.",
                action = AskAction.None,
            )
        PlanCannotAsk.ENDED -> AskFooter("Asking has closed", enabled = false, caption = null, action = AskAction.None)
        // Why, under the greyed-out button (as on iOS).
        PlanCannotAsk.DECLINED, PlanCannotAsk.REMOVED ->
            AskFooter("Ask to join", enabled = false, caption = "This one didn't work out.", action = AskAction.None)
        PlanCannotAsk.BLOCKED -> AskFooter("Ask to join", enabled = false, caption = "You can't join this plan.", action = AskAction.None)
        else ->
            AskFooter(
                "Ask to join",
                enabled = false,
                caption = "You can't ask to join this plan right now.",
                action = AskAction.None,
            )
    }

/** J5: requested. */
@Composable
internal fun ColumnScope.PlanRequestedBody(plan: PlanDto) {
    PlanBanner(
        title = "Requested",
        subtitle =
            answerTime(plan)?.let {
                "${plan.hostFirst} usually answers $it. We'll tell you."
            } ?: "We'll tell you when ${plan.hostFirst} answers.",
        icon = PantopusIcon.Clock,
        tone = PlanBannerTone.Neutral,
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanHeading(plan)
        Text(
            text =
                listOfNotNull(
                    PlanFormat.whenLine(plan, long = true),
                    plan.area?.label,
                    PlanFormat.distance(plan.distanceBand),
                ).joinToString(" · "),
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
    }
    YourRequestCard(plan)
    PlanSpots(plan)
}

@Composable
private fun YourRequestCard(plan: PlanDto) {
    val mine = plan.myRequest ?: return
    Column(modifier = Modifier.fillMaxWidth().planCard().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        PlanOverline("Your request", modifier = Modifier.padding(bottom = 2.dp))
        val coming =
            if (plan.isPlaydate) {
                val kids = mine.kidsCount ?: 1
                listOfNotNull("You + $kids ${if (kids == 1) "kid" else "kids"}", KidsAgeBand.rangeLabel(mine.kidsAgeBands))
                    .joinToString(" · ")
            } else {
                val size = mine.partySize ?: 1
                if (size <= 1) "Just you" else "You + ${size - 1}"
            }
        KeyValue("Coming", coming)
        PlanFormat.sentAt(mine.createdAt)?.let { KeyValue("Sent", it) }
        mine.note?.takeIf(String::isNotBlank)?.let {
            Text(
                text = "“$it”",
                style = PantopusTextStyle.small.copy(fontStyle = FontStyle.Italic),
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun KeyValue(
    key: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.CenterVertically) {
        Text(text = key, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary, modifier = Modifier.weight(1f))
        Text(text = value, style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
    }
}

/** J6: on the waitlist. */
@Composable
internal fun ColumnScope.PlanWaitlistBody(plan: PlanDto) {
    val position = plan.viewer?.waitlistPosition ?: 1
    PlanBanner(
        title = "You're ${ordinalWord(position)} on the waitlist",
        subtitle =
            if (plan.hostApproves) {
                "If someone can't make it, ${plan.hostFirst} can let you in. We'll tell you right away."
            } else {
                "If someone can't make it, you're in. We'll tell you right away."
            },
        icon = PantopusIcon.List,
        tone = PlanBannerTone.Neutral,
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanHeading(plan)
        // "Sunday, Oct 18 · 5:30–7:30 PM · …", the long date as J5 and iOS write it.
        Text(
            text =
                listOfNotNull(PlanFormat.whenLine(plan, long = true), plan.area?.label, PlanFormat.distance(plan.distanceBand))
                    .joinToString(" · "),
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
        detailsLine(plan)?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
    }
    PlanSpots(plan, note = if (plan.waitlistCount > 0) "${plan.waitlistCount} waiting" else null)
    PlanHostCard(plan, ruleCaption = PlanFormat.howPeopleGetIn(plan))
}

/** "1st", "2nd": the waitlist position in words. */
internal fun ordinalWord(n: Int): String = app.pantopus.android.ui.screens.plans.map.ordinal(n)

/** J6 footer caption: when it starts and when the waitlist closes. */
internal fun waitlistCaption(plan: PlanDto): String? {
    val starts = PlanFormat.startsIn(plan) ?: return null
    val closes =
        if (plan.planKind == PlanKind.PICKUP_GAME || plan.planKind == PlanKind.WALK_COFFEE) {
            "The waitlist closes 30 minutes before it ends."
        } else {
            "The waitlist closes when it starts."
        }
    return "$starts. $closes"
}

/** J8: this one didn't work out (declined, expired or removed). */
@Composable
internal fun PlanNotThisTime(
    plan: PlanDto,
    others: List<PlanDto>,
    onBack: () -> Unit,
    onOpenPlan: (String) -> Unit,
    onSeeAll: () -> Unit,
    onHost: (String?) -> Unit,
) {
    val status = PlanRequestStatus.from(plan.viewer?.requestStatus ?: plan.myRequest?.status)
    val (title, subtitle) =
        when (status) {
            PlanRequestStatus.EXPIRED -> "This one didn't work out" to "It started before ${plan.hostFirst} could answer."
            PlanRequestStatus.REMOVED -> "You're no longer on this plan" to "${plan.hostFirst} made a change to who's coming."
            else -> "This one didn't work out" to "${plan.hostFirst} couldn't fit you this time."
        }
    PlanPlainScaffold(onBack = onBack) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlanHeading(plan)
            // "Sunday, Oct 18 · 1:25 PM · Sam R." (board J8), "Today · 1:25 PM · …" when it applies, as on iOS.
            Text(
                text = listOfNotNull(PlanFormat.dayAndTime(plan), plan.host?.displayName).joinToString(" · "),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanBanner(title = title, subtitle = subtitle, icon = PantopusIcon.Info, tone = PlanBannerTone.Neutral)
        if (others.isNotEmpty()) {
            Column {
                PlanOverline("Other plans this week", modifier = Modifier.padding(bottom = 2.dp))
                others.forEachIndexed { index, other ->
                    PlanListRow(other, first = index == 0, mine = false, onOpen = { onOpenPlan(it.id) })
                }
            }
        }
        GhostButton(title = "See all plans", onClick = onSeeAll, modifier = Modifier.height(50.dp))
        // A playdate too (as on iOS): whoever saw one has the verified address hosting it needs.
        plan.planKind?.let { kind -> PlanTextButton(title = "Host your own ${kind.noun}", onClick = { onHost(kind.wire) }) }
    }
}

/** J9: a playdate link for someone without a verified address. */
@Composable
internal fun PlaydateLocked(
    city: String?,
    onClose: () -> Unit,
    onVerify: () -> Unit,
    onSeeOthers: () -> Unit,
) {
    PlanPlainScaffold(
        onBack = onClose,
        title = "Shared with you",
        closeIcon = true,
        footer = {
            PrimaryButton(title = "Verify your address", onClick = onVerify, modifier = Modifier.height(50.dp))
            PlanTextButton(title = "See other plans", onClick = onSeeOthers)
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.padding(top = Spacing.s2)) {
            PlanTypeTag(PlanKind.PLAYDATE)
            Text(
                text = "A playdate near ${city ?: "you"}",
                style = planH2,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = "Someone shared this with you.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        Column(modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PlanIconTile(PantopusIcon.Lock, PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong, size = 48.dp, glyph = 22.dp)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(text = "Playdates are for verified neighbors", style = planH4, color = PantopusColors.appText)
                Text(
                    text =
                        "Verify your address to see the time, the place and who's going, and to ask to join. " +
                            "Everyone at a playdate has done the same.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                CheckLine("A code arrives by mail in 3 to 7 days")
                CheckLine("Your address stays private")
                CheckLine("Watch parties, pickup games and walks are open now")
            }
        }
    }
}

@Composable
private fun CheckLine(text: String) {
    Row(
        modifier = Modifier.semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 16.dp, tint = PantopusColors.success)
        Text(text = text, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
    }
}

/** A cancelled or ended plan, for anyone but its host. */
@Composable
internal fun ColumnScope.PlanClosedBody(
    plan: PlanDto,
    onOpenChat: (() -> Unit)?,
) {
    val cancelled = plan.planState == PlanState.CANCELLED
    PlanBanner(
        title = if (cancelled) "This plan was cancelled" else "This plan has ended",
        subtitle = if (cancelled) cancelledBy(plan.hostFirst, plan.cancelNote) else null,
        icon = if (cancelled) PantopusIcon.XCircle else PantopusIcon.CheckCircle,
        tone = PlanBannerTone.Neutral,
    )
    PlanTitleBlock(plan)
    // The chat stays to read for people who were in (the server sends its room only to them), as on iOS.
    onOpenChat?.let { GhostButton(title = "Read the group chat", onClick = it) }
}

/** "Sam cancelled it: “Sorry, the courts are closed tonight.”", or "Sam cancelled it." with no note (as on iOS). */
internal fun cancelledBy(
    who: String,
    note: String?,
): String = note?.trim()?.takeIf(String::isNotEmpty)?.let { "$who cancelled it: “$it”" } ?: "$who cancelled it."
