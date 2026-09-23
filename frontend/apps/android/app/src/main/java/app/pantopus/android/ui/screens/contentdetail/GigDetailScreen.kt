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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import app.pantopus.android.ui.screens.gigs.checkout.GigBidCheckoutHost
import app.pantopus.android.ui.screens.my_bids.EditBidFailure
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
    onOpenPayouts: () -> Unit = {},
    viewModel: GigDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tipScope = rememberCoroutineScope()
    val tipRecovery = remember(viewModel, tipScope) { viewModel.createTipRecovery(tipScope) }
    val tipStatus by tipRecovery.status.collectAsStateWithLifecycle()
    val tipState by tipRecovery.state.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val cancelPreview by viewModel.cancelPreview.collectAsStateWithLifecycle()
    val stopState by viewModel.taskStop.state.collectAsStateWithLifecycle()
    // Bidder side — the viewer's own live bid, if any.
    val viewerBid by viewModel.viewerBid.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var sheetTarget by remember { mutableStateOf<EditBidSheetTarget?>(null) }
    var deliveryTarget by remember { mutableStateOf<DeliveryProofTarget?>(null) }
    var showTipSheet by remember { mutableStateOf(false) }
    var showReportSheet by remember { mutableStateOf(false) }
    var showRescheduleSheet by remember { mutableStateOf(false) }
    var toastText by remember { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val deliverySheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val tipSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val reportSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val rescheduleSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    tipState.presentation?.let { original ->
        key(original.token) {
            val tipPaymentSheet =
                rememberPaymentSheet { result ->
                    tipRecovery.onOutcome(original.token, StripePaymentSheets.checkoutOutcome(result))
                }
            LaunchedEffect(original.token) {
                val params = tipRecovery.claimSheet(original.token) ?: return@LaunchedEffect
                showTipSheet = false
                tipPaymentSheet.presentWithPaymentIntent(
                    paymentIntentClientSecret = params.clientSecret.orEmpty(),
                    configuration =
                        StripePaymentSheets.paymentConfiguration(
                            context,
                            params.customer,
                            params.ephemeralKey,
                            params.publishableKey,
                        ),
                )
            }
        }
    }
    LaunchedEffect(tipRecovery) { tipRecovery.prepare(retainedOnly = true) }
    LaunchedEffect(tipState.invalidated) { if (tipState.invalidated) showTipSheet = false }
    DisposableEffect(tipRecovery) {
        onDispose { tipRecovery.retire() }
    }

    // Phase 5 — second PaymentSheet for accept-bid / instant-accept checkouts.
    val lifecyclePaymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onLifecycleCheckoutOutcome(StripePaymentSheets.checkoutOutcome(result))
        }

    GigBidCheckoutHost(viewModel.bidCheckout)
    app.pantopus.android.ui.screens.gigs.refunds.GigRefundSheet(viewModel.refunds)
    app.pantopus.android.ui.screens.gigs.authorization.GigAssignedAuthorizationHost(viewModel.assignedAuthorization)
    app.pantopus.android.ui.screens.gigs.stop.GigStopSheet(
        viewModel.taskStop,
        onReschedule = if (viewModel.viewerIsOwner() && cancelPreview?.canReschedule == true) ({ showRescheduleSheet = true }) else null,
    )

    LaunchedEffect(Unit) { viewModel.load() }
    // Phase 5 — join the gig:<id> realtime room while the screen is visible.
    DisposableEffect(Unit) {
        viewModel.joinRealtime()
        onDispose { viewModel.leaveRealtime() }
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
        when (val status = tipStatus) {
            TipStatus.Succeeded -> toastText = "Tip sent — thank you!"
            TipStatus.Canceled -> toastText = "The original tip is canceled with no charge."
            is TipStatus.Failed -> toastText = status.message
            else -> Unit
        }
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
                        onClick = { viewModel.openTaskStop("reopen_bidding") },
                    ),
                )
            }
            if (stopState.recoveryAvailable) {
                add(
                    ContentDetailOverflowItem(
                        label = "Task action status",
                        testTag = "gigDetail.stopRecovery",
                        onClick = { viewModel.openTaskStopRecovery() },
                    ),
                )
            }
            // Open and assigned actions share the same durable stop gateway.
            if (viewModel.canCloseTask()) {
                add(
                    ContentDetailOverflowItem(
                        label = "Close task",
                        testTag = "gigDetail.close",
                        onClick = { viewModel.openTaskStop("close") },
                    ),
                )
            }
            if (viewModel.canCancelTask()) {
                add(
                    ContentDetailOverflowItem(
                        label = "Cancel task",
                        testTag = "gigDetail.cancel",
                        onClick = { viewModel.openTaskStop("cancel") },
                    ),
                )
            }
        }

    LaunchedEffect(stopState.recoveryError) { stopState.recoveryError?.let { toastText = it } }

    // Retained originals keep the existing tip action reachable even if task terms changed.
    val detailState = tipRecoveryDetailState(state, tipState)
    ContentDetailShell(
        state = detailState,
        onBack = onBack,
        onPrimaryAction = {
            val gig = (state as? ContentDetailUiState.Loaded)?.content?.hero
            when {
                (detailState as? ContentDetailUiState.Loaded)?.content?.dock?.primary?.enabled != true -> Unit
                // Poster on a completed gig → Send-a-tip sheet (Block 3D).
                viewModel.canTip() || tipState.originalAmount != null -> {
                    showTipSheet = true
                    tipRecovery.prepare()
                }
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
        val bidFailure = remember(target.id) { EditBidFailure() }
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
                                    onFailure = bidFailure::record,
                                ) { result -> cont.resume(result) }
                            } else {
                                viewModel.placeBid(
                                    amount = draft.amount,
                                    message = draft.message,
                                    proposedTime = draft.proposedTime,
                                    onFailure = bidFailure::record,
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
                failure = bidFailure,
                onSetUpPayouts = {
                    sheetTarget = null
                    onOpenPayouts()
                },
            )
        }
    }

    val delivery = deliveryTarget
    if (delivery != null) {
        ModalBottomSheet(
            onDismissRequest = {
                viewModel.retireDeliveryProof()
                deliveryTarget = null
            },
            sheetState = deliverySheetState,
        ) {
            DeliveryProofSheet(
                target = delivery,
                onSubmit = { photos, note ->
                    suspendCancellableCoroutine<Boolean> { cont ->
                        cont.invokeOnCancellation { viewModel.retireDeliveryProof() }
                        viewModel.submitDeliveryProof(photos, note) { result -> if (cont.isActive) cont.resume(result) }
                    }
                },
                onDismiss = {
                    viewModel.retireDeliveryProof()
                    deliveryTarget = null
                },
            )
        }
    }

    if (showTipSheet) {
        ModalBottomSheet(
            onDismissRequest = { showTipSheet = false },
            sheetState = tipSheetState,
        ) {
            TipAmountSheet(
                recovery = tipState,
                onSelect = { cents ->
                    showTipSheet = false
                    tipRecovery.send(cents, viewModel.gigSnapshot())
                },
                onCancel = {
                    showTipSheet = false
                    if (tipState.canCancel) tipRecovery.cancel()
                },
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
internal fun TipAmountSheet(
    recovery: GigTipState,
    onSelect: (Int) -> Unit,
    onCancel: () -> Unit,
) {
    val sending = recovery.busy || recovery.invalidated
    var customAmount by remember { mutableStateOf("") }
    LaunchedEffect(recovery.originalAmount) {
        customAmount = recovery.originalAmount?.let { String.format(java.util.Locale.US, "%.2f", it / 100.0) }.orEmpty()
    }
    val customCents = recovery.originalAmount ?: tipAmountCents(customAmount)
    val canSubmit = customCents != null && !sending && (recovery.canChoose || recovery.canContinue)
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
        // Sheet-surface text follows the theme: identical to appText/appTextSecondary in light mode,
        // and legible on the dark ModalBottomSheet surface.
        Text(
            text = "Send a tip",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = recovery.message,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                            .clickable(enabled = recovery.canChoose && !sending) { onSelect(cents) }
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
                color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                    enabled = recovery.canChoose && !sending,
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
                        if (!canSubmit) {
                            PantopusColors.appSurfaceSunken
                        } else {
                            PantopusColors.primary600
                        },
                    )
                    .clickable(enabled = canSubmit) {
                        customCents?.let(onSelect)
                    }
                    .testTag("tip.amount.customSubmit"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (recovery.originalAmount != null) recovery.actionTitle else "Send custom tip",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color =
                    if (!canSubmit) {
                        PantopusColors.appTextMuted
                    } else {
                        PantopusColors.appTextInverse
                    },
            )
        }
        Text(
            text = if (recovery.canCancel) "Cancel tip" else "Not now",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clickable(enabled = !sending, onClick = onCancel),
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
