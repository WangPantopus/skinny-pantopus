@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.ui.screens.my_bids.EditBidSheetContent
import app.pantopus.android.ui.screens.my_bids.EditBidSheetTarget
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.stripe.android.paymentsheet.rememberPaymentSheet
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

@Suppress("CyclomaticComplexMethod")
@Composable
fun GigDetailScreen(
    onBack: () -> Unit = {},
    onOpenChat: (roomId: String, displayName: String, initials: String, verified: Boolean) -> Unit = { _, _, _, _ -> },
    viewModel: GigDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tipStatus by viewModel.tipStatus.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val cancelPreview by viewModel.cancelPreview.collectAsStateWithLifecycle()
    val cancelPreviewLoading by viewModel.cancelPreviewLoading.collectAsStateWithLifecycle()
    // Bidder side — the viewer's own live bid, if any.
    val viewerBid by viewModel.viewerBid.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var sheetTarget by remember { mutableStateOf<EditBidSheetTarget?>(null) }
    var deliveryTarget by remember { mutableStateOf<DeliveryProofTarget?>(null) }
    var showTipSheet by remember { mutableStateOf(false) }
    var showReportSheet by remember { mutableStateOf(false) }
    var showCancelSheet by remember { mutableStateOf(false) }
    var showRescheduleSheet by remember { mutableStateOf(false) }
    // Poster's pre-start "Replace worker" confirm (`POST /reopen-bidding`).
    var showReplaceWorkerConfirm by remember { mutableStateOf(false) }
    // Poster's "Close Gig" confirm on a still-open task (`DELETE /api/gigs/:id`).
    var showCloseTaskConfirm by remember { mutableStateOf(false) }
    var toastText by remember { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val deliverySheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val tipSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val reportSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val cancelSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val rescheduleSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Block 3D — Stripe PaymentSheet for tipping (created in composition).
    val paymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onTipOutcome(StripePaymentSheets.checkoutOutcome(result))
        }

    // Phase 5 — second PaymentSheet for accept-bid / instant-accept checkouts.
    val lifecyclePaymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onLifecycleCheckoutOutcome(StripePaymentSheets.checkoutOutcome(result))
        }

    LaunchedEffect(Unit) { viewModel.load() }
    // Phase 5 — join the gig:<id> realtime room while the screen is visible.
    DisposableEffect(Unit) {
        viewModel.joinRealtime()
        onDispose { viewModel.leaveRealtime() }
    }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is GigTipEvent.PresentTipSheet -> {
                    showTipSheet = false
                    paymentSheet.presentWithPaymentIntent(
                        paymentIntentClientSecret = event.params.clientSecret.orEmpty(),
                        configuration =
                            StripePaymentSheets.paymentConfiguration(
                                context = context,
                                customerId = event.params.customer,
                                ephemeralKey = event.params.ephemeralKey,
                                publishableKey = event.params.publishableKey,
                            ),
                    )
                }
            }
        }
    }
    LaunchedEffect(Unit) {
        viewModel.lifecycleEvents.collect { event ->
            when (event) {
                is GigLifecycleEvent.Toast -> toastText = event.text
                is GigLifecycleEvent.PresentPaymentSheet ->
                    lifecyclePaymentSheet.presentWithPaymentIntent(
                        paymentIntentClientSecret = event.params.clientSecret.orEmpty(),
                        configuration =
                            StripePaymentSheets.paymentConfiguration(
                                context = context,
                                customerId = event.params.customer,
                                ephemeralKey = event.params.ephemeralKey,
                                publishableKey = event.params.publishableKey,
                            ),
                    )
            }
        }
    }
    LaunchedEffect(Unit) {
        viewModel.openChatEvents.collect { event ->
            onOpenChat(event.roomId, event.displayName, event.initials, event.verified)
        }
    }
    // A freshly minted status link goes straight to the clipboard — RN's
    // `ETATracker` copies and never opens the system share sheet
    // (`components/gig-detail-v2/ETATracker.tsx:57`).
    LaunchedEffect(Unit) {
        viewModel.liveStatusEvents.collect { event ->
            val clipboard =
                context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
            clipboard?.setPrimaryClip(android.content.ClipData.newPlainText("Live status link", event.url))
            toastText = "Live status link copied — it expires in 24 hours."
        }
    }
    // Tip success → toast (PaymentSheet itself surfaces decline / SCA errors).
    LaunchedEffect(tipStatus) {
        if (tipStatus is TipStatus.Succeeded) toastText = "Tip sent — thank you!"
    }

    val openChat: () -> Unit = { viewModel.openGigChat() }

    LaunchedEffect(toastText) {
        if (toastText != null) {
            kotlinx.coroutines.delay(2_500)
            toastText = null
        }
    }

    // Phase 5 work item 6 — share via the system sheet with the web link.
    val shareGig: () -> Unit = {
        val url = GigDetailViewModel.shareUrl(viewModel.currentGigId())
        val title = viewModel.gigSnapshot()?.title
        val intent =
            android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(
                    android.content.Intent.EXTRA_TEXT,
                    if (title.isNullOrEmpty()) url else "$title — $url",
                )
            }
        context.startActivity(android.content.Intent.createChooser(intent, "Share task"))
    }

    val overflowItems =
        buildList {
            // Poster or assigned helper on a live task can mint a 24h public
            // status link (`POST /api/gigs/:gigId/share-status`); the link is
            // copied, not shared through the system sheet.
            if (viewModel.canShareLiveStatus()) {
                add(
                    ContentDetailOverflowItem(
                        label = "Share live status",
                        testTag = "gigDetail.shareLiveStatus",
                        onClick = { viewModel.shareLiveStatus() },
                    ),
                )
            }
            add(ContentDetailOverflowItem(label = "Share", testTag = "gigDetail.share", onClick = shareGig))
            add(
                ContentDetailOverflowItem(
                    label = "Report task",
                    testTag = "gigDetail.report",
                    onClick = { showReportSheet = true },
                ),
            )
            if (viewModel.canReplaceWorker()) {
                add(
                    ContentDetailOverflowItem(
                        label = "Replace worker",
                        testTag = "gigDetail.replaceWorker",
                        onClick = { showReplaceWorkerConfirm = true },
                    ),
                )
            }
            // RN branches on status: an open gig is *closed* (deleted, no
            // fee), anything live is *cancelled* (`gig/[id].tsx:412`).
            if (viewModel.canCloseTask()) {
                add(
                    ContentDetailOverflowItem(
                        label = "Close task",
                        testTag = "gigDetail.close",
                        onClick = { showCloseTaskConfirm = true },
                    ),
                )
            }
            if (viewModel.canCancelTask()) {
                add(
                    ContentDetailOverflowItem(
                        label = "Cancel task",
                        testTag = "gigDetail.cancel",
                        onClick = {
                            viewModel.requestCancelPreview()
                            showCancelSheet = true
                        },
                    ),
                )
            }
        }

    ContentDetailShell(
        state = state,
        onBack = onBack,
        onPrimaryAction = {
            val gig = (state as? ContentDetailUiState.Loaded)?.content?.hero
            when {
                // Poster on a completed gig → Send-a-tip sheet (Block 3D).
                viewModel.canTip() -> showTipSheet = true
                // Assigned worker on an in-progress task → Delivery Proof sheet.
                viewModel.canMarkDelivered() ->
                    deliveryTarget =
                        DeliveryProofTarget(
                            id = "deliver",
                            gigId = viewModel.currentGigId(),
                            gigTitle = gig?.title ?: "this task",
                        )
                // Phase 5 work item 3 — instant accept claims the task directly.
                viewModel.canInstantAccept() -> viewModel.instantAccept()
                // The viewer already bid → the same sheet in edit mode,
                // pre-filled; `bidId != null` flips submit to a PUT update.
                viewModel.viewerCanEditBid() ->
                    sheetTarget = editBidTarget(viewModel, viewerBid, gig?.title)
                else ->
                    sheetTarget =
                        EditBidSheetTarget(
                            id = "new-bid",
                            gigId = viewModel.currentGigId(),
                            gigTitle = gig?.title ?: "this task",
                            bidId = null,
                        )
            }
        },
        onSecondaryAction = openChat,
        onRetry = { viewModel.load() },
        onMessageCounterparty = openChat,
        overflowItems = overflowItems,
        // P1.C — bookmark toggle in the top bar; optimistic flip with
        // revert + toast on failure.
        topBarAccessory = {
            GigSaveToggle(
                saved = saved,
                onToggle = { viewModel.toggleSave { message -> toastText = message } },
            )
        },
        scrollFooter = {
            if (state is ContentDetailUiState.Loaded) {
                GigLifecycleSections(viewModel)
                // Bidder side — "Your bid" with Update / Withdraw and,
                // while a counter-offer is live, Accept / Decline.
                if (viewModel.showViewerBidPanel()) {
                    val heroTitle = (state as? ContentDetailUiState.Loaded)?.content?.hero?.title
                    GigViewerBidPanel(
                        viewModel = viewModel,
                        onEditBid = { sheetTarget = editBidTarget(viewModel, viewerBid, heroTitle) },
                    )
                }
                GigQuestionsSection(viewModel) { message -> toastText = message }
            }
        },
    )

    // Phase 5 — invisible anchor for the instant-accept dock CTA.
    if (viewModel.canInstantAccept()) {
        Box(modifier = Modifier.size(0.dp).testTag("gigDetail.instantAccept"))
    }

    // Poster's "Replace worker" confirm. Not a cancellation: the hold is
    // released and the task goes straight back out for bids, so the copy
    // spells both consequences out before the destructive tap.
    if (showReplaceWorkerConfirm) {
        AlertDialog(
            onDismissRequest = { showReplaceWorkerConfirm = false },
            title = { Text("Replace Worker") },
            text = {
                Text(
                    "This will unassign the current worker, release any payment hold, " +
                        "and reopen the task for bids. Use this only before work starts.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showReplaceWorkerConfirm = false
                        viewModel.replaceWorker()
                    },
                    modifier = Modifier.testTag("gigDetail.replaceWorkerConfirm"),
                ) {
                    Text("Replace Worker", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showReplaceWorkerConfirm = false }) { Text("Keep worker") }
            },
        )
    }

    // Poster closes a still-open task. RN copy verbatim
    // (`gig/[id].tsx:414`); the row is deleted, so we pop back on success.
    if (showCloseTaskConfirm) {
        AlertDialog(
            onDismissRequest = { showCloseTaskConfirm = false },
            title = { Text("Close Gig") },
            text = {
                Text(
                    "Are you sure you want to close this gig? " +
                        "It will be removed and this cannot be undone.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCloseTaskConfirm = false
                        viewModel.closeGig { closed -> if (closed) onBack() }
                    },
                    modifier = Modifier.testTag("gigDetail.closeConfirm"),
                ) {
                    Text("Close Gig", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCloseTaskConfirm = false }) { Text("Keep Open") }
            },
        )
    }

    if (showReportSheet) {
        ModalBottomSheet(
            onDismissRequest = { showReportSheet = false },
            sheetState = reportSheetState,
        ) {
            GigReportSheetContent(
                onSubmit = { reason, details ->
                    viewModel.submitReport(reason, details) { ok ->
                        if (ok) showReportSheet = false
                    }
                },
                onCancel = { showReportSheet = false },
            )
        }
    }

    if (showCancelSheet) {
        ModalBottomSheet(
            onDismissRequest = { showCancelSheet = false },
            sheetState = cancelSheetState,
        ) {
            GigCancelSheetContent(
                preview = cancelPreview,
                previewLoading = cancelPreviewLoading,
                onConfirm = { reason ->
                    viewModel.confirmCancel(reason) { ok ->
                        if (ok) showCancelSheet = false
                    }
                },
                onCancel = { showCancelSheet = false },
                // P6b — only the poster reaches this sheet (canCancelTask),
                // so `can_reschedule` alone gates the secondary path.
                onReschedule =
                    if (viewModel.viewerIsOwner()) {
                        {
                            showCancelSheet = false
                            showRescheduleSheet = true
                        }
                    } else {
                        null
                    },
            )
        }
    }

    // P6b — "Reschedule instead": FutureDateTimePicker + optional note →
    // `POST /reschedule`. The VM toasts "Task rescheduled" + refetches.
    if (showRescheduleSheet) {
        ModalBottomSheet(
            onDismissRequest = { showRescheduleSheet = false },
            sheetState = rescheduleSheetState,
        ) {
            GigRescheduleSheetContent(
                initialStart =
                    viewModel.gigSnapshot()?.scheduledStart?.let { iso ->
                        runCatching {
                            java.time.Instant
                                .parse(iso)
                                .atZone(java.time.ZoneId.systemDefault())
                                .toLocalDateTime()
                        }.getOrNull()
                    },
                onConfirm = { start, note ->
                    viewModel.rescheduleTask(
                        scheduledStartIso =
                            start
                                .atZone(java.time.ZoneId.systemDefault())
                                .toInstant()
                                .toString(),
                        note = note,
                    ) { ok ->
                        if (ok) showRescheduleSheet = false
                    }
                },
                onCancel = { showRescheduleSheet = false },
            )
        }
    }

    val target = sheetTarget
    if (target != null) {
        ModalBottomSheet(
            onDismissRequest = { sheetTarget = null },
            sheetState = sheetState,
        ) {
            EditBidSheetContent(
                target = target,
                onSubmit = { draft ->
                    // `target.bidId != null` ⇒ the viewer already has a bid
                    // here, so this is a PUT update rather than a new POST.
                    val ok =
                        suspendCancellableCoroutine<Boolean> { cont ->
                            if (target.isEditing) {
                                viewModel.updateViewerBid(
                                    amount = draft.amount,
                                    message = draft.message,
                                    proposedTime = draft.proposedTime,
                                ) { result -> cont.resume(result) }
                            } else {
                                viewModel.placeBid(
                                    amount = draft.amount,
                                    message = draft.message,
                                    proposedTime = draft.proposedTime,
                                ) { result -> cont.resume(result) }
                            }
                        }
                    if (ok) {
                        sheetTarget = null
                        toastText = if (target.isEditing) "Bid updated." else "Bid submitted."
                    }
                    ok
                },
                onCancel = { sheetTarget = null },
            )
        }
    }

    val delivery = deliveryTarget
    if (delivery != null) {
        ModalBottomSheet(
            onDismissRequest = { deliveryTarget = null },
            sheetState = deliverySheetState,
        ) {
            DeliveryProofSheet(
                target = delivery,
                onSubmit = { photos, note ->
                    suspendCancellableCoroutine<Boolean> { cont ->
                        viewModel.submitDeliveryProof(photos, note) { result -> cont.resume(result) }
                    }
                },
                onDismiss = { deliveryTarget = null },
            )
        }
    }

    if (showTipSheet) {
        ModalBottomSheet(
            onDismissRequest = { showTipSheet = false },
            sheetState = tipSheetState,
        ) {
            TipAmountSheet(
                sending = tipStatus is TipStatus.Sending,
                onSelect = { cents ->
                    showTipSheet = false
                    viewModel.sendTip(cents)
                },
                onCancel = { showTipSheet = false },
            )
        }
    }

    TipMarkers(canTip = viewModel.canTip(), tipStatus = tipStatus)

    toastText?.let { text ->
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Box(
                modifier =
                    Modifier
                        .padding(Spacing.s4)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("gig-detail-toast"),
            ) {
                Text(
                    text = text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/**
 * The shared bid sheet in *edit* mode, pre-filled with the viewer's live
 * bid. `bidId != null` is what flips the submit path to
 * `PUT /api/gigs/:gigId/bids/:bidId`.
 */
private fun editBidTarget(
    viewModel: GigDetailViewModel,
    viewerBid: BidDto?,
    gigTitle: String?,
): EditBidSheetTarget? {
    val bid = viewerBid ?: return null
    return EditBidSheetTarget(
        id = "edit-bid-${bid.id}",
        gigId = viewModel.currentGigId(),
        gigTitle = gigTitle ?: "this task",
        bidId = bid.id,
        initialAmount = bid.bidAmount,
        initialMessage = bid.message,
        initialProposedTime = bid.proposedTime,
    )
}

/** P1.C — top-bar bookmark toggle; primary600 fill when saved. */
@Composable
private fun GigSaveToggle(
    saved: Boolean,
    onToggle: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .clickable(onClick = onToggle)
                .testTag("gigDetail.save"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Bookmark,
            contentDescription = if (saved) "Saved — tap to remove" else "Save this task",
            size = 19.dp,
            strokeWidth = 2f,
            tint = if (saved) PantopusColors.primary600 else PantopusColors.appTextSecondary,
        )
    }
}

/** Send-a-tip amount picker (Block 3D). Preset amounts in cents. */
@Composable
private fun TipAmountSheet(
    sending: Boolean,
    onSelect: (Int) -> Unit,
    onCancel: () -> Unit,
) {
    var customAmount by remember { mutableStateOf("") }
    val customCents =
        customAmount
            .trim()
            .replace("$", "")
            .replace(",", "")
            .toDoubleOrNull()
            ?.takeIf { it >= 0.5 }
            ?.let { kotlin.math.round(it * 100).toInt().coerceAtLeast(50) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5)
                .testTag("tip.amount"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.HandCoins,
            contentDescription = null,
            size = 32.dp,
            tint = PantopusColors.primary600,
        )
        Text(text = "Send a tip", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "100% goes to your helper. Charged to your card via Stripe.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            listOf(500, 1000, 2000).forEach { cents ->
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.primary50)
                            .clickable(enabled = !sending) { onSelect(cents) }
                            .testTag("tip.amount.$cents"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "\$${cents / 100}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.primary600,
                    )
                }
            }
        }
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "Custom amount",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
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
                Text(
                    text = "$",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
                BasicTextField(
                    value = customAmount,
                    onValueChange = { customAmount = it },
                    enabled = !sending,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    textStyle =
                        androidx.compose.ui.text.TextStyle(
                            color = PantopusColors.appText,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    modifier =
                        Modifier
                            .weight(1f)
                            .testTag("tip.amount.customInput"),
                    decorationBox = { inner ->
                        if (customAmount.isEmpty()) {
                            Text(
                                text = "0.00",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                        inner()
                    },
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(
                        if (customCents == null || sending) {
                            PantopusColors.appSurfaceSunken
                        } else {
                            PantopusColors.primary600
                        },
                    )
                    .clickable(enabled = customCents != null && !sending) {
                        customCents?.let(onSelect)
                    }
                    .testTag("tip.amount.customSubmit"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Send custom tip",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color =
                    if (customCents == null || sending) {
                        PantopusColors.appTextMuted
                    } else {
                        PantopusColors.appTextInverse
                    },
            )
        }
        Text(
            text = "Not now",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.clickable(onClick = onCancel),
        )
    }
}

/** Invisible test anchors for the tip stages. */
@Composable
private fun TipMarkers(
    canTip: Boolean,
    tipStatus: TipStatus,
) {
    if (canTip) Box(modifier = Modifier.size(0.dp).testTag("tip.affordance"))
    if (tipStatus is TipStatus.Sending) Box(modifier = Modifier.size(0.dp).testTag("tip.paymentSheet"))
    if (tipStatus is TipStatus.Succeeded) Box(modifier = Modifier.size(0.dp).testTag("tip.success"))
}
