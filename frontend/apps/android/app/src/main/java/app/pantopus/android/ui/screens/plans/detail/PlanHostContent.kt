@file:Suppress("MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.plans.detail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanPersonDto
import app.pantopus.android.data.api.models.plans.PlanRequestsResponse
import app.pantopus.android.data.plans.KidsAgeBand
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.planState
import app.pantopus.android.ui.components.DestructiveButton
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.plans.components.PlanAvatar
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanSpotsMeter
import app.pantopus.android.ui.screens.plans.components.PlanStatusChip
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanWell
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.map.planH2
import app.pantopus.android.ui.screens.plans.map.planH3
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** H9: your plan, as host. */
@Composable
internal fun ColumnScope.PlanHostBody(
    plan: PlanDto,
    requests: PlanRequestsResponse?,
    viewerId: String?,
    busy: Boolean,
    onOpenRequests: () -> Unit,
    onMessageGuests: () -> Unit,
    onChange: () -> Unit,
    onCancel: () -> Unit,
    onRemove: (PlanPersonDto) -> Unit,
) {
    val context = LocalContext.current
    val closed = plan.planState == PlanState.CANCELLED || plan.planState == PlanState.ENDED
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        PlanStatusChip(
            text = if (plan.planState == PlanState.CANCELLED) "Cancelled" else "You're hosting",
            icon = PantopusIcon.Flag,
            iconTint = PantopusColors.primary600,
        )
        Text(text = plan.title, style = planH2, color = PantopusColors.appText, modifier = Modifier.semantics { heading() })
        val where = if (plan.isAtHome) "Your place" else plan.place?.name ?: plan.area?.label
        Text(
            text = listOfNotNull(PlanFormat.whenLine(plan, long = true), where).joinToString(" · "),
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
    }
    if (plan.planState == PlanState.CANCELLED) {
        PlanBanner(
            title = "You cancelled this plan",
            subtitle = "Everyone who was in or waiting was told. The pin is off the map.",
            icon = PantopusIcon.XCircle,
            tone = PlanBannerTone.Neutral,
        )
    }
    val pending = requests?.pending.orEmpty()
    val waiting = requests?.waitlisted.orEmpty()
    val count = maxOf(plan.requestsCount ?: 0, pending.size)
    if (!closed && count > 0) {
        RequestsCard(count, pending.mapNotNull { it.user?.displayName }, onOpenRequests)
    } else if (!closed && waiting.isNotEmpty()) {
        // Nobody to answer, but people are waiting for a spot: the host can still see who (H10's waitlist).
        WaitlistCard(waiting.mapNotNull { it.user?.displayName }, onOpenRequests)
    }
    GoingSection(plan, viewerId, busy, closed, asked = count > 0 || waiting.isNotEmpty(), onRemove = onRemove)
    if (!closed) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (plan.chatRoomId != null) {
                GhostButton(title = "Message guests", onClick = onMessageGuests, modifier = Modifier.weight(1f))
            }
            GhostButton(title = "Share", onClick = { context.sharePlan(plan) }, modifier = Modifier.weight(1f))
        }
        Column {
            PlanTextButton(title = "Change the time or place", onClick = onChange)
            PlanTextButton(title = "Cancel plan", onClick = onCancel, danger = true)
        }
    }
}

@Composable
private fun RequestsCard(
    count: Int,
    names: List<String>,
    onOpen: () -> Unit,
) {
    val who =
        when (names.size) {
            0 -> "Tap to answer"
            1 -> "${names[0]} asked to join"
            2 -> "${names[0]} and ${names[1]} asked to join"
            else -> "${names[0]}, ${names[1]} and ${names.size - 2} more asked to join"
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .planCard()
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(14.dp)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanIconTile(PantopusIcon.Bell, PantopusColors.primary100, PantopusColors.primary700)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (count == 1) "1 request" else "$count requests",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = who, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun WaitlistCard(
    names: List<String>,
    onOpen: () -> Unit,
) {
    val who =
        when (names.size) {
            1 -> "${names[0]} is waiting for a spot"
            2 -> "${names[0]} and ${names[1]} are waiting for a spot"
            else -> "${names.take(2).joinToString(", ")} and ${names.size - 2} more are waiting for a spot"
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .planCard()
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(14.dp)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanIconTile(PantopusIcon.List, PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Waitlist · ${names.size}",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = who, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun GoingSection(
    plan: PlanDto,
    viewerId: String?,
    busy: Boolean,
    closed: Boolean,
    asked: Boolean,
    onRemove: (PlanPersonDto) -> Unit,
) {
    val guests = plan.people.orEmpty().filter { !it.isHost && it.userId != viewerId }
    // A cancelled or ended plan with nobody in has no "going" to show.
    if (closed && guests.isEmpty()) return
    val taken = plan.spots - plan.spotsLeft
    Column {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            PlanOverline("Going · $taken of ${plan.spots}", modifier = Modifier.weight(1f))
            Text(
                text =
                    when {
                        plan.spotsLeft <= 0 -> "Full"
                        plan.spotsLeft == 1 -> "1 spot left"
                        else -> "${plan.spotsLeft} spots left"
                    },
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanSpotsMeter(spots = plan.spots, taken = taken, modifier = Modifier.padding(bottom = 6.dp))
        if (guests.isEmpty()) {
            Text(
                text = if (asked) "Nobody in yet." else "Nobody yet. We'll tell you when someone asks.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = Spacing.s2),
            )
        }
        guests.forEachIndexed { index, person ->
            GuestRow(person, first = index == 0, atHome = plan.isAtHome, busy = busy, onRemove = onRemove)
        }
    }
}

@Composable
private fun GuestRow(
    person: PlanPersonDto,
    first: Boolean,
    atHome: Boolean,
    busy: Boolean,
    onRemove: (PlanPersonDto) -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf(false) }
    val name = person.displayName ?: "Neighbor"
    val title = if (person.partySize > 1) "$name + ${person.partySize - 1}" else name
    val kids =
        person.kidsCount?.let { count ->
            listOfNotNull("$count ${if (count == 1) "kid" else "kids"}", KidsAgeBand.rangeLabel(person.kidsAgeBands)?.let { "ages $it" })
                .joinToString(", ")
        }
    val subtitle =
        listOfNotNull(
            if (person.reconfirmNeeded == true) "hasn't confirmed the change" else null,
            if (person.verifiedAddress) "verified" else null,
            PlanFormat.distance(person.distanceBand),
            kids,
            if (person.hostedBefore == true) "you hosted ${PlanFormat.firstName(name)} before" else null,
            if (person.newToPantopus == true) "new to Pantopus" else null,
            if (person.onMyWay) "on the way" else null,
        ).joinToString(" · ").replaceFirstChar { it.titlecase() }.ifBlank { "Going" }
    Column(modifier = Modifier.fillMaxWidth()) {
        if (!first) PlanDivider()
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            PlanAvatar(name = name, seed = person.userId, avatarUrl = person.avatarUrl)
            Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                Text(
                    text = title,
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
                Text(text = subtitle, style = PantopusTextStyle.small.copy(fontSize = 13.sp), color = PantopusColors.appTextSecondary)
            }
            if (person.requestId != null) {
                Box {
                    PlanRoundButton(
                        icon = PantopusIcon.MoreHorizontal,
                        label = "Options for ${PlanFormat.firstName(name)}",
                        onClick = { if (!busy) menu = true },
                        glass = false,
                    )
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(
                            text = { Text("Remove from plan", color = PantopusColors.error) },
                            onClick = {
                                menu = false
                                confirm = true
                            },
                        )
                    }
                }
            }
        }
    }
    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Remove ${PlanFormat.firstName(name)}?") },
            text = {
                Text(
                    if (atHome) {
                        "They've already seen your address. They lose the plan, the note and the chat from now on."
                    } else {
                        "They lose the plan, the exact place, the note and the chat from now on."
                    },
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirm = false
                    onRemove(person)
                }) { Text("Remove", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("Keep") } },
        )
    }
}

/** H12: cancel the plan, with an optional note to everyone. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlanCancelSheet(
    plan: PlanDto,
    requests: PlanRequestsResponse?,
    note: String,
    onNote: (String) -> Unit,
    onCancel: () -> Unit,
    onKeep: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val inCount = plan.people.orEmpty().count { !it.isHost }
    val asked = requests?.let { it.pending.size + it.waitlisted.size } ?: (plan.requestsCount ?: 0)
    ModalBottomSheet(onDismissRequest = onKeep, sheetState = sheet, containerColor = PantopusColors.appSurface) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "Cancel this plan?",
                    style = planH3,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(text = cancelSentence(inCount, asked), style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
            }
            PantopusTextField(
                label = "Add a note · optional",
                value = note,
                onValueChange = onNote,
                placeholder = "Sorry, something came up.",
            )
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                DestructiveButton(title = "Cancel plan", onClick = onCancel, modifier = Modifier.height(50.dp))
                GhostButton(title = "Keep plan", onClick = onKeep, modifier = Modifier.height(50.dp))
            }
            PlanWell {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = "Removing one guest instead?",
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(
                        text =
                            "Open their row on your plan. If the plan is at your place, they've already seen the address; " +
                                "they lose the plan, the note and the chat from then on.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

private fun cancelSentence(
    inCount: Int,
    asked: Int,
): String {
    val people =
        buildList {
            if (inCount > 0) add(if (inCount == 1) "the 1 person who's in" else "the $inCount people who are in")
            if (asked > 0) add(if (asked == 1) "the 1 who asked" else "the $asked who asked")
        }
    val tell = if (people.isEmpty()) "Nobody has joined yet." else "We'll tell ${people.joinToString(" and ")}."
    return "$tell The pin comes off the map and the chat closes."
}
