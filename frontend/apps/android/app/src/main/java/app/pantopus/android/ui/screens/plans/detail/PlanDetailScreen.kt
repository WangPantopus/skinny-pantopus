@file:Suppress("MagicNumber", "LongParameterList", "LongMethod", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.plans.detail

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.hasPrivatePart
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.planState
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.place.HubVerificationTarget
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.map.PlanRowsSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.launch

/** The report reasons a plan offers (the posts report queue's vocabulary). */
private val reportReasons =
    listOf(
        "safety" to "Something unsafe",
        "inappropriate" to "Inappropriate",
        "harassment" to "Harassment",
        "spam" to "Spam",
        "misinformation" to "Not a real plan",
        "other" to "Something else",
    )

/**
 * One plan, as the person looking stands with it: before you're in (J1, J2), requested (J5), on the waitlist (J6),
 * you're in (J7), didn't work out (J8), a playdate you can't see yet (J9), or your own plan as its host (H9).
 */
@Composable
fun PlanDetailScreen(
    onBack: () -> Unit,
    onOpenPlan: (String) -> Unit,
    onOpenRequests: (String) -> Unit,
    onChange: (String) -> Unit,
    onHost: (kind: String?, again: String?) -> Unit,
    onOpenChat: (roomId: String, title: String, planId: String) -> Unit,
    onOpenVerification: (HubVerificationTarget) -> Unit,
    onSeeAllPlans: () -> Unit,
    viewModel: PlanDetailViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    val scope = rememberCoroutineScope()
    val openVerification: () -> Unit = { scope.launch { onOpenVerification(viewModel.verificationTarget()) } }
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        viewModel.onScreen(true)
        onPauseOrDispose { viewModel.onScreen(false) }
    }
    // A plan push marks Plans out of date: read again, so "You're in" reveals while the page is open.
    RefreshOnStoreChange(viewModel::load)
    LaunchedEffect(ui.notice) {
        ui.notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    Box(modifier = Modifier.fillMaxSize().testTag("planDetail")) {
        when (val state = ui.state) {
            PlanDetailUiState.Loading -> PlanLoading(onBack)
            is PlanDetailUiState.Failed ->
                PlanPlainScaffold(onBack = onBack) {
                    ErrorState(headline = "Couldn't open this plan", message = state.message, onRetry = viewModel::load)
                }
            PlanDetailUiState.Gone -> PlanGone(onBack = onBack, onSeeAll = onSeeAllPlans)
            is PlanDetailUiState.PlaydateLocked ->
                PlaydateLocked(city = state.city, onClose = onBack, onVerify = openVerification, onSeeOthers = onSeeAllPlans)
            is PlanDetailUiState.Ready ->
                PlanReady(
                    plan = state.plan,
                    ui = ui,
                    viewModel = viewModel,
                    onBack = onBack,
                    onOpenPlan = onOpenPlan,
                    onOpenRequests = { onOpenRequests(state.plan.id) },
                    onChange = { onChange(state.plan.id) },
                    onHost = onHost,
                    onOpenChat = { room -> onOpenChat(room, state.plan.title, state.plan.id) },
                    onVerify = openVerification,
                    onSeeAllPlans = onSeeAllPlans,
                )
        }
        ToastHost(controller = toast, modifier = Modifier.align(Alignment.TopCenter))
    }
}

@Composable
private fun PlanReady(
    plan: PlanDto,
    ui: PlanDetailUi,
    viewModel: PlanDetailViewModel,
    onBack: () -> Unit,
    onOpenPlan: (String) -> Unit,
    onOpenRequests: () -> Unit,
    onChange: () -> Unit,
    onHost: (String?, String?) -> Unit,
    onOpenChat: (String) -> Unit,
    onVerify: () -> Unit,
    onSeeAllPlans: () -> Unit,
) {
    val standing = plan.standing
    if (standing == PlanViewerStanding.DECLINED || standing == PlanViewerStanding.REMOVED) {
        PlanNotThisTime(
            plan = plan,
            others = ui.others,
            onBack = onBack,
            onOpenPlan = onOpenPlan,
            onSeeAll = onSeeAllPlans,
            onHost = { kind -> onHost(kind, null) },
        )
        return
    }
    val context = LocalContext.current
    val reduceMotion = rememberReduceMotion()
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            if (results.values.any { it }) viewModel.useMyLocation()
        }
    // J1 "Share your location to join": the person's fix counts as a location for 5 minutes; hosts only ever see
    // a distance band.
    val askLocation: () -> Unit = {
        if (viewModel.hasLocationPermission()) {
            viewModel.useMyLocation()
        } else {
            permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }
    var confirmLeave by remember { mutableStateOf<LeaveKind?>(null) }
    var reporting by remember { mutableStateOf(false) }
    val hosting = standing == PlanViewerStanding.HOSTING
    val menu =
        if (hosting) {
            emptyList()
        } else {
            listOf(
                PlanMenuItem("Report this plan") { reporting = true },
                PlanMenuItem("Block ${plan.hostFirst}", danger = true) { viewModel.blockHost() },
            )
        }
    val closed = plan.planState == PlanState.CANCELLED || plan.planState == PlanState.ENDED
    PlanPageScaffold(
        header = {
            PlanMiniMap(plan = plan, reveal = ui.reveal, reduceMotion = reduceMotion, onRevealDone = viewModel::revealShown)
        },
        onBack = onBack,
        scope = scopeChip(plan),
        onShare = if (plan.shareUrl != null && !closed) ({ context.sharePlan(plan) }) else null,
        menu = menu,
        footer = footerFor(plan, ui, closed, viewModel, onSeeAllPlans, onVerify, askLocation) { confirmLeave = it },
    ) {
        when {
            hosting ->
                PlanHostBody(
                    plan = plan,
                    requests = ui.requests,
                    viewerId = ui.viewerId,
                    busy = ui.busy,
                    onOpenRequests = onOpenRequests,
                    onMessageGuests = { plan.chatRoomId?.let(onOpenChat) },
                    onChange = onChange,
                    onCancel = viewModel::openCancel,
                    onRemove = { person -> person.requestId?.let(viewModel::removeGuest) },
                )
            closed -> PlanClosedBody(plan)
            standing == PlanViewerStanding.IN && plan.hasPrivatePart ->
                PlanInBody(
                    plan = plan,
                    reveal = ui.reveal,
                    reduceMotion = reduceMotion,
                    busy = ui.busy,
                    viewerId = ui.viewerId,
                    onStillComing = { coming -> if (coming) viewModel.stillComing(true) else confirmLeave = LeaveKind.Plan },
                    onOpenChat = { plan.chatRoomId?.let(onOpenChat) },
                )
            standing == PlanViewerStanding.REQUESTED -> PlanRequestedBody(plan)
            standing == PlanViewerStanding.WAITLISTED -> PlanWaitlistBody(plan)
            else -> PlanBeforeInBody(plan)
        }
    }
    if (ui.askOpen) {
        PlanAskSheet(plan = plan, draft = ui.ask, onEdit = viewModel::editAsk, onSend = viewModel::sendAsk, onClose = viewModel::closeAsk)
    }
    if (ui.cancelOpen) {
        PlanCancelSheet(
            plan = plan,
            requests = ui.requests,
            note = ui.cancelNote,
            onNote = viewModel::editCancelNote,
            onCancel = viewModel::cancelPlan,
            onKeep = viewModel::closeCancel,
        )
    }
    confirmLeave?.let { kind ->
        LeaveDialog(kind, plan, onConfirm = {
            confirmLeave = null
            if (kind == LeaveKind.Plan && plan.myRequest?.reconfirmNeeded == true) viewModel.stillComing(false) else viewModel.withdraw()
        }, onDismiss = { confirmLeave = null })
    }
    if (reporting) {
        ReportDialog(onReport = { reason ->
            reporting = false
            viewModel.report(reason)
        }, onDismiss = { reporting = false })
    }
}

/** What a person is about to walk away from. */
internal enum class LeaveKind { Request, Waitlist, Plan }

private fun scopeChip(plan: PlanDto): String? =
    when {
        plan.hasPrivatePart -> null
        plan.isPlaydate -> "Exact place and time shared when you're in"
        else -> "Exact place shared when you're in"
    }

private fun footerFor(
    plan: PlanDto,
    ui: PlanDetailUi,
    closed: Boolean,
    viewModel: PlanDetailViewModel,
    onSeeAll: () -> Unit,
    onVerify: () -> Unit,
    onLocation: () -> Unit,
    confirm: (LeaveKind) -> Unit,
): (@Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit)? {
    val standing = plan.standing
    return when {
        standing == PlanViewerStanding.HOSTING -> null
        closed -> {
            { GhostButton(title = "See other plans", onClick = onSeeAll, modifier = Modifier.height(50.dp)) }
        }
        standing == PlanViewerStanding.IN -> {
            { PlanTextButton(title = "Can't make it", onClick = { confirm(LeaveKind.Plan) }, danger = true, enabled = !ui.busy) }
        }
        standing == PlanViewerStanding.REQUESTED -> {
            {
                GhostButton(
                    title = "Change who's coming",
                    onClick = viewModel::openAsk,
                    modifier = Modifier.height(50.dp),
                    isEnabled = !ui.busy,
                )
                PlanTextButton(title = "Withdraw request", onClick = { confirm(LeaveKind.Request) }, danger = true, enabled = !ui.busy)
            }
        }
        standing == PlanViewerStanding.WAITLISTED -> {
            {
                GhostButton(title = "Leave the waitlist", onClick = {
                    confirm(LeaveKind.Waitlist)
                }, modifier = Modifier.height(50.dp), isEnabled = !ui.busy)
                waitlistCaption(plan)?.let { PlanFooterCaption(it) }
            }
        }
        else -> askFooterContent(askFooter(plan), viewModel, onVerify, onLocation)
    }
}

/** J1 and J2's footer: "Ask to join" (or why not) and its caption. */
private fun askFooterContent(
    footer: AskFooter,
    viewModel: PlanDetailViewModel,
    onVerify: () -> Unit,
    onLocation: () -> Unit,
): @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit =
    {
        PrimaryButton(
            title = footer.label,
            onClick = {
                when (footer.action) {
                    AskAction.Ask -> viewModel.openAsk()
                    AskAction.Verify -> onVerify()
                    AskAction.Location -> onLocation()
                    AskAction.None -> Unit
                }
            },
            isEnabled = footer.enabled && footer.action != AskAction.None,
            modifier = Modifier.height(50.dp),
        )
        footer.caption?.let { PlanFooterCaption(it) }
    }

@Composable
private fun LeaveDialog(
    kind: LeaveKind,
    plan: PlanDto,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val (title, body, action) =
        when (kind) {
            LeaveKind.Request -> Triple("Withdraw your request?", "${plan.hostFirst} won't see it anymore.", "Withdraw")
            LeaveKind.Waitlist -> Triple("Leave the waitlist?", "You'll lose your place in line.", "Leave")
            LeaveKind.Plan ->
                Triple(
                    "Can't make it?",
                    "Your spot goes to the next person waiting. You'll lose the exact place, the note and the chat.",
                    "Leave the plan",
                )
        }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(body) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(action, color = PantopusColors.error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Not now") } },
    )
}

@Composable
private fun ReportDialog(
    onReport: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Report this plan") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text("Pantopus reviews every report. The host isn't told who reported.")
                reportReasons.forEach { (key, label) -> PlanTextButton(title = label, onClick = { onReport(key) }) }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun PlanLoading(onBack: () -> Unit) {
    PlanPlainScaffold(onBack = onBack) {
        PlanRowsSkeleton(rows = 3)
    }
}

@Composable
private fun PlanGone(
    onBack: () -> Unit,
    onSeeAll: () -> Unit,
) {
    PlanPlainScaffold(onBack = onBack) {
        Column(modifier = Modifier.padding(top = Spacing.s8), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Text(
                text = "This plan isn't available",
                style = app.pantopus.android.ui.screens.plans.map.planH3,
                color = PantopusColors.appText,
            )
            Text(
                text = "It may have ended, been cancelled, or be just for neighbors closer by.",
                style = app.pantopus.android.ui.theme.PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
            GhostButton(title = "See other plans", onClick = onSeeAll, modifier = Modifier.height(50.dp))
        }
    }
}
