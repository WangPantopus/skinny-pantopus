@file:Suppress("MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.plans.requests

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanRequestViewDto
import app.pantopus.android.data.plans.KidsAgeBand
import app.pantopus.android.data.plans.PlanAutoRule
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.plans.components.PlanAvatar
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.screens.plans.components.PlanSpotsMeter
import app.pantopus.android.ui.screens.plans.components.PlanStatusChip
import app.pantopus.android.ui.screens.plans.components.PlanVerifiedBadge
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.screens.plans.map.PlanRowsSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** H10: the people who asked to join a plan you host. */
@Composable
fun PlanRequestsScreen(
    onBack: () -> Unit,
    viewModel: PlanRequestsViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        onPauseOrDispose { }
    }
    LaunchedEffect(ui.notice) {
        ui.notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    Box(modifier = Modifier.fillMaxSize().testTag("planRequests")) {
        PlanPlainScaffold(onBack = onBack, title = "Requests") {
            val plan = ui.plan
            if (plan != null) RequestsHeader(plan, onHostedBefore = viewModel::setHostedBefore)
            when {
                ui.loading && ui.pending.isEmpty() -> PlanRowsSkeleton(rows = 2)
                ui.failed != null ->
                    Text(
                        text = ui.failed.orEmpty(),
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                ui.pending.isEmpty() ->
                    Text(
                        text = "No requests right now. We'll tell you when someone asks.",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextSecondary,
                    )
                else ->
                    ui.pending.forEach { request ->
                        RequestCard(
                            request = request,
                            playdate = plan?.isPlaydate == true,
                            working = request.id in ui.working,
                            onAccept = { viewModel.accept(request) },
                            onDecline = { viewModel.decline(request) },
                        )
                    }
            }
            if (plan?.isAtHome == true) {
                PlanScopeLine(
                    text =
                        "This plan is at your place. Accepting someone shares your address with them. " +
                            "Declining needs no reason, and they won't see who said no.",
                    icon = PantopusIcon.Home,
                )
            } else {
                PlanScopeLine("Declining needs no reason, and they won't see who said no.")
            }
            if (ui.waitlisted.isEmpty()) {
                Text(text = "Waitlist: nobody yet", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            } else {
                // The waitlist as cards, as on iOS: the host can let someone in (or say no) from here too.
                PlanOverline("Waitlist")
                ui.waitlisted.forEach { request ->
                    RequestCard(
                        request = request,
                        playdate = plan?.isPlaydate == true,
                        working = request.id in ui.working,
                        onAccept = { viewModel.accept(request) },
                        onDecline = { viewModel.decline(request) },
                    )
                }
            }
        }
        ToastHost(controller = toast, modifier = Modifier.align(Alignment.TopCenter))
    }
    ui.confirmAccept?.let { request ->
        AlertDialog(
            onDismissRequest = viewModel::dismissConfirm,
            title = { Text("Accepting shares your address with them") },
            text = {
                // The first name, as on iOS ("Priya will see …").
                Text(
                    "${request.user?.displayName?.takeIf { it.isNotBlank() }?.let(PlanFormat::firstName) ?: "They"} will see " +
                        "your address, your note and who's going. " +
                        "You'll be asked once for this plan.",
                )
            },
            confirmButton = { TextButton(onClick = viewModel::confirmSharingAddress) { Text("Accept and share") } },
            dismissButton = { TextButton(onClick = viewModel::dismissConfirm) { Text("Not now") } },
        )
    }
}

@Composable
private fun RequestsHeader(
    plan: PlanDto,
    onHostedBefore: (Boolean) -> Unit,
) {
    val taken = plan.spots - plan.spotsLeft
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            // Board H10: "Seahawks game · Sun 1:25 PM" (or "Today 5:30 PM").
            text = listOfNotNull(PlanFormat.shortTitle(plan), PlanFormat.rowWhen(plan)).joinToString(" · "),
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "$taken of ${plan.spots} spots filled",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = if (plan.spotsLeft <= 0) "Full" else "${plan.spotsLeft} left",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanSpotsMeter(spots = plan.spots, taken = taken)
    }
    if (!plan.isPlaydate) {
        val on = PlanAutoRule.HOSTED_BEFORE in plan.autoRules.orEmpty()
        Row(
            modifier =
                Modifier.fillMaxWidth().planCard(
                    corner = 16.dp,
                ).padding(horizontal = 14.dp, vertical = 10.dp).semantics(mergeDescendants = true) {
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Let in people you've hosted",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
                Text(
                    text = "They get in right away, until the spots fill",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Switch(
                checked = on,
                onCheckedChange = onHostedBefore,
                colors = SwitchDefaults.colors(checkedTrackColor = PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun RequestCard(
    request: PlanRequestViewDto,
    playdate: Boolean,
    working: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val user = request.user
    val name = user?.displayName ?: "Neighbor"
    Column(
        modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PlanAvatar(name = name, seed = user?.userId ?: request.id, avatarUrl = user?.avatarUrl)
            Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(text = name, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
                    if (user?.verifiedAddress == true) PlanVerifiedBadge(text = "Verified")
                }
                Text(text = requesterCaption(request), style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
            PlanStatusChip(text = partyLabel(request, playdate))
        }
        request.note?.takeIf(String::isNotBlank)?.let {
            Text(text = "“$it”", style = PantopusTextStyle.body.copy(fontStyle = FontStyle.Italic), color = PantopusColors.appText)
        }
        // TalkBack hears whom each button answers ("Accept Priya"), as VoiceOver does on iOS.
        val first = user?.displayName?.takeIf { it.isNotBlank() }?.let(PlanFormat::firstName) ?: "Neighbor"
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SpokenAs("Decline $first", enabled = !working, action = onDecline, modifier = Modifier.weight(1f)) {
                GhostButton(title = "Decline", onClick = onDecline, isEnabled = !working)
            }
            SpokenAs("Accept $first", enabled = !working, action = onAccept, modifier = Modifier.weight(1f)) {
                PrimaryButton(title = "Accept", onClick = onAccept, isLoading = working)
            }
        }
    }
}

/** A button read out with its own words ("Accept Priya") while it shows a shorter title ("Accept"). */
@Composable
private fun SpokenAs(
    label: String,
    enabled: Boolean,
    action: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier.clearAndSetSemantics {
                contentDescription = label
                role = Role.Button
                if (enabled) {
                    onClick(label = label) {
                        action()
                        true
                    }
                } else {
                    disabled()
                }
            },
    ) { content() }
}

/** "About 1 mi away · joined 2 plans · 1 mutual connection" (or "new to Pantopus"). */
private fun requesterCaption(request: PlanRequestViewDto): String {
    val user = request.user ?: return ""
    val parts = mutableListOf<String>()
    PlanFormat.distance(user.distanceBand)?.let { parts += "${it.replaceFirstChar { c -> c.titlecase() }} away" }
    if (user.hostedBefore) parts += "you hosted them before"
    if (user.plansJoined > 0) parts += "joined ${user.plansJoined} plan${if (user.plansJoined == 1) "" else "s"}"
    if (user.mutualConnections > 0) parts += "${user.mutualConnections} mutual connection${if (user.mutualConnections == 1) "" else "s"}"
    if (user.plansJoined == 0 && user.mutualConnections == 0 && !user.hostedBefore) parts += "new to Pantopus"
    return parts.joinToString(" · ")
}

/** "Just Priya", "Priya + 1" (as the host's push says it), or for a playdate "2 kids · ages 2–5". */
private fun partyLabel(
    request: PlanRequestViewDto,
    playdate: Boolean,
): String {
    if (playdate) {
        val kids = request.kidsCount ?: 1
        return listOfNotNull("$kids ${if (kids == 1) "kid" else "kids"}", KidsAgeBand.rangeLabel(request.kidsAgeBands)).joinToString(" · ")
    }
    val name = request.user?.displayName?.takeIf { it.isNotBlank() }?.let(PlanFormat::firstName) ?: "Neighbor"
    return if (request.partySize <= 1) "Just $name" else "$name + ${request.partySize - 1}"
}
