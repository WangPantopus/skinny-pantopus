@file:Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "TooManyFunctions")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.gigs.CancelGigReason
import app.pantopus.android.data.api.models.gigs.CancellationPreviewResponse
import app.pantopus.android.data.api.models.gigs.GigBidDto
import app.pantopus.android.data.api.models.gigs.GigChangeOrderDto
import app.pantopus.android.data.api.models.gigs.GigChangeOrderType
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatus
import app.pantopus.android.data.api.models.gigs.GigPaymentResponse
import app.pantopus.android.data.api.models.gigs.GigReportReason
import app.pantopus.android.ui.components.FutureDateTimePickerDialogs
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Phase 5 — gig detail lifecycle sections rendered in the shell's
 * scroll footer: the owner bids panel (work item 1), the active-task
 * panel (work item 4), the review affordance (work item 5), and the
 * Phase 5b completers (changes card, payment card, running-late sheet).
 * Counter / reject / review / no-show / change-order sheets are owned
 * here; the top-bar report + cancel sheets stay in [GigDetailScreen].
 */
@Composable
fun GigLifecycleSections(viewModel: GigDetailViewModel) {
    val bids by viewModel.bids.collectAsStateWithLifecycle()
    val offerRankings by viewModel.offerRankings.collectAsStateWithLifecycle()
    val bidActionInFlight by viewModel.bidActionInFlight.collectAsStateWithLifecycle()
    val activeTask by viewModel.activeTask.collectAsStateWithLifecycle()
    val reviewState by viewModel.reviewState.collectAsStateWithLifecycle()
    val payment by viewModel.payment.collectAsStateWithLifecycle()
    val changeOrders by viewModel.changeOrders.collectAsStateWithLifecycle()
    val changeOrderActionInFlight by viewModel.changeOrderActionInFlight.collectAsStateWithLifecycle()
    val fulfillment by viewModel.fulfillment.collectAsStateWithLifecycle()
    val fulfillmentActionInFlight by viewModel.fulfillmentActionInFlight.collectAsStateWithLifecycle()

    var counterTarget by remember { mutableStateOf<GigBidDto?>(null) }
    var rejectTarget by remember { mutableStateOf<GigBidDto?>(null) }

    /** Bid whose pending counter-offer the poster is about to withdraw. */
    var withdrawCounterTarget by remember { mutableStateOf<GigBidDto?>(null) }
    var noShowSheetVisible by remember { mutableStateOf(false) }
    var runningLateSheetVisible by remember { mutableStateOf(false) }
    var proposeChangeSheetVisible by remember { mutableStateOf(false) }
    // Assigned worker's pre-start "Can't make it" confirm (`POST /worker-release`).
    var cantMakeItConfirmVisible by remember { mutableStateOf(false) }

    val gig = viewModel.gigSnapshot()
    // Single source of truth with the projection: whenever this panel
    // renders, the read-only "N bids" module is suppressed above it.
    val ownerSeesBidsPanel =
        gig != null && GigDetailViewModel.Projection.ownerPanelHandlesBids(gig, viewModel.viewerIsOwner())

    if (ownerSeesBidsPanel) {
        GigOwnerBidsPanel(
            bids = bids,
            actionInFlightBidId = bidActionInFlight,
            onAccept = { viewModel.acceptBidAsOwner(it.id) },
            onCounter = { counterTarget = it },
            onReject = { rejectTarget = it },
            onWithdrawCounter = { withdrawCounterTarget = it },
            rankings = offerRankings,
        )
    }

    // RN copy verbatim (`OffersPanel.tsx:178`).
    withdrawCounterTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { withdrawCounterTarget = null },
            title = { Text("Withdraw counter-offer?") },
            text = { Text("The bid will revert to its original amount.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        withdrawCounterTarget = null
                        viewModel.withdrawCounterAsOwner(target.id)
                    },
                    modifier = Modifier.testTag("gigDetail.withdrawCounterConfirm"),
                ) {
                    Text("Withdraw", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { withdrawCounterTarget = null }) { Text("Keep counter") }
            },
        )
    }

    // Urgent / starts-asap live stepper (RN `ActiveTaskPanel`).
    fulfillment?.let { status ->
        GigFulfillmentPanel(
            status = status.status,
            etaLabel =
                status.helperEtaMinutes
                    ?.takeIf { status.status == GigFulfillmentStatus.OnTheWay }
                    ?.let { "ETA: ~$it min" },
            nextAction = viewModel.nextFulfillmentAction(),
            isBusy = fulfillmentActionInFlight,
            onAdvance = { viewModel.advanceFulfillment(it) },
        )
    }

    // "Remind worker" cooldown ticks locally so the button re-enables the
    // moment the server's 15-minute window lapses (RN ticks every 15s).
    val reminderCooldownEndsAt by viewModel.workerReminderCooldownEndsAt.collectAsStateWithLifecycle()
    var reminderNowMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(reminderCooldownEndsAt) {
        val endsAt = reminderCooldownEndsAt ?: return@LaunchedEffect
        while (System.currentTimeMillis() < endsAt) {
            reminderNowMillis = System.currentTimeMillis()
            delay(15_000L)
        }
        reminderNowMillis = System.currentTimeMillis()
    }
    val reminderCooldownLabel =
        reminderCooldownEndsAt
            ?.let { GigDetailViewModel.cooldownRemaining(it, reminderNowMillis) }
            ?.let { "Sent · retry in $it" }

    activeTask?.let { panel ->
        GigActiveTaskPanel(
            panel = panel,
            onWorkerAck = { viewModel.workerAck() },
            onRunningLate = { runningLateSheetVisible = true },
            onStartTask = { viewModel.startTask() },
            onConfirmCompletion = { viewModel.confirmCompletion() },
            onReportNoShow = { noShowSheetVisible = true },
            onCantMakeIt = { cantMakeItConfirmVisible = true },
            canRemindWorker = viewModel.canRemindWorker(),
            reminderCooldownLabel = reminderCooldownLabel,
            onRemindWorker = { viewModel.remindWorker() },
        )
    }

    // Worker's "Can't make it" confirm — releases them, drops the payment
    // hold, and reopens the task for bids. Copy mirrors the poster's
    // "Replace worker" dialog on the other side of the same transition.
    if (cantMakeItConfirmVisible) {
        AlertDialog(
            onDismissRequest = { cantMakeItConfirmVisible = false },
            title = { Text("Can't Make It") },
            text = {
                Text(
                    "This will unassign you from the task and reopen it for new bids. " +
                        "Any payment hold will be released.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        cantMakeItConfirmVisible = false
                        viewModel.releaseAssignment()
                    },
                    modifier = Modifier.testTag("gigDetail.cantMakeItConfirm"),
                ) {
                    Text("I Can't Make It", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { cantMakeItConfirmVisible = false }) { Text("Stay on the task") }
            },
        )
    }

    // 5b work item 2 — "Changes" card directly under the active panel.
    if (viewModel.showChangeOrders()) {
        GigChangeOrdersCard(
            orders = changeOrders,
            viewerUserId = viewModel.viewerUserId(),
            actionInFlightOrderId = changeOrderActionInFlight,
            onPropose = { proposeChangeSheetVisible = true },
            onApprove = { viewModel.approveChangeOrder(it.id) },
            onReject = { viewModel.rejectChangeOrder(it.id) },
            onWithdraw = { viewModel.withdrawChangeOrder(it.id) },
        )
    }

    // 5b work item 1 — compact payment card (owner, assigned+).
    payment?.let { GigPaymentCard(payment = it) }

    GigReviewSection(
        state = reviewState,
        onSubmit = { rating, comment -> viewModel.submitGigReview(rating, comment) },
    )

    if (runningLateSheetVisible) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { runningLateSheetVisible = false }, sheetState = sheetState) {
            GigRunningLateSheetContent(
                onSubmit = { etaMinutes, note ->
                    viewModel.workerRunningLate(etaMinutes, note) { ok ->
                        if (ok) runningLateSheetVisible = false
                    }
                },
                onCancel = { runningLateSheetVisible = false },
            )
        }
    }

    if (proposeChangeSheetVisible) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { proposeChangeSheetVisible = false }, sheetState = sheetState) {
            GigProposeChangeSheetContent(
                onSubmit = { type, description, amountChange, timeChangeMinutes ->
                    viewModel.proposeChangeOrder(type, description, amountChange, timeChangeMinutes) { ok ->
                        if (ok) proposeChangeSheetVisible = false
                    }
                },
                onCancel = { proposeChangeSheetVisible = false },
            )
        }
    }

    counterTarget?.let { target ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { counterTarget = null }, sheetState = sheetState) {
            GigCounterSheetContent(
                bid = target,
                onSubmit = { amount, message ->
                    viewModel.counterBidAsOwner(target.id, amount, message) { ok ->
                        if (ok) counterTarget = null
                    }
                },
                onCancel = { counterTarget = null },
            )
        }
    }

    rejectTarget?.let { target ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { rejectTarget = null }, sheetState = sheetState) {
            GigRejectConfirmContent(
                bid = target,
                onConfirm = {
                    viewModel.rejectBidAsOwner(target.id)
                    rejectTarget = null
                },
                onCancel = { rejectTarget = null },
            )
        }
    }

    if (noShowSheetVisible) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { noShowSheetVisible = false }, sheetState = sheetState) {
            GigNoShowSheetContent(
                onSubmit = { description ->
                    viewModel.reportNoShow(description) { ok ->
                        if (ok) noShowSheetVisible = false
                    }
                },
                onCancel = { noShowSheetVisible = false },
            )
        }
    }
}

// MARK: - Work item 1 · owner bids panel

@Composable
private fun GigOwnerBidsPanel(
    bids: List<GigBidDto>,
    actionInFlightBidId: String?,
    onAccept: (GigBidDto) -> Unit,
    onCounter: (GigBidDto) -> Unit,
    onReject: (GigBidDto) -> Unit,
    onWithdrawCounter: (GigBidDto) -> Unit,
    rankings: Map<String, GigOfferRanking> = emptyMap(),
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("gigDetail.bids"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Bids on your task",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        if (bids.isEmpty()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s4),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "No bids yet",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        } else {
            bids.forEach { bid ->
                GigOwnerBidRow(
                    bid = bid,
                    busy = actionInFlightBidId != null,
                    onAccept = { onAccept(bid) },
                    onCounter = { onCounter(bid) },
                    onReject = { onReject(bid) },
                    onWithdrawCounter = { onWithdrawCounter(bid) },
                    ranking = rankings[bid.id],
                )
            }
        }
    }
}

@Composable
private fun GigOwnerBidRow(
    bid: GigBidDto,
    busy: Boolean,
    onAccept: () -> Unit,
    onCounter: () -> Unit,
    onReject: () -> Unit,
    onWithdrawCounter: () -> Unit,
    ranking: GigOfferRanking? = null,
) {
    val identity = bid.bidderIdentity()
    val name = identity?.resolvedDisplayName() ?: "Bidder"
    val rejected = bid.status?.lowercase() in listOf("rejected", "declined", "withdrawn")
    val countered = bid.hasPendingCounter
    val amount = bid.bidAmount ?: bid.amount ?: 0.0
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .alpha(if (rejected) 0.55f else 1f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("gigDetail.bid_${bid.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            BidderAvatar(name = name, avatarUrl = identity?.resolvedAvatarUrl())
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = name,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    if (identity?.resolvedVerified() == true) {
                        PantopusIconImage(
                            icon = PantopusIcon.ShieldCheck,
                            contentDescription = "Verified neighbor",
                            size = 14.dp,
                            tint = PantopusColors.primary600,
                        )
                    }
                }
                relativeAgeLabel(bid.createdAt)?.let { age ->
                    Text(text = age, fontSize = 11.sp, color = PantopusColors.appTextMuted)
                }
                // v2 scored offers carry a trust capsule — "4.9★ · 12 tasks"
                // (`backend/routes/offersV2.js:47`); the `/bids` fallback has none.
                ranking?.trustLine?.let { trust ->
                    Text(
                        text = trust,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.testTag("gigDetail.bid_${bid.id}.trust"),
                    )
                }
            }
            if (ranking?.isRecommended == true) {
                Text(
                    text = "BEST MATCH",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = PantopusColors.primary700,
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(PantopusColors.primary50)
                            .padding(horizontal = Spacing.s2, vertical = 2.dp)
                            .testTag("gigDetail.bid_${bid.id}.bestMatch"),
                )
            }
            Text(
                text = formatBidAmount(amount),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
        }
        bid.message?.takeIf { it.isNotBlank() }?.let { message ->
            Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        }
        when {
            rejected ->
                Text(
                    text = "Rejected",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextMuted,
                )
            countered ->
                // RN keeps the poster in control while the bidder mulls it
                // over: the counter can be pulled back and the bid reverts
                // to its original amount (`OffersPanel.tsx:443`).
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.ArrowsRepeat,
                            contentDescription = null,
                            size = 13.dp,
                            tint = PantopusColors.warning,
                        )
                        Text(
                            text = "Countered ${formatBidAmount(bid.counterAmount ?: 0.0)}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.warning,
                        )
                    }
                    Text(
                        text = "Waiting for the bidder to respond to your counter.",
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    BidActionButton(
                        label = "Withdraw counter",
                        prominent = false,
                        enabled = !busy,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .testTag("gigDetail.bid_${bid.id}.withdrawCounter"),
                        onClick = onWithdrawCounter,
                    )
                }
            else ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    BidActionButton(
                        label = "Accept",
                        prominent = true,
                        enabled = !busy,
                        modifier = Modifier.weight(1f).testTag("gigDetail.bid_${bid.id}.accept"),
                        onClick = onAccept,
                    )
                    BidActionButton(
                        label = "Counter",
                        prominent = false,
                        enabled = !busy,
                        modifier = Modifier.weight(1f).testTag("gigDetail.bid_${bid.id}.counter"),
                        onClick = onCounter,
                    )
                    BidActionButton(
                        label = "Reject",
                        prominent = false,
                        destructive = true,
                        enabled = !busy,
                        modifier = Modifier.weight(1f).testTag("gigDetail.bid_${bid.id}.reject"),
                        onClick = onReject,
                    )
                }
        }
    }
}

@Composable
private fun BidderAvatar(
    name: String,
    avatarUrl: String?,
) {
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(PantopusColors.primary50),
        contentAlignment = Alignment.Center,
    ) {
        if (!avatarUrl.isNullOrEmpty()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(36.dp).clip(CircleShape),
            )
        } else {
            Text(
                text = initialsOf(name),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun BidActionButton(
    label: String,
    prominent: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    val background =
        when {
            !enabled -> PantopusColors.appSurfaceSunken
            prominent -> PantopusColors.primary600
            else -> PantopusColors.appSurfaceSunken
        }
    val foreground =
        when {
            !enabled -> PantopusColors.appTextMuted
            prominent -> PantopusColors.appTextInverse
            destructive -> PantopusColors.error
            else -> PantopusColors.appText
        }
    Box(
        modifier =
            modifier
                .heightIn(min = 38.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = foreground)
    }
}

/** Counter-offer sheet: amount + optional message (`POST .../counter`). */
@Composable
fun GigCounterSheetContent(
    bid: GigBidDto,
    onSubmit: (amount: Double, message: String?) -> Unit,
    onCancel: () -> Unit,
) {
    var amountText by remember { mutableStateOf("") }
    var messageText by remember { mutableStateOf("") }
    val amount =
        amountText.trim().replace("$", "").replace(",", "").toDoubleOrNull()?.takeIf { it > 0 }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.counterSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Send a counter-offer",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "Their bid is ${formatBidAmount(bid.bidAmount ?: bid.amount ?: 0.0)}. " +
                        "Propose your price — they can accept or decline.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(text = "$", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            BasicTextField(
                value = amountText,
                onValueChange = { amountText = it },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                textStyle =
                    PantopusTextStyle.body.copy(
                        color = PantopusColors.appText,
                        fontWeight = FontWeight.SemiBold,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.weight(1f).testTag("gigDetail.counterSheet.amount"),
                decorationBox = { inner ->
                    if (amountText.isEmpty()) {
                        Text(text = "0.00", style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
                    }
                    inner()
                },
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 72.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = messageText,
                onValueChange = { messageText = it.take(500) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.counterSheet.message"),
                decorationBox = { inner ->
                    if (messageText.isEmpty()) {
                        Text(
                            text = "Add a note (optional)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(
                label = "Cancel",
                modifier = Modifier.weight(1f),
                onClick = onCancel,
            )
            SheetPrimaryButton(
                label = "Send counter",
                enabled = amount != null,
                modifier = Modifier.weight(1f).testTag("gigDetail.counterSheet.submit"),
                onClick = { amount?.let { onSubmit(it, messageText.trim().ifEmpty { null }) } },
            )
        }
    }
}

/** Two-step reject confirmation before `POST .../reject`. */
@Composable
private fun GigRejectConfirmContent(
    bid: GigBidDto,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    val name = bid.bidderIdentity()?.resolvedDisplayName() ?: "this bidder"
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Reject this bid?",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "$name will be notified that their bid wasn't selected. This can't be undone.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Keep bid", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetDestructiveButton(
                label = "Reject bid",
                modifier = Modifier.weight(1f).testTag("gigDetail.rejectConfirm"),
                onClick = onConfirm,
            )
        }
    }
}

// MARK: - Work item 4 · active-task panel

@Composable
private fun GigActiveTaskPanel(
    panel: GigActiveTaskUi,
    onWorkerAck: () -> Unit,
    onRunningLate: () -> Unit,
    onStartTask: () -> Unit,
    onConfirmCompletion: () -> Unit,
    onReportNoShow: () -> Unit,
    onCantMakeIt: () -> Unit,
    /** Poster-only "Remind worker" nudge — assigned, pre-start. */
    canRemindWorker: Boolean = false,
    /** `"Sent · retry in 12m"` while the server's cooldown stands. */
    reminderCooldownLabel: String? = null,
    onRemindWorker: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("gigDetail.activePanel"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Task progress",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        GigPhaseStrip(activeIndex = panel.phaseIndex)
        // 5b work item 3 — both roles see the late badge under the strip.
        if (panel.runningLate) {
            Row(
                modifier = Modifier.testTag("gigDetail.lateBadge"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Clock,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    text =
                        panel.lateEtaMinutes?.let { "Running ~$it min late" }
                            ?: "Running late",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.warning,
                )
            }
        }
        if (panel.acked) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.success,
                )
                Text(
                    text = "You let the owner know you're on it",
                    fontSize = 12.sp,
                    color = PantopusColors.success,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (panel.showWorkerAck) {
                ActivePanelButton(
                    label = "I'm on it",
                    icon = PantopusIcon.Hand,
                    prominent = false,
                    modifier = Modifier.testTag("gigDetail.workerAck"),
                    onClick = onWorkerAck,
                )
            }
            if (panel.showRunningLate) {
                ActivePanelButton(
                    label = "Running late",
                    icon = PantopusIcon.Clock,
                    prominent = false,
                    modifier = Modifier.testTag("gigDetail.runningLate"),
                    onClick = onRunningLate,
                )
            }
            if (panel.showStartTask) {
                ActivePanelButton(
                    label = "Start task",
                    icon = PantopusIcon.Play,
                    prominent = true,
                    modifier = Modifier.testTag("gigDetail.startTask"),
                    onClick = onStartTask,
                )
            }
            if (canRemindWorker) {
                ActivePanelButton(
                    label = reminderCooldownLabel ?: "Remind worker",
                    icon = PantopusIcon.Bell,
                    prominent = reminderCooldownLabel == null,
                    enabled = reminderCooldownLabel == null,
                    modifier = Modifier.testTag("gigDetail.remindWorker"),
                    onClick = onRemindWorker,
                )
                Text(
                    text = "Nudges the worker to begin. You can send one every 15 minutes.",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (panel.showConfirmCompletion) {
                ActivePanelButton(
                    label = "Confirm completion",
                    icon = PantopusIcon.CheckCheck,
                    prominent = true,
                    modifier = Modifier.testTag("gigDetail.confirmCompletion"),
                    onClick = onConfirmCompletion,
                )
            }
            if (panel.showNoShow) {
                ActivePanelButton(
                    label = "Report a no-show",
                    icon = PantopusIcon.AlertTriangle,
                    prominent = false,
                    destructive = true,
                    modifier = Modifier.testTag("gigDetail.noShow"),
                    onClick = onReportNoShow,
                )
            }
            if (panel.showCantMakeIt) {
                ActivePanelButton(
                    label = "Can't make it",
                    icon = PantopusIcon.XCircle,
                    prominent = false,
                    destructive = true,
                    modifier = Modifier.testTag("gigDetail.cantMakeIt"),
                    onClick = onCantMakeIt,
                )
                Text(
                    text = "Releases you and reopens the task for new bids.",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

private val PHASE_LABELS = listOf("Assigned", "In progress", "Marked done", "Confirmed")

@Composable
private fun GigPhaseStrip(activeIndex: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PHASE_LABELS.forEachIndexed { index, label ->
            val reached = index <= activeIndex
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(if (reached) PantopusColors.primary600 else PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    if (reached) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 12.dp,
                            tint = PantopusColors.appTextInverse,
                        )
                    }
                }
                Text(
                    text = label,
                    fontSize = 10.sp,
                    fontWeight = if (index == activeIndex) FontWeight.Bold else FontWeight.Medium,
                    color = if (reached) PantopusColors.appText else PantopusColors.appTextMuted,
                )
            }
            if (index < PHASE_LABELS.lastIndex) {
                Box(
                    modifier =
                        Modifier
                            .weight(0.4f)
                            .height(2.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(
                                if (index < activeIndex) PantopusColors.primary600 else PantopusColors.appBorder,
                            ),
                )
            }
        }
    }
}

@Composable
private fun ActivePanelButton(
    label: String,
    icon: PantopusIcon,
    prominent: Boolean,
    modifier: Modifier = Modifier,
    destructive: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val background = if (prominent) PantopusColors.primary600 else PantopusColors.appSurfaceSunken
    val foreground =
        when {
            !enabled -> PantopusColors.appTextMuted
            prominent -> PantopusColors.appTextInverse
            destructive -> PantopusColors.error
            else -> PantopusColors.appText
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .clickable(enabled = enabled, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = foreground)
        Spacer(modifier = Modifier.width(Spacing.s2))
        Text(text = label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = foreground)
    }
}

/** No-show report sheet — optional description → `POST /report-no-show`. */
@Composable
private fun GigNoShowSheetContent(
    onSubmit: (String?) -> Unit,
    onCancel: () -> Unit,
) {
    var description by remember { mutableStateOf("") }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.noShowSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Report a no-show",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text =
                "This cancels the task and files an incident against the " +
                    "other party. Only report after the agreed start time has passed.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 88.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = description,
                onValueChange = { description = it.take(1000) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 3,
                maxLines = 6,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.noShowSheet.details"),
                decorationBox = { inner ->
                    if (description.isEmpty()) {
                        Text(
                            text = "What happened? (optional)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Back", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetDestructiveButton(
                label = "Report no-show",
                modifier = Modifier.weight(1f).testTag("gigDetail.noShowSheet.submit"),
                onClick = { onSubmit(description.trim().ifEmpty { null }) },
            )
        }
    }
}

// MARK: - Phase 5b work item 3 · running late

private val LATE_ETA_CHOICES_MINUTES = listOf(10, 20, 30, 45, 60)

/** Worker "Running late" sheet — ETA chips + optional note → `POST /worker-ack`. */
@Composable
fun GigRunningLateSheetContent(
    onSubmit: (etaMinutes: Int?, note: String?) -> Unit,
    onCancel: () -> Unit,
) {
    var selectedEta by remember { mutableStateOf<Int?>(null) }
    var note by remember { mutableStateOf("") }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.runningLateSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Running late?",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Let the owner know roughly how long you'll be.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            LATE_ETA_CHOICES_MINUTES.forEach { minutes ->
                val selected = selectedEta == minutes
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = 40.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (selected) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                            .clickable { selectedEta = if (selected) null else minutes }
                            .testTag("gigDetail.runningLateSheet.eta_$minutes"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "${minutes}m",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (selected) PantopusColors.appTextInverse else PantopusColors.appText,
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = note,
                onValueChange = { note = it.take(1000) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.runningLateSheet.note"),
                decorationBox = { inner ->
                    if (note.isEmpty()) {
                        Text(
                            text = "Add a note (optional)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Back", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetPrimaryButton(
                label = "Send update",
                modifier = Modifier.weight(1f).testTag("gigDetail.runningLateSheet.submit"),
                onClick = { onSubmit(selectedEta, note.trim().ifEmpty { null }) },
            )
        }
    }
}

// MARK: - Phase 5b work item 2 · change orders

/** "Changes" card — rows + role-gated actions + "Propose a change". */
@Composable
private fun GigChangeOrdersCard(
    orders: List<GigChangeOrderDto>,
    viewerUserId: String?,
    actionInFlightOrderId: String?,
    onPropose: () -> Unit,
    onApprove: (GigChangeOrderDto) -> Unit,
    onReject: (GigChangeOrderDto) -> Unit,
    onWithdraw: (GigChangeOrderDto) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("gigDetail.changes"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Changes",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        orders.forEach { order ->
            GigChangeOrderRow(
                order = order,
                viewerIsRequester = viewerUserId != null && viewerUserId == order.requestedBy,
                busy = actionInFlightOrderId != null,
                onApprove = { onApprove(order) },
                onReject = { onReject(order) },
                onWithdraw = { onWithdraw(order) },
            )
        }
        ActivePanelButton(
            label = "Propose a change",
            icon = PantopusIcon.ArrowsRepeat,
            prominent = false,
            modifier = Modifier.testTag("gigDetail.changes.propose"),
            onClick = onPropose,
        )
    }
}

@Composable
private fun GigChangeOrderRow(
    order: GigChangeOrderDto,
    viewerIsRequester: Boolean,
    busy: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    onWithdraw: () -> Unit,
) {
    val resolved = order.status?.lowercase() in listOf("rejected", "withdrawn")
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .alpha(if (resolved) 0.55f else 1f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("gigDetail.change_${order.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = GigChangeOrderType.fromWire(order.type)?.label ?: "Change",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                order.description?.takeIf { it.isNotBlank() }?.let { description ->
                    Text(text = description, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
                }
            }
            changeAmountLabel(order)?.let { delta ->
                Text(
                    text = delta,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
            }
            ChangeOrderStatusChip(status = order.status)
        }
        if (order.isPending) {
            if (viewerIsRequester) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    BidActionButton(
                        label = "Withdraw",
                        prominent = false,
                        destructive = true,
                        enabled = !busy,
                        modifier = Modifier.weight(1f).testTag("gigDetail.change_${order.id}.withdraw"),
                        onClick = onWithdraw,
                    )
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    BidActionButton(
                        label = "Approve",
                        prominent = true,
                        enabled = !busy,
                        modifier = Modifier.weight(1f).testTag("gigDetail.change_${order.id}.approve"),
                        onClick = onApprove,
                    )
                    BidActionButton(
                        label = "Reject",
                        prominent = false,
                        destructive = true,
                        enabled = !busy,
                        modifier = Modifier.weight(1f).testTag("gigDetail.change_${order.id}.reject"),
                        onClick = onReject,
                    )
                }
            }
        }
    }
}

@Composable
private fun ChangeOrderStatusChip(status: String?) {
    val (label, tint) =
        when (status?.lowercase()) {
            "approved" -> "Approved" to PantopusColors.success
            "rejected" -> "Rejected" to PantopusColors.error
            "withdrawn" -> "Withdrawn" to PantopusColors.appTextMuted
            else -> "Pending" to PantopusColors.warning
        }
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
    ) {
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = tint)
    }
}

/** "+$15" / "−$10" / "+30 min" summary for a change-order row. */
private fun changeAmountLabel(order: GigChangeOrderDto): String? {
    val amount = order.amountChange ?: 0.0
    if (amount != 0.0) {
        val sign = if (amount > 0) "+" else "−"
        return "$sign${formatBidAmount(kotlin.math.abs(amount))}"
    }
    val minutes = order.timeChangeMinutes ?: 0
    if (minutes != 0) return if (minutes > 0) "+$minutes min" else "−${kotlin.math.abs(minutes)} min"
    return null
}

/** Propose-a-change sheet → `POST /change-orders`. */
@Composable
fun GigProposeChangeSheetContent(
    onSubmit: (GigChangeOrderType, String, Double?, Int?) -> Unit,
    onCancel: () -> Unit,
) {
    var selectedType by remember { mutableStateOf<GigChangeOrderType?>(null) }
    var description by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var minutesText by remember { mutableStateOf("") }
    val amount = amountText.trim().replace("$", "").replace(",", "").toDoubleOrNull()
    val minutes = minutesText.trim().toIntOrNull()
    val valid = selectedType != null && description.trim().length >= 5
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.changesSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Propose a change",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "The other party has to approve before it takes effect.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            GigChangeOrderType.entries.forEach { type ->
                ReasonRadioRow(
                    label = type.label,
                    selected = selectedType == type,
                    testTag = "gigDetail.changesSheet.${type.wireValue}",
                    onClick = { selectedType = type },
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = description,
                onValueChange = { description = it.take(2000) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 2,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.changesSheet.description"),
                decorationBox = { inner ->
                    if (description.isEmpty()) {
                        Text(
                            text = "What's changing? (at least 5 characters)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(text = "±$", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
                BasicTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText, fontWeight = FontWeight.SemiBold),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    modifier = Modifier.weight(1f).testTag("gigDetail.changesSheet.amount"),
                    decorationBox = { inner ->
                        if (amountText.isEmpty()) {
                            Text(text = "0.00", style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
                        }
                        inner()
                    },
                )
            }
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                BasicTextField(
                    value = minutesText,
                    onValueChange = { minutesText = it },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText, fontWeight = FontWeight.SemiBold),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    modifier = Modifier.weight(1f).testTag("gigDetail.changesSheet.minutes"),
                    decorationBox = { inner ->
                        if (minutesText.isEmpty()) {
                            Text(text = "0", style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
                        }
                        inner()
                    },
                )
                Text(text = "min", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Cancel", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetPrimaryButton(
                label = "Send request",
                enabled = valid,
                modifier = Modifier.weight(1f).testTag("gigDetail.changesSheet.submit"),
                onClick = {
                    val type = selectedType ?: return@SheetPrimaryButton
                    onSubmit(
                        type,
                        description.trim(),
                        normalizedAmountChange(type, amount),
                        minutes,
                    )
                },
            )
        }
    }
}

/** Price-increase amounts go up, price-decrease amounts go down. */
private fun normalizedAmountChange(
    type: GigChangeOrderType,
    amount: Double?,
): Double? {
    if (amount == null || amount == 0.0) return null
    return when (type) {
        GigChangeOrderType.PriceIncrease -> kotlin.math.abs(amount)
        GigChangeOrderType.PriceDecrease -> -kotlin.math.abs(amount)
        else -> amount
    }
}

// MARK: - Phase 5b work item 1 · payment card

/** Compact payment summary (owner, assigned+) from `GET /payment`. */
@Composable
private fun GigPaymentCard(payment: GigPaymentResponse) {
    val row = payment.payment ?: return
    val totalCents = (row.amountTotal ?: 0) + (row.tipAmount ?: 0)
    val feesCents = (row.amountPlatformFee ?: 0) + (row.amountProcessingFee ?: 0)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("gigDetail.payment"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = "Payment",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PaymentStatusChip(
                label = payment.stateInfo?.label ?: prettyPaymentStatus(row.paymentStatus),
                color = payment.stateInfo?.color,
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PaymentLine(label = "Subtotal", amount = formatCents(row.amountSubtotal ?: 0))
            PaymentLine(label = "Fees", amount = formatCents(feesCents))
            if ((row.tipAmount ?: 0) > 0) {
                PaymentLine(label = "Tip", amount = formatCents(row.tipAmount ?: 0))
            }
            PaymentLine(
                label = "Total",
                amount = formatCents(totalCents),
                emphasized = true,
                modifier = Modifier.testTag("gigDetail.payment.total"),
            )
        }
    }
}

@Composable
private fun PaymentLine(
    label: String,
    amount: String,
    modifier: Modifier = Modifier,
    emphasized: Boolean = false,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            fontSize = if (emphasized) 14.sp else 13.sp,
            fontWeight = if (emphasized) FontWeight.Bold else FontWeight.Medium,
            color = if (emphasized) PantopusColors.appText else PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = amount,
            fontSize = if (emphasized) 15.sp else 13.sp,
            fontWeight = if (emphasized) FontWeight.Bold else FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun PaymentStatusChip(
    label: String,
    color: String?,
) {
    // `stateInfo.color` from `getPaymentStateInfo`: green/yellow/red/blue/gray.
    val tint =
        when (color) {
            "green" -> PantopusColors.success
            "yellow" -> PantopusColors.warning
            "red" -> PantopusColors.error
            "blue" -> PantopusColors.primary600
            else -> PantopusColors.appTextMuted
        }
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
    ) {
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = tint)
    }
}

/** `captured_hold` → "Captured hold" when the backend sends no stateInfo. */
private fun prettyPaymentStatus(status: String?): String =
    status?.takeIf { it.isNotBlank() }
        ?.replace('_', ' ')
        ?.replaceFirstChar { it.uppercase() }
        ?: "Payment"

/** Integer cents → "$12.34". */
private fun formatCents(cents: Int): String = String.format(Locale.US, "$%.2f", cents / 100.0)

// MARK: - Work item 5 · reviews

@Composable
private fun GigReviewSection(
    state: GigReviewState,
    onSubmit: suspend (rating: Int, comment: String?) -> Boolean,
) {
    if (state is GigReviewState.Hidden) return
    var sheetVisible by remember { mutableStateOf(false) }
    var presetRating by remember { mutableStateOf(0) }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4)
                .testTag("gigDetail.review"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "How did it go?",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        when (state) {
            is GigReviewState.Submitted ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 15.dp,
                        tint = PantopusColors.success,
                    )
                    Text(
                        text = "Reviewed — thanks for helping the neighborhood",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.success,
                        modifier = Modifier.testTag("gigDetail.review.done"),
                    )
                }
            is GigReviewState.Available -> {
                Row(
                    modifier = Modifier.testTag("gigDetail.review.stars"),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    for (value in 1..5) {
                        Box(
                            modifier =
                                Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .clickable {
                                        presetRating = value
                                        sheetVisible = true
                                    },
                            contentAlignment = Alignment.Center,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.Star,
                                contentDescription = "$value star" + if (value == 1) "" else "s",
                                size = 26.dp,
                                tint = PantopusColors.appBorderStrong,
                            )
                        }
                    }
                }
                Text(
                    text = "Leave a review — it only takes a moment.",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            is GigReviewState.Hidden -> Unit
        }
    }

    if (sheetVisible && state is GigReviewState.Available) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { sheetVisible = false }, sheetState = sheetState) {
            GigReviewSheetContent(
                initialRating = presetRating,
                revieweeName = state.revieweeName,
                onSubmit = { rating, comment ->
                    val ok = onSubmit(rating, comment)
                    if (ok) sheetVisible = false
                    ok
                },
                onCancel = { sheetVisible = false },
            )
        }
    }
}

/** Star row + comment sheet → `POST /api/reviews` (route `backend/routes/reviews.js:35`). */
@Composable
private fun GigReviewSheetContent(
    initialRating: Int,
    revieweeName: String?,
    onSubmit: suspend (rating: Int, comment: String?) -> Boolean,
    onCancel: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var rating by remember { mutableStateOf(initialRating) }
    var comment by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.review.sheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = if (revieweeName.isNullOrEmpty()) "Leave a review" else "Review $revieweeName",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            for (value in 1..5) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .clickable { rating = value }
                            .testTag("gigDetail.review.star_$value"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Star,
                        contentDescription = "$value star" + if (value == 1) "" else "s",
                        size = 30.dp,
                        tint = if (value <= rating) PantopusColors.warning else PantopusColors.appBorderStrong,
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 88.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = comment,
                onValueChange = { comment = it.take(2000) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 3,
                maxLines = 6,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.review.comment"),
                decorationBox = { inner ->
                    if (comment.isEmpty()) {
                        Text(
                            text = "Anything the neighborhood should know? (optional)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Not now", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetPrimaryButton(
                label = if (submitting) "Submitting…" else "Submit review",
                enabled = rating in 1..5 && !submitting,
                modifier = Modifier.weight(1f).testTag("gigDetail.review.submit"),
                onClick = {
                    if (rating !in 1..5 || submitting) return@SheetPrimaryButton
                    submitting = true
                    scope.launch {
                        try {
                            onSubmit(rating, comment.trim().ifEmpty { null })
                        } finally {
                            submitting = false
                        }
                    }
                },
            )
        }
    }
}

// MARK: - Work item 6 · report sheet

/** Moderation report sheet — reason radios + details (`POST /report`). */
@Composable
fun GigReportSheetContent(
    onSubmit: (GigReportReason, String?) -> Unit,
    onCancel: () -> Unit,
) {
    var selected by remember { mutableStateOf<GigReportReason?>(null) }
    var details by remember { mutableStateOf("") }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.reportSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Report this task",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            GigReportReason.entries.forEach { reason ->
                ReasonRadioRow(
                    label = reason.label,
                    selected = selected == reason,
                    testTag = "gigDetail.reportSheet.${reason.wireValue}",
                    onClick = { selected = reason },
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = details,
                onValueChange = { details = it.take(1000) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 2,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.reportSheet.details"),
                decorationBox = { inner ->
                    if (details.isEmpty()) {
                        Text(
                            text = "Add details (optional)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Cancel", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetDestructiveButton(
                label = "Send report",
                enabled = selected != null,
                modifier = Modifier.weight(1f).testTag("gigDetail.reportSheet.submit"),
                onClick = { selected?.let { onSubmit(it, details.trim().ifEmpty { null }) } },
            )
        }
    }
}

// MARK: - Work item 7 · cancel with fee preview

/** Owner cancel sheet — zone label + fee copy + reason radios. */
@Composable
fun GigCancelSheetContent(
    preview: CancellationPreviewResponse?,
    previewLoading: Boolean,
    onConfirm: (CancelGigReason) -> Unit,
    onCancel: () -> Unit,
    /** P6b — opens the reschedule sheet when `can_reschedule` allows it. */
    onReschedule: (() -> Unit)? = null,
) {
    var selected by remember { mutableStateOf<CancelGigReason?>(null) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.cancelSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Cancel this task?",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        when {
            previewLoading ->
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 220.dp, height = 16.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 160.dp, height = 12.dp, cornerRadius = Radii.xs)
                }
            preview != null ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurfaceSunken)
                            .padding(Spacing.s3)
                            .testTag("gigDetail.cancelSheet.preview"),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = preview.zoneLabel ?: "Cancellation",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = cancellationFeeCopy(preview),
                        fontSize = 12.sp,
                        color =
                            if ((preview.fee ?: 0.0) > 0.0) {
                                PantopusColors.error
                            } else {
                                PantopusColors.appTextSecondary
                            },
                    )
                    preview.policyLabel?.let { policy ->
                        Text(
                            text = "Policy: $policy",
                            fontSize = 11.sp,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                }
            else -> Unit
        }
        // P6b — `POST /reschedule` (`backend/routes/gigs.js:6405`) closes
        // the Phase 5b deferral: while the preview's `can_reschedule`
        // gate allows it, the poster can move the start time instead.
        if (preview?.canReschedule == true && onReschedule != null) {
            SheetGhostButton(
                label = "Reschedule instead",
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.reschedule"),
                onClick = onReschedule,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CancelGigReason.entries.forEach { reason ->
                ReasonRadioRow(
                    label = reason.label,
                    selected = selected == reason,
                    testTag = "gigDetail.cancelSheet.${reason.wireValue}",
                    onClick = { selected = reason },
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(label = "Keep task", modifier = Modifier.weight(1f), onClick = onCancel)
            SheetDestructiveButton(
                label = "Cancel task",
                enabled = selected != null,
                modifier = Modifier.weight(1f).testTag("gigDetail.cancelSheet.confirm"),
                onClick = { selected?.let(onConfirm) },
            )
        }
    }
}

private fun cancellationFeeCopy(preview: CancellationPreviewResponse): String {
    val fee = preview.fee ?: 0.0
    return when {
        preview.inGrace == true || fee <= 0.0 -> "No cancellation fee right now."
        else -> "A ${formatBidAmount(fee)} cancellation fee applies (${preview.feePct?.toInt() ?: 0}% of the task price)."
    }
}

// MARK: - P6b · reschedule instead of cancelling

/**
 * P6b — poster moves an assigned task to a new future start
 * (`POST /reschedule`, `backend/routes/gigs.js:6405`). Offered from the
 * cancel sheet while the preview's `can_reschedule` gate allows it;
 * reuses [FutureDateTimePickerDialogs] plus an optional note that lands
 * in the worker's `gig_rescheduled` notification.
 */
@Composable
fun GigRescheduleSheetContent(
    initialStart: LocalDateTime?,
    onConfirm: (LocalDateTime, String?) -> Unit,
    onCancel: () -> Unit,
) {
    var pickedStart by remember { mutableStateOf<LocalDateTime?>(null) }
    var note by remember { mutableStateOf("") }
    var showPicker by remember { mutableStateOf(false) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("gigDetail.rescheduleSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "Reschedule this task",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Pick a new start time — your helper will be notified.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable { showPicker = true }
                    .padding(horizontal = Spacing.s3)
                    .testTag("gigDetail.rescheduleSheet.date"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = pickedStart?.format(RescheduleStartFormatter) ?: "Choose a new time",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = if (pickedStart == null) PantopusColors.appTextMuted else PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s3),
        ) {
            BasicTextField(
                value = note,
                onValueChange = { note = it.take(500) },
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth().testTag("gigDetail.rescheduleSheet.note"),
                decorationBox = { inner ->
                    if (note.isEmpty()) {
                        Text(
                            text = "Add a note for your helper (optional)",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SheetGhostButton(
                label = "Back",
                modifier = Modifier.weight(1f).testTag("gigDetail.rescheduleSheet.cancel"),
                onClick = onCancel,
            )
            SheetPrimaryButton(
                label = "Reschedule",
                enabled = pickedStart != null,
                modifier = Modifier.weight(1f).testTag("gigDetail.rescheduleSheet.confirm"),
                onClick = { pickedStart?.let { onConfirm(it, note.trim().ifEmpty { null }) } },
            )
        }
    }
    if (showPicker) {
        FutureDateTimePickerDialogs(
            initial = pickedStart ?: initialStart,
            onPicked = { picked ->
                showPicker = false
                pickedStart = picked
            },
            onDismiss = { showPicker = false },
        )
    }
}

private val RescheduleStartFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US)

// MARK: - Shared bits

@Composable
private fun ReasonRadioRow(
    label: String,
    selected: Boolean,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.dp,
                    color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = "Selected",
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun SheetPrimaryButton(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun SheetDestructiveButton(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) PantopusColors.error else PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun SheetGhostButton(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
    }
}

private fun initialsOf(name: String): String =
    name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase().ifEmpty { "?" }

private fun formatBidAmount(amount: Double): String =
    if (amount % 1.0 == 0.0) "$${amount.toInt()}" else String.format(Locale.US, "$%.2f", amount)

private fun relativeAgeLabel(iso: String?): String? {
    if (iso.isNullOrEmpty()) return null
    return runCatching {
        val seconds = Duration.between(Instant.parse(iso), Instant.now()).seconds
        when {
            seconds < 60 -> "just now"
            seconds < 3_600 -> "${seconds / 60}m ago"
            seconds < 86_400 -> "${seconds / 3_600}h ago"
            else -> "${seconds / 86_400}d ago"
        }
    }.getOrNull()
}
