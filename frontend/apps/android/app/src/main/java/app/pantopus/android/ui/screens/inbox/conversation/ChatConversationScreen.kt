@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "CyclomaticComplexMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.inbox.conversation

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Patterns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.StartOffsetType
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.links.LinkPreview
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.inbox.conversation.ai.AiCapabilityChip
import app.pantopus.android.ui.screens.inbox.conversation.ai.AiEstimateCard
import app.pantopus.android.ui.screens.inbox.conversation.ai.ChatAiAvatar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * Chat conversation screen (T2.2). Three frames: shimmer loading,
 * counterparty-specific empty state, populated thread. Composer has
 * attach + send discs; send is color-bound to text presence and
 * disabled while in flight.
 *
 * A15 design parity notes — intentionally NOT implemented (design-only,
 * no backend support yet): voice bubbles + mic button, and the A15.2
 * person preview card with stats in the empty state. A15.2 link-preview
 * card-bubbles ARE implemented (tappable URLs + Open-Graph card below
 * the bubble, metadata via [app.pantopus.android.data.links.LinkPreviewRepository]). The pinned gig context strip (`.ctx-strip`) renders for
 * gig rooms whose route carried a `gigId` (chat-list room rows); the
 * listing variant stays deferred — no listing id reaches the thread.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatConversationScreen(
    args: ChatConversationRouteArgs,
    chrome: ChatConversationChrome = ChatConversationChrome(),
    onBack: () -> Unit = {},
    onUseAIDraft: (ChatAIDraftCard) -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenListing: (String) -> Unit = {},
    viewModel: ChatConversationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeCounterparty by viewModel.counterparty.collectAsStateWithLifecycle()
    val composerText by viewModel.composerText.collectAsStateWithLifecycle()
    val isSending by viewModel.isSending.collectAsStateWithLifecycle()
    val replyingTo by viewModel.replyingTo.collectAsStateWithLifecycle()
    val editingMessageId by viewModel.editingMessageId.collectAsStateWithLifecycle()
    val topics by viewModel.topics.collectAsStateWithLifecycle()
    val selectedTopicId by viewModel.selectedTopicId.collectAsStateWithLifecycle()
    val isCounterpartyTyping by viewModel.isCounterpartyTyping.collectAsStateWithLifecycle()
    val queuedAttachments by viewModel.queuedAttachments.collectAsStateWithLifecycle()
    val pendingScroll by viewModel.pendingScrollTarget.collectAsStateWithLifecycle()
    val sendLimitNotice by viewModel.sendLimitNotice.collectAsStateWithLifecycle()
    val isSelectionMode by viewModel.isSelectionMode.collectAsStateWithLifecycle()
    val selectedMessageIds by viewModel.selectedMessageIds.collectAsStateWithLifecycle()
    val isBlocking by viewModel.isBlocking.collectAsStateWithLifecycle()
    val isReporting by viewModel.isReporting.collectAsStateWithLifecycle()
    val reportNotice by viewModel.reportNotice.collectAsStateWithLifecycle()
    val linkPreviews by viewModel.linkPreviews.collectAsStateWithLifecycle()
    val isAiStreaming by viewModel.isAiStreaming.collectAsStateWithLifecycle()
    val gigContext by viewModel.gigContext.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showFanUpgradePrompt by remember { mutableStateOf(false) }
    // A15.4 — "Not now" on the upgrade-fan card hides it for the rest of
    // this visit. There is no server-side dismissal to persist to yet.
    var upgradeCardDismissed by remember { mutableStateOf(false) }
    var actionTarget by remember { mutableStateOf<ChatBubbleContent?>(null) }
    var showAttachSheet by remember { mutableStateOf(false) }
    var showGigPicker by remember { mutableStateOf(false) }
    var showListingPicker by remember { mutableStateOf(false) }
    var showDetailsSheet by remember { mutableStateOf(false) }
    var showEmojiSheet by remember { mutableStateOf(false) }
    var showBlockConfirm by remember { mutableStateOf(false) }
    var showReportSheet by remember { mutableStateOf(false) }
    var showBulkDeleteConfirm by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }
    val photoPicker =
        rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            if (uris.isEmpty()) return@rememberLauncherForActivityResult
            scope.launch {
                uris.take(5).forEach { uri ->
                    withContext(Dispatchers.IO) {
                        val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@withContext
                        val extension = mimeType.substringAfter('/', "jpg").substringBefore('+')
                        viewModel.queueAttachment(
                            kind = ChatQueuedAttachmentKind.Image,
                            filename = "chat-${UUID.randomUUID()}.$extension",
                            mimeType = mimeType,
                            bytes = bytes,
                        )
                    }
                }
            }
        }
    val attachmentPicker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            if (uris.isEmpty()) return@rememberLauncherForActivityResult
            scope.launch {
                val attachments =
                    withContext(Dispatchers.IO) {
                        uris.take(5).mapNotNull { uri ->
                            val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
                            val bytes =
                                context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                    ?: return@mapNotNull null
                            val extension = mimeType.substringAfter('/', "bin").substringBefore('+')
                            Triple(mimeType, "chat-${UUID.randomUUID()}.$extension", bytes)
                        }
                    }
                attachments.forEach { (mimeType, filename, bytes) ->
                    viewModel.queueAttachment(
                        kind = if (mimeType.startsWith("image/")) ChatQueuedAttachmentKind.Image else ChatQueuedAttachmentKind.Document,
                        filename = filename,
                        mimeType = mimeType,
                        bytes = bytes,
                    )
                }
            }
        }
    // Camera capture → the same queueAttachment flow as the photo picker.
    // The capture target is a cache-dir file exposed through the existing
    // FileProvider (`${applicationId}.fileprovider`, xml/file_paths.xml
    // cache-path). Saveable so a process death during capture still
    // resolves the URI on return.
    var pendingCameraUri by rememberSaveable { mutableStateOf<String?>(null) }
    val cameraCapture =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            val uri = pendingCameraUri?.let(Uri::parse)
            pendingCameraUri = null
            if (!success || uri == null) return@rememberLauncherForActivityResult
            scope.launch {
                withContext(Dispatchers.IO) {
                    val bytes =
                        context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: return@withContext
                    viewModel.queueAttachment(
                        kind = ChatQueuedAttachmentKind.Image,
                        filename = "camera-${UUID.randomUUID()}.jpg",
                        mimeType = "image/jpeg",
                        bytes = bytes,
                    )
                }
            }
        }
    val launchCamera = {
        val photoFile = File(context.cacheDir, "chat-camera-${UUID.randomUUID()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", photoFile)
        pendingCameraUri = uri.toString()
        // No camera app (or a broken resolver) must not crash the thread —
        // just drop the capture.
        runCatching { cameraCapture.launch(uri) }.onFailure { pendingCameraUri = null }
        Unit
    }
    // CAMERA is declared in the manifest, so the TakePicture intent
    // requires the runtime grant. Denial is graceful: skip the capture.
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) launchCamera()
        }
    val conversationMode = chrome.mode
    // No fixture fallback: an unreported allowance hides the fan chrome
    // rather than showing another member's tier / renewal / quota.
    val fanEntitlement = chrome.fanEntitlement
    val isFanThread = conversationMode == ChatConversationMode.FanThread
    val isFanReplyLocked = isFanThread && fanEntitlement != null && !fanEntitlement.canReply

    LaunchedEffect(Unit) {
        viewModel.configure(
            args.mode,
            args.counterparty,
            args.currentUserId,
            args.scrollToMessageId,
            args.initialTopic,
            args.gigId,
        )
        viewModel.load()
    }
    DisposableEffect(Unit) {
        onDispose { viewModel.teardown() }
    }
    val resolvedCreatorContext = chrome.creatorThread?.context ?: ChatCreatorThreadContext.defaults()
    val isCreatorThread = conversationMode == ChatConversationMode.CreatorThread
    val isCreatorQuotaLocked = isCreatorThread && resolvedCreatorContext.quota?.isMaxed == true

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag("chatConversation"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            if (isSelectionMode) {
                SelectionTopBar(
                    count = selectedMessageIds.size,
                    onCancel = viewModel::exitSelectionMode,
                )
            } else {
                ChatHeader(
                    conversationMode = conversationMode,
                    counterparty = activeCounterparty,
                    creatorContext = resolvedCreatorContext,
                    onBack = onBack,
                    onOpenDetails = { showDetailsSheet = true },
                )
            }
            gigContext?.let { strip ->
                GigContextStrip(strip = strip, onTap = { onOpenGig(strip.gigId) })
            }
            if (conversationMode == ChatConversationMode.CreatorThread) {
                CreatorAudienceStrip(
                    context = resolvedCreatorContext,
                    onOpenAudienceProfile = chrome.creatorThread?.onOpenAudienceProfile ?: {},
                )
                resolvedCreatorContext.quota?.let { quota ->
                    CreatorQuotaMeter(quota = quota)
                    if (quota.isMaxed) {
                        CreatorQuotaExhaustedPill(
                            tierName = resolvedCreatorContext.fanTierName,
                            fanName = activeCounterparty.displayName.firstWord(),
                            total = quota.total,
                        )
                        val offer = resolvedCreatorContext.upgradeOffer
                        if (offer != null && !upgradeCardDismissed) {
                            CreatorUpgradeFanCard(
                                fanName = activeCounterparty.displayName.firstWord(),
                                currentTierName = resolvedCreatorContext.fanTierName,
                                offer = offer,
                                onDismiss = { upgradeCardDismissed = true },
                            )
                        }
                    }
                }
            }
            if (isFanThread && fanEntitlement != null) {
                FanMembershipStripe(
                    entitlement = fanEntitlement,
                    onManage = { showFanUpgradePrompt = true },
                )
            }
            if (topics.isNotEmpty()) {
                TopicStrip(
                    topics = topics,
                    selectedTopicId = selectedTopicId,
                    onSelect = viewModel::selectTopic,
                )
            }
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val s = state) {
                    ChatConversationUiState.Loading -> LoadingFrame()
                    ChatConversationUiState.Empty ->
                        EmptyFrame(
                            counterparty = activeCounterparty,
                            aiPrompts = viewModel.aiPrompts,
                            emptyChips = viewModel.emptyChips,
                            onChipTap = viewModel::tapPrompt,
                            conversationMode = conversationMode,
                            fanEntitlement = fanEntitlement,
                            onCapabilityTap = viewModel::sendCapabilityPrompt,
                        )
                    is ChatConversationUiState.Loaded ->
                        PopulatedFrame(
                            rows = s.rows,
                            onRetry = viewModel::retry,
                            onLoadOlder = viewModel::loadOlder,
                            scrollToRowId = pendingScroll,
                            onScrollConsumed = viewModel::consumePendingScroll,
                            conversationMode = conversationMode,
                            incomingInitials = incomingInitialsFor(conversationMode, activeCounterparty),
                            aiPrompts = viewModel.aiPrompts,
                            onCapabilityTap = viewModel::sendCapabilityPrompt,
                            onLockedAction = { showFanUpgradePrompt = true },
                            onBubbleLongPress = {
                                if (isSelectionMode) viewModel.toggleSelection(it.id) else actionTarget = it
                            },
                            selectedMessageIds = if (isSelectionMode) selectedMessageIds else emptySet(),
                            onBubbleTap = { if (isSelectionMode) viewModel.toggleSelection(it.id) },
                            onUseAIDraft = onUseAIDraft,
                            onOpenGig = onOpenGig,
                            onOpenListing = onOpenListing,
                            onOpenLocation = { lat, lng ->
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng"))
                                runCatching { context.startActivity(intent) }
                            },
                            onReact = viewModel::react,
                            linkPreviews = linkPreviews,
                            onResolveLink = viewModel::resolveLinkPreview,
                            onOpenUrl = { url ->
                                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                            },
                        )
                    is ChatConversationUiState.Error -> ErrorFrame(message = s.message, onRetry = viewModel::refresh)
                }
            }
            if (isCounterpartyTyping) {
                val typingInitials =
                    incomingInitialsFor(conversationMode, activeCounterparty)
                        ?: activeCounterparty.displayName.initials()
                TypingIndicator(initials = typingInitials)
            }
            if (queuedAttachments.isNotEmpty()) {
                AttachmentStripView(
                    attachments = queuedAttachments,
                    onRemove = viewModel::removeQueuedAttachment,
                )
            }
            if (isFanThread && fanEntitlement != null) {
                FanQuotaGate(
                    entitlement = fanEntitlement,
                    onUpgrade = { showFanUpgradePrompt = true },
                )
            }
            if (isSelectionMode) {
                SelectionDeleteBar(
                    enabled = selectedMessageIds.isNotEmpty(),
                    onDelete = { showBulkDeleteConfirm = true },
                )
            } else {
                sendLimitNotice?.let { notice ->
                    SendLimitNoticeBanner(text = notice, onDismiss = viewModel::dismissSendLimitNotice)
                }
                ComposerContextBanner(
                    reply = replyingTo,
                    editing = editingMessageId != null,
                    onCancel = viewModel::cancelMessageAction,
                )
                Composer(
                    text = composerText,
                    placeholder =
                        composerPlaceholder(
                            conversationMode = conversationMode,
                            c = activeCounterparty,
                            fanEntitlement = fanEntitlement,
                            creatorQuota = if (isCreatorQuotaLocked) resolvedCreatorContext.quota else null,
                        ),
                    // Attachment-only sends are valid — the VM substitutes
                    // "Attachment" text and sends as `file` (iOS parity).
                    canSend =
                        (composerText.isNotBlank() || queuedAttachments.isNotEmpty()) &&
                            !isSending &&
                            !isAiStreaming &&
                            !isCreatorQuotaLocked,
                    // The "−1" send-cost badge is a claim about the fan's
                    // quota — only shown once the allowance is known.
                    showsSendCost = isFanThread && fanEntitlement != null && !isFanReplyLocked,
                    isLockedAction = isFanReplyLocked || isCreatorQuotaLocked,
                    isAiStreaming = isAiStreaming,
                    onTextChange = viewModel::setComposerText,
                    onSend = {
                        if (isFanReplyLocked) {
                            showFanUpgradePrompt = true
                        } else {
                            viewModel.send()
                        }
                    },
                    onAttach = { showAttachSheet = true },
                    onEmoji = { showEmojiSheet = true },
                    onStopAiStream = viewModel::cancelAiStream,
                )
                if (isCreatorQuotaLocked) {
                    CreatorQuotaLockRow(
                        tierName = resolvedCreatorContext.fanTierName,
                        fanName = activeCounterparty.displayName.firstWord(),
                    )
                }
            }
        }

        if (showAttachSheet) {
            ChatAttachSheet(
                onDismiss = { showAttachSheet = false },
                onCamera = {
                    val granted =
                        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                            PackageManager.PERMISSION_GRANTED
                    if (granted) launchCamera() else cameraPermission.launch(Manifest.permission.CAMERA)
                },
                onPhotos = { photoPicker.launch("image/*") },
                onDocument = { attachmentPicker.launch(arrayOf("*/*")) },
                onLocation = { viewModel.sendCurrentLocation() },
                onGig = { showGigPicker = true },
                onListing = { showListingPicker = true },
            )
        }
        if (showGigPicker) {
            val shareGigs by viewModel.shareableGigs.collectAsStateWithLifecycle()
            val loadingShare by viewModel.isLoadingShareOptions.collectAsStateWithLifecycle()
            val shareError by viewModel.shareOptionsError.collectAsStateWithLifecycle()
            ChatShareGigPickerSheet(
                gigs = shareGigs,
                isLoading = loadingShare,
                error = shareError,
                onDismiss = { showGigPicker = false },
                onSelect = { gig ->
                    showGigPicker = false
                    viewModel.sendGigOffer(gig)
                },
                onLoad = viewModel::loadShareableGigs,
            )
        }
        if (showListingPicker) {
            val shareListings by viewModel.shareableListings.collectAsStateWithLifecycle()
            val loadingShare by viewModel.isLoadingShareOptions.collectAsStateWithLifecycle()
            val shareError by viewModel.shareOptionsError.collectAsStateWithLifecycle()
            ChatShareListingPickerSheet(
                listings = shareListings,
                isLoading = loadingShare,
                error = shareError,
                onDismiss = { showListingPicker = false },
                onSelect = { listing ->
                    showListingPicker = false
                    viewModel.sendListingOffer(listing)
                },
                onLoad = viewModel::loadShareableListings,
            )
        }

        if (showFanUpgradePrompt && fanEntitlement != null) {
            val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ModalBottomSheet(
                onDismissRequest = { showFanUpgradePrompt = false },
                sheetState = sheetState,
                containerColor = PantopusColors.appSurface,
            ) {
                FanTierUpgradePromptSheet(entitlement = fanEntitlement)
            }
        }
        actionTarget?.let { target ->
            val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ModalBottomSheet(
                onDismissRequest = { actionTarget = null },
                sheetState = sheetState,
                containerColor = PantopusColors.appSurface,
            ) {
                MessageActionSheet(
                    content = target,
                    onCopy = { actionTarget = null },
                    onReply = {
                        viewModel.beginReply(target.id)
                        actionTarget = null
                    },
                    onSelect = {
                        viewModel.enterSelectionMode(target.id)
                        actionTarget = null
                    },
                    onEdit = {
                        viewModel.beginEdit(target.id)
                        actionTarget = null
                    },
                    onDelete = {
                        viewModel.delete(target.id)
                        actionTarget = null
                    },
                    onReact = { reaction ->
                        viewModel.react(target.id, reaction)
                        actionTarget = null
                    },
                )
            }
        }
        if (showDetailsSheet) {
            ConversationDetailsSheet(
                counterpartyName = activeCounterparty.displayName,
                topics = topics,
                isBlocking = isBlocking,
                onDismiss = { showDetailsSheet = false },
                onReport = { showReportSheet = true },
                onBlock = { showBlockConfirm = true },
            )
        }
        if (showReportSheet) {
            ChatReportUserSheet(
                counterpartyName = activeCounterparty.displayName,
                isSubmitting = isReporting,
                onDismiss = { showReportSheet = false },
                onSubmit = { reason, details ->
                    viewModel.reportUser(reason, details) {
                        showReportSheet = false
                        showDetailsSheet = false
                    }
                },
            )
        }
        if (showEmojiSheet) {
            ChatEmojiPickerSheet(
                onDismiss = { showEmojiSheet = false },
                // Append and keep the sheet open so multiple emoji can be
                // picked in one pass.
                onPick = { emoji -> viewModel.setComposerText(viewModel.composerText.value + emoji) },
            )
        }
        if (showBlockConfirm) {
            AlertDialog(
                onDismissRequest = { showBlockConfirm = false },
                containerColor = PantopusColors.appSurface,
                title = { Text(text = "Block ${activeCounterparty.displayName}?") },
                text = { Text(text = "They won't be able to message you anymore. You can unblock them later.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showBlockConfirm = false
                            viewModel.blockUser {
                                showDetailsSheet = false
                                onBack()
                            }
                        },
                        modifier = Modifier.testTag("chatBlockConfirm"),
                    ) {
                        Text(text = "Block", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showBlockConfirm = false }) {
                        Text(text = "Cancel", color = PantopusColors.appTextSecondary)
                    }
                },
            )
        }
        if (showBulkDeleteConfirm) {
            val count = selectedMessageIds.size
            AlertDialog(
                onDismissRequest = { showBulkDeleteConfirm = false },
                containerColor = PantopusColors.appSurface,
                title = { Text(text = "Delete $count ${if (count == 1) "message" else "messages"}?") },
                text = { Text(text = "Deleted messages are removed for everyone in the conversation.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showBulkDeleteConfirm = false
                            viewModel.deleteSelected()
                        },
                        modifier = Modifier.testTag("chatBulkDeleteConfirm"),
                    ) {
                        Text(text = "Delete", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showBulkDeleteConfirm = false }) {
                        Text(text = "Cancel", color = PantopusColors.appTextSecondary)
                    }
                },
            )
        }
        // One-shot report outcome toast (success or friendly failure).
        LaunchedEffect(reportNotice) {
            val notice = reportNotice ?: return@LaunchedEffect
            snackbarHostState.showSnackbar(notice)
            viewModel.dismissReportNotice()
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .testTag("chatReportSnackbar"),
        )
    }
}

/**
 * A15.4 / A15.5 composer placeholder. [creatorQuota] is non-null only when
 * the creator's weekly reply allowance for this fan is exhausted, which
 * swaps the placeholder for the locked copy (iOS parity).
 */
private fun composerPlaceholder(
    conversationMode: ChatConversationMode,
    c: ChatCounterparty,
    fanEntitlement: ChatFanEntitlement? = null,
    creatorQuota: ChatCreatorQuota? = null,
): String =
    when {
        conversationMode == ChatConversationMode.AiAssistant -> "Ask Pantopus AI…"
        creatorQuota != null ->
            "Out of replies until ${creatorQuota.resetCopy.replace("Resets ", "")}"
        conversationMode == ChatConversationMode.FanThread && fanEntitlement != null -> {
            val required = fanEntitlement.requiredReplyTier
            if (required != null) {
                "Upgrade to $required to reply…"
            } else {
                "Message ${c.displayName.firstWord()}… (uses 1 of ${fanEntitlement.messageLimit})"
            }
        }
        else -> {
            when (c) {
                is ChatCounterparty.Ai -> "Ask Pantopus AI…"
                is ChatCounterparty.Group -> "Message ${c.displayName.firstWord()}…"
                is ChatCounterparty.Person -> "Message ${c.displayName.firstWord()}…"
            }
        }
    }

private fun String.firstWord(): String = split(" ").firstOrNull() ?: this

private fun incomingInitialsFor(
    conversationMode: ChatConversationMode,
    counterparty: ChatCounterparty,
): String? =
    if (conversationMode != ChatConversationMode.Dm) {
        null
    } else {
        when (counterparty) {
            is ChatCounterparty.Person -> counterparty.initials
            is ChatCounterparty.Group -> counterparty.displayName.initials()
            is ChatCounterparty.Ai -> null
        }
    }

// MARK: - Header

@Composable
internal fun ChatHeader(
    counterparty: ChatCounterparty,
    onBack: () -> Unit,
    conversationMode: ChatConversationMode = ChatConversationMode.Dm,
    creatorContext: ChatCreatorThreadContext = ChatCreatorThreadContext.defaults(),
    // Opens the conversation-details drawer (topics + safety actions).
    onOpenDetails: () -> Unit = {},
) {
    val isAi = conversationMode == ChatConversationMode.AiAssistant || counterparty is ChatCounterparty.Ai
    val isFanThread = conversationMode == ChatConversationMode.FanThread
    val isCreator = conversationMode == ChatConversationMode.CreatorThread
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(if (isCreator) 64.dp else 56.dp)
                .background(PantopusColors.appSurface)
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .testTag("chatConversationHeader"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = Radii.xl2,
                tint = PantopusColors.appText,
            )
        }
        HeaderAvatar(
            isAi = isAi,
            isFanThread = isFanThread,
            counterparty = counterparty,
            tierRank = if (isCreator) creatorContext.fanTierRank else null,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = counterparty.displayName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (isAi) AiBadge()
                if (isFanThread) PersonaPill()
                if (isCreator) {
                    CreatorTierChip(name = creatorContext.fanTierName, rank = creatorContext.fanTierRank)
                }
            }
            val presence =
                when {
                    isFanThread -> presenceFor(counterparty, isFanThread = true)
                    // Drops the sub-line entirely when the membership
                    // detail isn't known rather than inventing one.
                    isCreator -> creatorContext.fanSubtitle?.let { (creatorContext.fanTierRank > 1) to it }
                    else -> presenceFor(counterparty)
                }
            presence?.let { (online, text) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    if (online) {
                        Box(
                            modifier =
                                Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(PantopusColors.success),
                        )
                    }
                    Text(
                        text = text,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Normal,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                    )
                }
            }
        }
        when {
            isFanThread -> {
                Row {
                    HeaderIcon(PantopusIcon.ExternalLink)
                    HeaderIcon(PantopusIcon.MoreHorizontal)
                }
            }
            isCreator -> {
                Row {
                    HeaderIcon(PantopusIcon.User)
                    HeaderIcon(PantopusIcon.MoreHorizontal)
                }
            }
            // A15.3 AI header: "New chat" (lucide square-pen; closest token
            // icon is MessageSquarePlus) + overflow. New-chat is a no-op for
            // now — the VM keeps one rolling AI conversation per app session
            // and exposes no thread-reset yet.
            isAi -> {
                Row {
                    HeaderIcon(PantopusIcon.MessageSquarePlus)
                    HeaderIcon(PantopusIcon.MoreHorizontal)
                }
            }
            else ->
                when (counterparty) {
                    is ChatCounterparty.Person -> {
                        Row {
                            // A15 person header: phone + info. Calling ships
                            // later — the phone button is a visual no-op until
                            // voice calls land.
                            HeaderIcon(PantopusIcon.Phone)
                            Box(
                                modifier =
                                    Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .clickable(onClick = onOpenDetails),
                                contentAlignment = Alignment.Center,
                            ) {
                                PantopusIconImage(
                                    icon = PantopusIcon.Info,
                                    contentDescription = "Conversation details",
                                    size = Spacing.s5,
                                    tint = PantopusColors.appTextSecondary,
                                )
                            }
                        }
                    }
                    is ChatCounterparty.Ai -> {
                        Row {
                            HeaderIcon(PantopusIcon.MessageSquarePlus)
                            HeaderIcon(PantopusIcon.MoreHorizontal)
                        }
                    }
                    is ChatCounterparty.Group -> HeaderIcon(PantopusIcon.MoreVertical)
                }
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

/**
 * A15 `.ctx-strip` — pinned gig context under the header of a gig room.
 * Tapping opens the gig detail through the screen's [onOpenGig] callback.
 */
@Composable
private fun GigContextStrip(
    strip: ChatGigContextStrip,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("chatGigContextStrip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Hammer,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = strip.title,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (strip.meta.isNotEmpty()) {
                Text(
                    text = strip.meta,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary600,
        )
    }
}

/** A15.3 `.ai-badge` — compact "AI" pill in the AI header name row. */
@Composable
private fun AiBadge() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = 6.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = Radii.md,
            tint = PantopusColors.primary700,
        )
        Text(
            text = "AI",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun PersonaPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.businessBg)
                .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Briefcase,
            contentDescription = null,
            size = 9.dp,
            tint = PantopusColors.business,
        )
        Text(
            text = "Persona",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.business,
        )
    }
}

@Composable
internal fun CreatorAudienceStrip(
    context: ChatCreatorThreadContext,
    onOpenAudienceProfile: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s3, top = 10.dp, end = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg)
                .border(1.dp, PantopusColors.business.copy(alpha = 0.18f), RoundedCornerShape(Radii.lg))
                .clickable(onClick = onOpenAudienceProfile)
                .padding(horizontal = 10.dp, vertical = Spacing.s2)
                .testTag("chatCreatorAudienceStrip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.business),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Users,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = context.personaName?.let { "CREATOR INBOX · ${it.uppercase()}" } ?: "CREATOR INBOX",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.business,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            // Reach / engagement line only when the caller has real
            // analytics — there is no per-thread analytics payload.
            context.audienceSummary?.let { summary ->
                Text(
                    text = summary,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = "Open audience profile",
            size = Radii.xl,
            strokeWidth = 2.4f,
            tint = PantopusColors.business,
        )
    }
}

@Composable
internal fun CreatorQuotaMeter(quota: ChatCreatorQuota) {
    val progress =
        if (quota.total <= 0) {
            0f
        } else {
            (quota.used.toFloat() / quota.total.toFloat()).coerceIn(0f, 1f)
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = 14.dp, vertical = 9.dp)
                .testTag(if (quota.isMaxed) "chatCreatorQuotaMeterMaxed" else "chatCreatorQuotaMeter"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageSquare,
                    contentDescription = null,
                    size = 11.dp,
                    strokeWidth = 2.5f,
                    tint = PantopusColors.business,
                )
                Text(
                    text = "Replies this week",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = "${quota.used} of ${quota.total} replies this week",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (quota.isMaxed) PantopusColors.error else PantopusColors.appText,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(progress)
                        .height(4.dp)
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(if (quota.isMaxed) PantopusColors.error else PantopusColors.primary600),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = PantopusIcon.RefreshCw,
                contentDescription = null,
                size = 10.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = quota.resetCopy,
                fontSize = 10.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

@Composable
internal fun CreatorQuotaExhaustedPill(
    tierName: String,
    fanName: String,
    total: Int,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.warningBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("chatCreatorQuotaExhaustedPill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = 12.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.warning,
        )
        Text(
            text = "You've used your $total weekly $tierName replies with $fanName",
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
        )
    }
}

/**
 * A15.4 `.upgrade-card` — head, optional creator-authored body, perk rows,
 * and the "Not now" / "Send offer" pair. Every string comes from
 * [ChatCreatorUpgradeOffer] (real tier data); nothing is synthesised here,
 * and the whole card is omitted upstream when the offer is null.
 */
@Composable
internal fun CreatorUpgradeFanCard(
    fanName: String,
    currentTierName: String,
    offer: ChatCreatorUpgradeOffer,
    onDismiss: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xl))
                .padding(14.dp)
                .testTag("chatCreatorUpgradeFanCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        CreatorUpgradeFanCardHead(fanName = fanName, currentTierName = currentTierName, offer = offer)
        offer.summary?.let { summary ->
            Text(
                text = summary,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextStrong,
            )
        }
        if (offer.perks.isNotEmpty()) {
            Column(
                modifier = Modifier.testTag("chatCreatorUpgradeFanPerks"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                offer.perks.forEach { perk ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 12.dp,
                            strokeWidth = 2.5f,
                            tint = PantopusColors.success,
                        )
                        Text(text = perk, fontSize = 11.5.sp, color = PantopusColors.appTextStrong)
                    }
                }
            }
        }
        CreatorUpgradeFanCardActions(canSendOffer = offer.canSendOffer, onDismiss = onDismiss)
        if (!offer.canSendOffer) {
            Text(
                text = "Sending upgrade offers isn't available yet.",
                fontSize = 10.5.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("chatCreatorUpgradeFanCardUnavailable"),
            )
        }
    }
}

@Composable
private fun CreatorUpgradeFanCardHead(
    fanName: String,
    currentTierName: String,
    offer: ChatCreatorUpgradeOffer,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warningLight),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Crown,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.warning,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = "Invite $fanName to ${offer.tierName}",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            // Price plus the fan's current tier — both known values, no
            // perk claim.
            offer.priceLabel?.let { price ->
                Text(
                    text = "$price · currently on $currentTierName",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun CreatorUpgradeFanCardActions(
    canSendOffer: Boolean,
    onDismiss: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .clickable(onClick = onDismiss)
                    .testTag("chatCreatorUpgradeFanDismiss"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Not now",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
        }
        // Enabled only once a creator→fan upgrade-offer endpoint exists;
        // there is none on the wire today.
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (canSendOffer) PantopusColors.warning else PantopusColors.appTextMuted)
                    .alpha(if (canSendOffer) 1f else 0.6f)
                    .clickable(enabled = canSendOffer) {}
                    .testTag("chatCreatorUpgradeFanSend"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Send offer",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

/**
 * A15.4 `.lock-row` — sits under the composer while the creator's weekly
 * reply allowance for this fan is spent (iOS parity).
 */
@Composable
internal fun CreatorQuotaLockRow(
    tierName: String,
    fanName: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .padding(bottom = Spacing.s2)
                .testTag("chatCreatorQuotaLockRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.warning,
        )
        Text(
            text = "$tierName cap reached. Upgrade $fanName or wait for the reset.",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun CreatorTierChip(
    name: String,
    rank: Int,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(creatorTierBgColor(rank))
                .padding(horizontal = 6.dp, vertical = 2.dp)
                .testTag("chatCreatorTierChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        val icon =
            when {
                rank >= 4 -> PantopusIcon.Crown
                rank >= 2 -> PantopusIcon.Shield
                else -> null
            }
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 9.dp,
                strokeWidth = 2.4f,
                tint = creatorTierColor(rank),
            )
        }
        Text(
            text = name.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = creatorTierColor(rank),
        )
    }
}

private fun creatorTierColor(rank: Int): Color =
    when (rank) {
        1 -> PantopusColors.appTextSecondary
        2 -> PantopusColors.warning
        3 -> PantopusColors.appTextStrong
        4 -> PantopusColors.warning
        else -> PantopusColors.appTextSecondary
    }

private fun creatorTierBgColor(rank: Int): Color =
    when (rank) {
        1 -> PantopusColors.appSurfaceSunken
        2 -> PantopusColors.warningBg
        3 -> PantopusColors.appSurfaceSunken
        4 -> PantopusColors.warningLight
        else -> PantopusColors.appSurfaceSunken
    }

private fun presenceFor(counterparty: ChatCounterparty): Pair<Boolean, String>? = presenceFor(counterparty, false)

private fun presenceFor(
    counterparty: ChatCounterparty,
    isFanThread: Boolean,
): Pair<Boolean, String>? =
    if (isFanThread) {
        val text =
            when (counterparty) {
                is ChatCounterparty.Person -> counterparty.locality?.let { "$it · creator" } ?: "Creator"
                else -> "Creator"
            }
        true to text
    } else {
        when (counterparty) {
            is ChatCounterparty.Person -> {
                val prefix = if (counterparty.online) "Active now" else "Verified neighbor"
                val text = if (counterparty.locality != null) "$prefix · ${counterparty.locality}" else prefix
                counterparty.online to text
            }
            is ChatCounterparty.Group -> counterparty.memberCount?.let { false to "$it members" }
            is ChatCounterparty.Ai -> false to "Replies in seconds · powered by Pantopus AI"
        }
    }

@Composable
private fun HeaderIcon(icon: PantopusIcon) {
    Box(modifier = Modifier.size(34.dp), contentAlignment = Alignment.Center) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.appText)
    }
}

@Composable
private fun HeaderAvatar(
    isAi: Boolean,
    isFanThread: Boolean,
    counterparty: ChatCounterparty,
    tierRank: Int? = null,
) {
    when {
        isAi -> ChatAiAvatar(size = 36.dp)
        isFanThread -> FanPersonaAvatar(initials = fanInitials(counterparty), size = 36.dp)
        counterparty is ChatCounterparty.Person ->
            PersonAvatar(
                initials = counterparty.initials,
                verified = counterparty.verified,
                online = counterparty.online,
                size = 36.dp,
                ringColor = tierRank?.let(::creatorTierColor),
            )
        counterparty is ChatCounterparty.Group ->
            PersonAvatar(
                initials = counterparty.displayName.initials(),
                verified = false,
                online = false,
                size = 36.dp,
                ringColor = tierRank?.let(::creatorTierColor),
            )
        else -> ChatAiAvatar(size = 36.dp)
    }
}

private fun fanInitials(counterparty: ChatCounterparty): String =
    when (counterparty) {
        is ChatCounterparty.Person -> counterparty.initials
        is ChatCounterparty.Group -> counterparty.displayName.initials()
        is ChatCounterparty.Ai -> "AI"
    }

private fun String.initials(): String = split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()

@Composable
private fun PersonAvatar(
    initials: String,
    verified: Boolean,
    online: Boolean,
    size: androidx.compose.ui.unit.Dp,
    ringColor: Color? = null,
    // Design `.vb` is 14px on the 36px header avatar and 24px on the 88px
    // empty-state avatar — callers scale it alongside [size].
    badgeSize: androidx.compose.ui.unit.Dp = 13.dp,
) {
    Box(modifier = Modifier.size(size + 4.dp), contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600),
            contentAlignment = Alignment.Center,
        ) {
            if (ringColor != null) {
                Box(
                    modifier =
                        Modifier
                            .matchParentSize()
                            .border(2.dp, PantopusColors.appSurface, CircleShape)
                            .padding(2.dp)
                            .border(2.dp, ringColor, CircleShape),
                )
            }
            Text(
                text = initials,
                fontSize = (size.value * 0.4f).sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (verified) {
            Box(
                modifier =
                    Modifier
                        .size(badgeSize)
                        .clip(CircleShape)
                        // Design `.vb` is success-green (PantopusColors.success), not brand blue.
                        .background(PantopusColors.success)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = badgeSize * 0.55f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        if (online) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .size(9.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
            )
        }
    }
}

@Composable
private fun FanPersonaAvatar(
    initials: String,
    size: androidx.compose.ui.unit.Dp,
) {
    Box(modifier = Modifier.size(size + 4.dp), contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(PantopusColors.business),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = (size.value * 0.35f).sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(13.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.business)
                    .border(2.dp, PantopusColors.appSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 7.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun FanMembershipStripe(
    entitlement: ChatFanEntitlement,
    onManage: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(PantopusColors.appSurface)
                .padding(start = 14.dp, end = Spacing.s2)
                .testTag("chatFanMembershipStripe"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.warningBg)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.Crown, contentDescription = null, size = 10.dp, tint = PantopusColors.warning)
            Text(
                text = entitlement.currentTier.uppercase(),
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.warning,
            )
        }
        PantopusIconImage(icon = PantopusIcon.Calendar, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextMuted)
        Text(
            text = "renews ${entitlement.renewsOn}",
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clickable(onClick = onManage)
                    .padding(horizontal = 6.dp)
                    .testTag("chatFanManageMembership"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = "Manage",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 11.dp, tint = PantopusColors.primary600)
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
}

@Composable
private fun FanQuotaGate(
    entitlement: ChatFanEntitlement,
    onUpgrade: () -> Unit,
) {
    val gateColor = if (entitlement.canReply) PantopusColors.primary700 else PantopusColors.warning
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(50.dp)
                .background(if (entitlement.canReply) PantopusColors.appSurface else PantopusColors.warningBg)
                .padding(start = 14.dp, end = Spacing.s2)
                .testTag("chatFanQuotaGate"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(if (entitlement.canReply) PantopusColors.infoBg else PantopusColors.appSurface)
                    .border(
                        1.dp,
                        if (entitlement.canReply) PantopusColors.infoLight else PantopusColors.warningLight,
                        RoundedCornerShape(Radii.pill),
                    )
                    .padding(horizontal = 9.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.MessageSquare, contentDescription = null, size = 11.dp, tint = gateColor)
            Text(
                text = "${entitlement.messagesLeft} of ${entitlement.messageLimit} left",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = gateColor,
            )
        }
        Text(
            text = entitlement.requiredReplyTier?.let { "$it required" } ?: entitlement.resetCopy,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clickable(onClick = onUpgrade)
                    .padding(horizontal = 6.dp)
                    .testTag("chatFanQuotaUpgrade"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = "Upgrade",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(icon = PantopusIcon.ArrowUpRight, contentDescription = null, size = 11.dp, tint = PantopusColors.primary600)
        }
    }
}

// MARK: - Frames

@Composable
private fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s4)
                .semantics { contentDescription = "Loading conversation" }
                .testTag("chatConversationLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(6) { index ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement =
                    if (index % 2 == 0) Arrangement.End else Arrangement.Start,
            ) {
                Shimmer(
                    width = if (index % 2 == 0) 220.dp else 180.dp,
                    height = if (index % 3 == 0) 60.dp else 40.dp,
                    cornerRadius = Radii.xl,
                )
            }
        }
    }
}

@Composable
internal fun EmptyFrame(
    counterparty: ChatCounterparty,
    aiPrompts: List<ChatPromptChip>,
    emptyChips: List<ChatPromptChip>,
    onChipTap: (ChatPromptChip) -> Unit,
    conversationMode: ChatConversationMode = ChatConversationMode.Dm,
    fanEntitlement: ChatFanEntitlement? = null,
    onCapabilityTap: (ChatPromptChip) -> Unit = {},
) {
    val isAi = conversationMode == ChatConversationMode.AiAssistant || counterparty is ChatCounterparty.Ai
    when {
        isAi -> AiWelcomeFrame(onCapabilityTap = onCapabilityTap)
        conversationMode == ChatConversationMode.FanThread ->
            FanEmptyFrame(
                counterparty = counterparty,
                entitlement = fanEntitlement,
                onOpenerTap = { label -> onChipTap(ChatPromptChip(id = "fan-opener", label = label, icon = PantopusIcon.MessageSquare)) },
            )
        counterparty is ChatCounterparty.Person ->
            PersonEmptyFrame(counterparty = counterparty, chips = emptyChips, onChipTap = onChipTap)
        counterparty is ChatCounterparty.Group ->
            PersonEmptyFrame(
                counterparty =
                    ChatCounterparty.Person(
                        displayName = counterparty.displayName,
                        initials = counterparty.displayName.initials(),
                    ),
                chips = emptyChips,
                onChipTap = onChipTap,
            )
        else -> AiWelcomeFrame(onCapabilityTap = onCapabilityTap)
    }
}

@Composable
private fun PersonEmptyFrame(
    counterparty: ChatCounterparty.Person,
    chips: List<ChatPromptChip>,
    onChipTap: (ChatPromptChip) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s6)
                .testTag("chatConversationEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PersonAvatar(
            initials = counterparty.initials,
            verified = counterparty.verified,
            online = counterparty.online,
            size = 88.dp,
            badgeSize = 22.dp,
        )
        Spacer(modifier = Modifier.size(Spacing.s4))
        Text(
            text = "Say hi",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.size(6.dp))
        Text(
            text =
                "This is the start of your conversation with ${counterparty.displayName.firstWord()}." +
                    (counterparty.locality?.let { " You're both verified neighbors on $it." } ?: " You're both verified neighbors."),
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(10.dp))
        TrustPill(text = "Private between verified neighbors")
        Spacer(modifier = Modifier.size(18.dp))
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            chips.forEach { chip ->
                QuickChip(chip = chip, onTap = onChipTap)
            }
        }
    }
}

/**
 * A15.5 empty fan thread. The design's "Auto-welcome · free" card is
 * intentionally absent: personas have no welcome-message field on the wire
 * (`backend/routes/personaDms.js` / `serializeMembershipForFan`), and the
 * design's literal fixture ("Welcome to the Diary, Maria." — "— Wynn")
 * would ship one creator's name to every fan.
 */
@Composable
private fun FanEmptyFrame(
    counterparty: ChatCounterparty,
    entitlement: ChatFanEntitlement?,
    onOpenerTap: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(top = 14.dp, start = 14.dp, end = 14.dp, bottom = Spacing.s4)
                .testTag("chatConversationFanEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text(
            text = "Start a conversation",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        val name = counterparty.displayName.firstWord()
        Text(
            text =
                entitlement?.let {
                    "You can message $name directly. " +
                        "Each send uses one of your monthly ${it.currentTier} replies."
                } ?: "You can message $name directly.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        entitlement?.let { FanQuotaHero(it) }
        FanOpeners(onOpenerTap = onOpenerTap)
    }
}

@Composable
private fun FanQuotaHero(entitlement: ChatFanEntitlement) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .testTag("chatFanQuotaHero"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.MessageSquare, contentDescription = null, size = 13.dp, tint = PantopusColors.primary700)
        Text(
            text = "${entitlement.messageLimit} messages this period",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
        )
        Text(text = "·", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary300)
        Text(text = entitlement.resetCopy, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.primary600)
    }
}

@Composable
private fun FanOpeners(onOpenerTap: (String) -> Unit) {
    // Persona-neutral openers. The design's copy is sourdough-specific
    // fixture text; there is no per-persona suggested-prompt payload on the
    // wire, so these stay generic rather than pretending to know what this
    // creator is about.
    val openers =
        listOf(
            FanOpener("question", PantopusIcon.HelpCircle, "Ask a question", "I have a question about"),
            FanOpener("photo", PantopusIcon.Image, "Share something", "Sending a photo for your feedback"),
            FanOpener("hello", PantopusIcon.MessageSquare, "Say hi", "Just joined — happy to be here!"),
        )
    Column(
        modifier = Modifier.fillMaxWidth().testTag("chatFanOpeners"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        openers.forEach { opener ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 50.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable { onOpenerTap(opener.title) }
                        .padding(horizontal = Spacing.s3)
                        .testTag("chatFanOpener_${opener.id}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(30.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.businessBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(icon = opener.icon, contentDescription = null, size = 14.dp, tint = PantopusColors.business)
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = opener.label.uppercase(),
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextMuted,
                    )
                    Text(
                        text = opener.title,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appText,
                    )
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

/**
 * A15 `.sug` — full-width white suggestion card that fills the composer
 * on tap (via the existing prompt-chip plumbing).
 */
@Composable
private fun QuickChip(
    chip: ChatPromptChip,
    onTap: (ChatPromptChip) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(14.dp), clip = false)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .clickable { onTap(chip) }
                .padding(horizontal = 14.dp)
                .heightIn(min = 44.dp)
                .testTag("chatQuickChip_${chip.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = chip.label,
            fontSize = 13.sp,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.ArrowUpRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

/** A15 `.trust` / A15.3 `.ai-trust .row` — success-shield trust pill. */
@Composable
private fun TrustPill(text: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = 10.dp, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.5f,
            tint = PantopusColors.success,
        )
        Text(
            text = text,
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** A15.3 "Empty AI" frame: big avatar, "Ask me anything", trust pill, 2×2 prompt grid. */
@Composable
private fun AiWelcomeFrame(onCapabilityTap: (ChatPromptChip) -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s6, vertical = Spacing.s5)
                .testTag("chatConversationAI"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        ChatAiAvatar(size = 88.dp)
        Spacer(modifier = Modifier.size(Spacing.s4))
        Text(
            text = "Ask me anything",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.size(6.dp))
        Text(
            text = "I use your verified neighbors, tasks, and mailbox to give answers that fit your block.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(10.dp))
        TrustPill(text = "Private to your account · never shared with neighbors")
        Spacer(modifier = Modifier.size(18.dp))
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            AI_PROMPT_CARDS.chunked(2).forEach { rowCards ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    rowCards.forEach { card ->
                        AiPromptCard(
                            card = card,
                            onTap = { tapped ->
                                // Tapping sends the full question as the
                                // thread's first message (iOS parity).
                                onCapabilityTap(
                                    ChatPromptChip(id = tapped.id, label = tapped.question, icon = tapped.icon),
                                )
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (rowCards.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

/**
 * A15.3 empty-state prompt-grid fixture — mirrors iOS `aiPromptCards`
 * (ids, categories, and question copy must stay identical across
 * platforms).
 */
private data class AiPromptCardFixture(
    val id: String,
    val category: String,
    val question: String,
    val icon: PantopusIcon,
)

private val AI_PROMPT_CARDS =
    listOf(
        AiPromptCardFixture("tasks", "Tasks", "What's a fair price to mount a 55\" TV?", PantopusIcon.Hammer),
        AiPromptCardFixture("pulse", "Pulse", "Draft a post asking for a dog-sitter this weekend.", PantopusIcon.Pencil),
        AiPromptCardFixture("mailbox", "Mailbox", "Summarize today's mail and packages.", PantopusIcon.Mailbox),
        AiPromptCardFixture("marketplace", "Marketplace", "Price my mid-century sofa for a quick sale.", PantopusIcon.ShoppingBag),
    )

/** A15.3 `.prompt-grid .pc` — white prompt card with a colored icon square. */
@Composable
private fun AiPromptCard(
    card: AiPromptCardFixture,
    onTap: (AiPromptCardFixture) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Category tints mirror iOS: warning / primary / home / success.
    val accent =
        when (card.id) {
            "tasks" -> PantopusColors.warning
            "pulse" -> PantopusColors.primary600
            "mailbox" -> PantopusColors.home
            "marketplace" -> PantopusColors.success
            else -> PantopusColors.primary600
        }
    Column(
        modifier =
            modifier
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(14.dp), clip = false)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .clickable { onTap(card) }
                .padding(10.dp)
                .testTag("chatAIPromptCard_${card.id}"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(accent),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = card.icon,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = card.category.uppercase(),
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextMuted,
        )
        Text(
            text = card.question,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Medium,
            lineHeight = 16.sp,
            color = PantopusColors.appText,
        )
    }
}

/**
 * A15.3 `.ai-welcome` capability card — pinned at the top of the populated
 * AI thread (the empty frame uses the prompt grid instead).
 */
@Composable
private fun AiWelcomeCard(
    prompts: List<ChatPromptChip>,
    onCapabilityTap: (ChatPromptChip) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.xl))
                .padding(14.dp)
                .testTag("chatAIWelcomeCard"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ChatAiAvatar(size = 32.dp)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = "Hi — I'm Pantopus AI",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "I can use your verified neighbors, tasks, and mailbox to help.",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            prompts.chunked(2).forEach { rowChips ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    rowChips.forEach { chip ->
                        AiCapabilityChip(
                            chip = chip,
                            onTap = onCapabilityTap,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (rowChips.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

/**
 * How many trailing items the viewport may be away from the end and still
 * count as "reading the bottom" for auto-scroll on append — covers the new
 * bubble itself plus a day divider landing with it.
 */
private const val NEAR_BOTTOM_ROW_SLACK = 2

@Composable
internal fun PopulatedFrame(
    rows: List<ChatTimelineRow>,
    onRetry: (String) -> Unit,
    onLoadOlder: () -> Unit,
    scrollToRowId: String? = null,
    onScrollConsumed: () -> Unit = {},
    conversationMode: ChatConversationMode = ChatConversationMode.Dm,
    incomingInitials: String? = null,
    aiPrompts: List<ChatPromptChip> = emptyList(),
    onCapabilityTap: (ChatPromptChip) -> Unit = {},
    onLockedAction: () -> Unit = {},
    onBubbleLongPress: (ChatBubbleContent) -> Unit = {},
    selectedMessageIds: Set<String> = emptySet(),
    onBubbleTap: (ChatBubbleContent) -> Unit = {},
    onUseAIDraft: (ChatAIDraftCard) -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenListing: (String) -> Unit = {},
    onOpenLocation: (Double, Double) -> Unit = { _, _ -> },
    onReact: (String, String) -> Unit = { _, _ -> },
    linkPreviews: Map<String, LinkPreview?> = emptyMap(),
    onResolveLink: (String) -> Unit = {},
    onOpenUrl: (String) -> Unit = {},
) {
    val listState = rememberLazyListState()
    // Leading non-row items (pagination spacer + any pinned welcome card)
    // offset row indices inside the LazyColumn.
    val headerCount =
        1 + (if (conversationMode == ChatConversationMode.AiAssistant && aiPrompts.isNotEmpty()) 1 else 0)
    // Set once the first non-empty projection has been positioned — gates
    // the load-older trigger so it can't fire while the list still sits at
    // the top pre-scroll.
    var initialScrollDone by remember { mutableStateOf(false) }
    LaunchedEffect(rows.size) {
        if (rows.isEmpty()) return@LaunchedEffect
        val lastIndex = headerCount + rows.lastIndex
        if (!initialScrollDone) {
            // Open at the latest message. A Chat Search deep-link owns the
            // first scroll instead (the effect below lands on the match).
            if (scrollToRowId == null) listState.scrollToItem(lastIndex)
            initialScrollDone = true
            return@LaunchedEffect
        }
        // Follow appended rows (own sends, incoming messages) only when the
        // user is already reading near the bottom — never yank them out of
        // scrolled-back history. Prepends keep their anchor via the rows'
        // stable keys, so they fail this check and preserve position.
        val layoutInfo = listState.layoutInfo
        val lastVisible = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: return@LaunchedEffect
        if (lastVisible >= layoutInfo.totalItemsCount - 1 - NEAR_BOTTOM_ROW_SLACK) {
            listState.animateScrollToItem(lastIndex)
        }
    }
    // Backwards pagination: fetch an older page only when the FIRST item
    // actually becomes visible after the initial scroll-to-bottom. The old
    // composition-scoped trigger fired on first paint and chain-fired on
    // every prepend, auto-fetching the entire history on open.
    val shouldLoadOlder by remember {
        derivedStateOf { initialScrollDone && listState.firstVisibleItemIndex <= 1 }
    }
    LaunchedEffect(shouldLoadOlder, rows.firstOrNull()?.rowId) {
        if (shouldLoadOlder) onLoadOlder()
    }
    // Chat Search deep-link: animate to the matched row once it lands in
    // the list, then clear the target. The [headerCount] offset skips the
    // leading pagination spacer (and any pinned welcome card). Compose
    // honors the system "remove animations" setting, so this is instant
    // under reduced motion.
    LaunchedEffect(scrollToRowId, rows) {
        val target = scrollToRowId ?: return@LaunchedEffect
        val index = rows.indexOfFirst { it.rowId == target }
        if (index >= 0) {
            listState.animateScrollToItem(index + headerCount)
            onScrollConsumed()
        }
    }
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().testTag("chatConversationContent"),
        contentPadding = PaddingValues(horizontal = Spacing.s3, vertical = Spacing.s3),
    ) {
        item(key = "chat_pagination_top_spacer") {
            Spacer(modifier = Modifier.size(1.dp))
        }
        // A15.5's "Auto-welcome · free" card is omitted: no persona
        // welcome-message exists on the wire, and the design's copy is
        // fixture identity.
        // A15.3: the `.ai-welcome` capability card doubles as the AI
        // thread's pinned system message at the top of the timeline.
        if (conversationMode == ChatConversationMode.AiAssistant && aiPrompts.isNotEmpty()) {
            item(key = "ai_welcome_card") {
                AiWelcomeCard(
                    prompts = aiPrompts,
                    onCapabilityTap = onCapabilityTap,
                    modifier = Modifier.padding(bottom = Spacing.s3),
                )
            }
        }
        items(items = rows, key = { it.rowId }) { row ->
            when (row) {
                is ChatTimelineRow.DayDivider -> DayDividerRow(label = row.divider.label)
                is ChatTimelineRow.TopicDivider -> TopicDividerRow(label = row.label)
                is ChatTimelineRow.BroadcastReference -> BroadcastReferenceCard(reference = row.reference)
                is ChatTimelineRow.Bubble ->
                    BubbleRow(
                        content = row.content,
                        incomingInitials = incomingInitials,
                        onLockedAction = onLockedAction,
                        onLongPress = { onBubbleLongPress(row.content) },
                        isSelected = selectedMessageIds.contains(row.content.id),
                        onTap = { onBubbleTap(row.content) },
                        onUseAIDraft = onUseAIDraft,
                        onOpenGig = onOpenGig,
                        onOpenListing = onOpenListing,
                        onOpenLocation = onOpenLocation,
                        onRetry = {
                            if (row.content.id.startsWith("client_")) onRetry(row.content.id)
                        },
                        onReact = { reaction -> onReact(row.content.id, reaction) },
                        linkPreviews = linkPreviews,
                        onResolveLink = onResolveLink,
                        onOpenUrl = onOpenUrl,
                    )
            }
        }
    }
}

@Composable
private fun BroadcastReferenceCard(reference: ChatBroadcastReference) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.business.copy(alpha = 0.18f), RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .testTag("chatBroadcastReference_${reference.id}"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.RadioTower,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "BROADCAST REFERENCED",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.business,
                maxLines = 1,
            )
            Text(
                text = reference.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = reference.subtitle,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = reference.metric,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun DayDividerRow(label: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.weight(1f).height(1.dp).background(PantopusColors.appBorder))
        Text(
            text = label.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextMuted,
        )
        Box(modifier = Modifier.weight(1f).height(1.dp).background(PantopusColors.appBorder))
    }
}

/**
 * Topic-change marker on the unfiltered person thread — same geometry as
 * [DayDividerRow] but primary-tinted so it reads as a topic, not a date.
 */
@Composable
private fun TopicDividerRow(label: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.weight(1f).height(1.dp).background(PantopusColors.appBorder))
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.primary600,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Box(modifier = Modifier.weight(1f).height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun BubbleRow(
    content: ChatBubbleContent,
    incomingInitials: String? = null,
    onLockedAction: () -> Unit,
    onLongPress: () -> Unit,
    isSelected: Boolean = false,
    onTap: () -> Unit = {},
    onUseAIDraft: (ChatAIDraftCard) -> Unit,
    onOpenGig: (String) -> Unit,
    onOpenListing: (String) -> Unit,
    onOpenLocation: (Double, Double) -> Unit,
    onRetry: () -> Unit,
    onReact: (String) -> Unit = {},
    linkPreviews: Map<String, LinkPreview?> = emptyMap(),
    onResolveLink: (String) -> Unit = {},
    onOpenUrl: (String) -> Unit = {},
) {
    val isOut = content.side == ChatMessageSide.Outgoing
    // A15.2 link bubbles: first http(s) URL in a plain text body drives
    // the preview card under the bubble (AI drafts / rich cards excluded).
    val firstLinkUrl =
        when (val body = content.body) {
            is ChatBubbleBody.Text -> firstHttpUrl(body.text)
            is ChatBubbleBody.TextWithImages -> firstHttpUrl(body.text)
            else -> null
        }
    LaunchedEffect(firstLinkUrl) { firstLinkUrl?.let(onResolveLink) }
    // Incoming bubbles are white with a hairline border; outgoing are
    // solid blue. The design caps a bubble at 78% of the row width —
    // derive it from the screen minus the list's horizontal padding
    // (12dp each side).
    val bubbleColor = if (isOut) PantopusColors.primary600 else PantopusColors.appSurface
    val textColor = if (isOut) PantopusColors.appTextInverse else PantopusColors.appText
    val bubbleMaxWidth = ((LocalConfiguration.current.screenWidthDp - 24) * 0.78f).dp
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(if (isSelected) Modifier.background(PantopusColors.primary50) else Modifier)
                .combinedClickable(onClick = onTap, onLongClick = onLongPress)
                .padding(top = if (content.isContinuation) 2.dp else Spacing.s1, bottom = if (content.stamp == null) 3.dp else 0.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = if (isOut) Arrangement.End else Arrangement.Start,
    ) {
        if (isOut) {
            if (isSelected) {
                // Selection-mode checkmark in the slot the outgoing layout
                // already reserves on the leading edge.
                Box(modifier = Modifier.size(44.dp), contentAlignment = Alignment.Center) {
                    PantopusIconImage(
                        icon = PantopusIcon.CheckCircle,
                        contentDescription = "Selected",
                        size = 18.dp,
                        strokeWidth = 2.4f,
                        tint = PantopusColors.primary600,
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(44.dp))
            }
        } else if (incomingInitials != null && !content.body.isRichCard) {
            MiniAvatar(initials = incomingInitials, hidden = content.isContinuation)
            Spacer(modifier = Modifier.size(6.dp))
        }
        Column(horizontalAlignment = if (isOut) Alignment.End else Alignment.Start) {
            // Reactions float as pills overlapping the bubble's bottom
            // corner (design `.reaction { bottom: -10; left/right: 8 }`).
            Box {
                when (val body = content.body) {
                    is ChatBubbleBody.Text ->
                        if (isEmojiOnly(body.text)) {
                            // Emoji-only messages render large with no bubble (RN).
                            Text(
                                text = body.text,
                                fontSize = 48.sp,
                                lineHeight = 56.sp,
                                color = textColor,
                            )
                        } else {
                            BubbleContainer(
                                isOut = isOut,
                                hasTail = content.hasTail,
                                isContinuation = content.isContinuation,
                                bubbleColor = bubbleColor,
                                lockedTier = content.lockedTier?.takeIf { !isOut },
                                onLockedAction = onLockedAction,
                                contentId = content.id,
                            ) {
                                Column(modifier = Modifier.widthIn(max = bubbleMaxWidth)) {
                                    ReplyPreview(preview = content.replyPreview, isOut = isOut)
                                    LinkifiedBubbleText(
                                        text = body.text,
                                        isOut = isOut,
                                        textColor = textColor,
                                        onOpenUrl = onOpenUrl,
                                    )
                                }
                            }
                        }
                    is ChatBubbleBody.TextWithImages ->
                        BubbleContainer(
                            isOut = isOut,
                            hasTail = content.hasTail,
                            isContinuation = content.isContinuation,
                            bubbleColor = bubbleColor,
                            lockedTier = content.lockedTier?.takeIf { !isOut },
                            onLockedAction = onLockedAction,
                            contentId = content.id,
                        ) {
                            Column(
                                modifier = Modifier.widthIn(max = bubbleMaxWidth),
                                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                            ) {
                                if (body.text.isNotBlank()) {
                                    LinkifiedBubbleText(
                                        text = body.text,
                                        isOut = isOut,
                                        textColor = textColor,
                                        onOpenUrl = onOpenUrl,
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    body.imageUrls.take(3).forEach { url ->
                                        AsyncImage(
                                            model = url,
                                            contentDescription = "AI prompt image",
                                            contentScale = ContentScale.Crop,
                                            modifier =
                                                Modifier
                                                    .size(72.dp)
                                                    .clip(RoundedCornerShape(Radii.md)),
                                        )
                                    }
                                }
                            }
                        }
                    is ChatBubbleBody.Image ->
                        PhotoBubble(
                            url = body.url,
                            isOut = isOut,
                            hasTail = content.hasTail,
                            isContinuation = content.isContinuation,
                            lockedTier = content.lockedTier?.takeIf { !isOut },
                            onLockedAction = onLockedAction,
                            contentId = content.id,
                        )
                    is ChatBubbleBody.Attachment ->
                        BubbleContainer(
                            isOut = isOut,
                            hasTail = content.hasTail,
                            isContinuation = content.isContinuation,
                            bubbleColor = bubbleColor,
                            lockedTier = content.lockedTier?.takeIf { !isOut },
                            onLockedAction = onLockedAction,
                            contentId = content.id,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                                PantopusIconImage(
                                    icon = PantopusIcon.File,
                                    contentDescription = null,
                                    size = 18.dp,
                                    tint = if (isOut) PantopusColors.appTextInverse else PantopusColors.primary600,
                                )
                                Text(
                                    text = body.filename,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = textColor,
                                )
                            }
                        }
                    is ChatBubbleBody.SystemLink -> SystemLinkPill(body)
                    is ChatBubbleBody.LocationCard ->
                        ChatLocationCardView(
                            card = body.card,
                            isOutgoing = isOut,
                            onOpen = { onOpenLocation(body.card.latitude, body.card.longitude) },
                        )
                    is ChatBubbleBody.GigOfferCard ->
                        ChatGigOfferCardView(
                            card = body.card,
                            isOutgoing = isOut,
                            onOpen = { body.card.gigId.takeIf { it.isNotBlank() }?.let(onOpenGig) },
                        )
                    is ChatBubbleBody.ListingOfferCard ->
                        ChatListingOfferCardView(
                            card = body.card,
                            isOutgoing = isOut,
                            onOpen = { body.card.listingId.takeIf { it.isNotBlank() }?.let(onOpenListing) },
                        )
                    is ChatBubbleBody.AiReply -> AiReplyBubble(body = body, hasTail = content.hasTail, onUseDraft = onUseAIDraft)
                }
                if (content.reactions.isNotEmpty()) {
                    // Tapping a pill toggles the reaction (iOS parity).
                    ReactionRow(
                        reactions = content.reactions,
                        onReact = onReact,
                        modifier =
                            Modifier
                                .align(if (isOut) Alignment.BottomStart else Alignment.BottomEnd)
                                .offset(x = if (isOut) Spacing.s2 else -Spacing.s2, y = 10.dp),
                    )
                }
            }
            if (content.reactions.isNotEmpty()) {
                // Clearance for the reaction pill overhanging the bubble so
                // it doesn't collide with the stamp or the next row.
                Spacer(modifier = Modifier.height(10.dp))
            }
            // A15.2 `.link-bubble`: preview card for the first URL, in the
            // same column as the bubble. Renders only once metadata has
            // resolved — no skeleton, and nothing at all on failure.
            firstLinkUrl?.let { url ->
                linkPreviews[url]?.let { preview ->
                    LinkPreviewCard(
                        preview = preview,
                        maxWidth = bubbleMaxWidth,
                        onOpen = { onOpenUrl(preview.url) },
                    )
                }
            }
            if (content.sentSupportTier != null && isOut) {
                PaidSupportFooter(tier = content.sentSupportTier, contentId = content.id)
            }
            if (content.stamp != null) {
                StampRow(content = content, onRetry = onRetry)
            }
        }
        if (!isOut) {
            Spacer(modifier = Modifier.size(44.dp))
        }
    }
}

@Composable
private fun ReplyPreview(
    preview: ChatReplyPreview?,
    isOut: Boolean,
) {
    if (preview == null) return
    Row(
        modifier = Modifier.padding(bottom = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .widthIn(min = 3.dp, max = 3.dp)
                    .height(34.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(if (isOut) PantopusColors.appTextInverse.copy(alpha = 0.45f) else PantopusColors.primary600),
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = preview.senderName,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = if (isOut) PantopusColors.appTextInverse.copy(alpha = 0.9f) else PantopusColors.primary600,
                maxLines = 1,
            )
            Text(
                text = preview.text,
                fontSize = 11.sp,
                color = if (isOut) PantopusColors.appTextInverse.copy(alpha = 0.72f) else PantopusColors.appTextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * First http(s) URL in [text] via [Patterns.WEB_URL], or null. Schemeless
 * matches ("example.com") are ignored — only explicit http/https links
 * become tappable / drive the preview card.
 */
private fun firstHttpUrl(text: String): String? {
    if (!text.contains("http://", ignoreCase = true) && !text.contains("https://", ignoreCase = true)) return null
    val matcher = Patterns.WEB_URL.matcher(text)
    while (matcher.find()) {
        val match = matcher.group()
        if (match.startsWith("http://", ignoreCase = true) || match.startsWith("https://", ignoreCase = true)) {
            return match
        }
    }
    return null
}

/**
 * Bubble body text with http(s) URLs rendered as tappable, underlined
 * links (A15.2). Link tint stays readable per side: inverse-on-blue for
 * outgoing, primary for incoming.
 */
@Composable
private fun LinkifiedBubbleText(
    text: String,
    isOut: Boolean,
    textColor: Color,
    onOpenUrl: (String) -> Unit,
) {
    val linkColor = if (isOut) PantopusColors.appTextInverse else PantopusColors.primary600
    val annotated =
        remember(text, isOut) {
            buildAnnotatedString {
                var cursor = 0
                val matcher = Patterns.WEB_URL.matcher(text)
                while (matcher.find()) {
                    val match = matcher.group()
                    val isHttp =
                        match.startsWith("http://", ignoreCase = true) ||
                            match.startsWith("https://", ignoreCase = true)
                    if (!isHttp) continue
                    append(text.substring(cursor, matcher.start()))
                    withLink(
                        LinkAnnotation.Url(
                            url = match,
                            styles =
                                TextLinkStyles(
                                    style =
                                        SpanStyle(
                                            color = linkColor,
                                            textDecoration = TextDecoration.Underline,
                                        ),
                                ),
                            linkInteractionListener = { onOpenUrl(match) },
                        ),
                    ) { append(match) }
                    cursor = matcher.end()
                }
                append(text.substring(cursor))
            }
        }
    Text(
        text = annotated,
        fontSize = 13.5.sp,
        lineHeight = 18.sp,
        color = textColor,
    )
}

/**
 * A15.2 `.link-bubble` preview card under a text bubble: optional image
 * strip, host overline, title, description. Tapping opens the URL.
 */
@Composable
private fun LinkPreviewCard(
    preview: LinkPreview,
    maxWidth: Dp,
    onOpen: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(top = Spacing.s1)
                .widthIn(max = maxWidth)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onOpen)
                .testTag("chatLinkPreview_${preview.url.hashCode()}"),
    ) {
        preview.imageUrl?.let { imageUrl ->
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(88.dp),
            )
        }
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = preview.host.uppercase(),
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = preview.title,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            preview.description?.takeIf { it.isNotBlank() }?.let { description ->
                Text(
                    text = description,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * True when [raw] is 1–N emoji and nothing else — those render large
 * with no bubble (RN / iOS parity). Mirrors the iOS `isEmojiOnly`:
 * non-empty, <= 30 chars, every code point an emoji (allowing variation
 * selectors, ZWJ, and skin-tone modifiers as connective glue).
 */
private fun isEmojiOnly(raw: String): Boolean {
    val trimmed = raw.trim()
    if (trimmed.isEmpty() || trimmed.length > 30) return false
    var sawEmoji = false
    var index = 0
    while (index < trimmed.length) {
        val cp = trimmed.codePointAt(index)
        index += Character.charCount(cp)
        when {
            isEmojiCodePoint(cp) -> sawEmoji = true
            // Glue that may appear between emoji: VS16, ZWJ, skin tones.
            cp == 0xFE0F || cp == 0x200D || cp in 0x1F3FB..0x1F3FF -> Unit
            else -> return false
        }
    }
    return sawEmoji
}

private fun isEmojiCodePoint(cp: Int): Boolean =
    cp in 0x1F300..0x1FAFF || // symbols & pictographs, supplemental, extended-A
        cp in 0x1F1E6..0x1F1FF || // regional indicators (flags)
        cp in 0x2600..0x27BF || // misc symbols + dingbats
        cp in 0x2300..0x23FF || // misc technical (⌚ ⏰ …)
        cp == 0x2B50 || cp == 0x2B55 || // ⭐ ⭕
        cp in 0x2190..0x21FF // arrows used as emoji

@Composable
private fun BubbleContainer(
    isOut: Boolean,
    hasTail: Boolean,
    bubbleColor: Color,
    isContinuation: Boolean = false,
    lockedTier: String? = null,
    onLockedAction: () -> Unit = {},
    contentId: String = "",
    inner: @Composable () -> Unit,
) {
    // Design: 18dp radius, 6dp tail corner, and a tightened 6dp top corner
    // on the sender's side for continuation bubbles (`.bubble.cont`).
    val shape =
        RoundedCornerShape(
            topStart = if (!isOut && isContinuation) Radii.sm else 18.dp,
            topEnd = if (isOut && isContinuation) Radii.sm else 18.dp,
            bottomEnd = if (isOut && hasTail) Radii.sm else 18.dp,
            bottomStart = if (!isOut && hasTail) Radii.sm else 18.dp,
        )
    Box(
        modifier =
            Modifier
                // Design shadow-sm (0 1 3 @4%) — a hair of elevation, clip
                // disabled so the reaction pill can overhang.
                .shadow(elevation = 1.dp, shape = shape, clip = false)
                .clip(shape)
                .background(bubbleColor)
                .then(
                    if (!isOut) Modifier.border(1.dp, PantopusColors.appBorder, shape) else Modifier,
                ),
    ) {
        Box(modifier = Modifier.padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2, bottom = 9.dp)) {
            inner()
        }
        if (lockedTier != null) {
            LockedPaywallOverlay(
                tier = lockedTier,
                contentId = contentId,
                onLockedAction = onLockedAction,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
private fun ComposerContextBanner(
    reply: ChatReplyPreview?,
    editing: Boolean,
    onCancel: () -> Unit,
) {
    if (reply == null && !editing) return
    // RN reply/edit bars: tinted bar with a 3dp accent stripe.
    val accent = if (editing) PantopusColors.success else PantopusColors.primary600
    val barBackground = if (editing) PantopusColors.successBg else PantopusColors.primary50
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(50.dp)
                .background(barBackground)
                .padding(start = Spacing.s3, end = Spacing.s1)
                .testTag("chatComposerContext"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .width(3.dp)
                    .height(32.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(accent),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = if (editing) "Editing message" else "Replying to ${reply?.senderName.orEmpty()}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = accent,
                maxLines = 1,
            )
            Text(
                text = if (editing) "Make your changes, then send." else reply?.text.orEmpty(),
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            modifier = Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onCancel),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Cancel message action",
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

@Composable
private fun TopicStrip(
    topics: List<ChatConversationTopic>,
    selectedTopicId: String?,
    onSelect: (String?) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("chatTopicStrip"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TopicChip(title = "All", icon = PantopusIcon.MessageCircle, selected = selectedTopicId == null) {
            onSelect(null)
        }
        topics.forEach { topic ->
            TopicChip(
                title = topic.title,
                icon = topicIcon(topic.topicType),
                selected = selectedTopicId == topic.id,
            ) {
                onSelect(topic.id)
            }
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

@Composable
private fun TopicChip(
    title: String,
    icon: PantopusIcon,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .height(30.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurfaceSunken)
                // RN: only the active chip carries a border (primary200).
                .then(
                    if (selected) {
                        Modifier.border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.pill))
                    } else {
                        Modifier
                    },
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        val color = if (selected) PantopusColors.primary600 else PantopusColors.appTextSecondary
        PantopusIconImage(icon = icon, contentDescription = null, size = Radii.lg, strokeWidth = 2.4f, tint = color)
        Text(
            text = title,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = color,
            maxLines = 1,
        )
    }
}

private fun topicIcon(type: String): PantopusIcon =
    when (type) {
        "task" -> PantopusIcon.Briefcase
        "listing" -> PantopusIcon.Tag
        "home" -> PantopusIcon.Home
        "business" -> PantopusIcon.Building2
        else -> PantopusIcon.MessageCircle
    }

/** Raw text for the clipboard — `null` hides the Copy action for non-text bodies. */
private val ChatBubbleBody.copyableText: String?
    get() =
        when (this) {
            is ChatBubbleBody.Text -> text.takeIf { it.isNotBlank() }
            is ChatBubbleBody.TextWithImages -> text.takeIf { it.isNotBlank() }
            is ChatBubbleBody.AiReply -> text.takeIf { it.isNotBlank() }
            else -> null
        }

@Composable
private fun MessageActionSheet(
    content: ChatBubbleContent,
    // Invoked after the text has landed on the clipboard — dismisses the sheet.
    onCopy: () -> Unit,
    onReply: () -> Unit,
    onSelect: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onReact: (String) -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    val copyText = content.body.copyableText
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            listOf("👍", "❤️", "😂", "🔥").forEach { reaction ->
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurfaceSunken)
                            .clickable { onReact(reaction) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = reaction, fontSize = 20.sp)
                }
            }
        }
        if (copyText != null) {
            MessageActionRow(
                label = "Copy",
                icon = PantopusIcon.Copy,
                onClick = {
                    clipboard.setText(AnnotatedString(copyText))
                    onCopy()
                },
            )
        }
        MessageActionRow(label = "Reply", icon = PantopusIcon.Reply, onClick = onReply)
        // Select/Edit/Delete hit per-message server endpoints — hide them
        // for rows with no server id: in-flight optimistic sends
        // (`client_`) and AI-thread local rows (`ai_user_` /
        // `ai_assistant_`), whose edits/deletes can only ever 404.
        if (content.side == ChatMessageSide.Outgoing &&
            !content.id.startsWith("client_") &&
            !content.id.startsWith("ai_")
        ) {
            MessageActionRow(label = "Select", icon = PantopusIcon.CheckCircle, onClick = onSelect)
            MessageActionRow(label = "Edit", icon = PantopusIcon.Pencil, onClick = onEdit)
            MessageActionRow(label = "Delete", icon = PantopusIcon.Trash2, destructive = true, onClick = onDelete)
        }
    }
}

@Composable
private fun MessageActionRow(
    label: String,
    icon: PantopusIcon,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        val color = if (destructive) PantopusColors.error else PantopusColors.appTextStrong
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = color)
        Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = color)
    }
}

// MARK: - Selection mode chrome

@Composable
private fun SelectionTopBar(
    count: Int,
    onCancel: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .testTag("chatSelectionTopBar"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "$count selected",
            modifier = Modifier.weight(1f),
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Cancel",
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(onClick = onCancel)
                    .padding(Spacing.s2)
                    .testTag("chatSelectionCancel"),
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

@Composable
private fun SelectionDeleteBar(
    enabled: Boolean,
    onDelete: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (enabled) PantopusColors.error else PantopusColors.appSurfaceSunken)
                    .clickable(enabled = enabled, onClick = onDelete)
                    .padding(vertical = Spacing.s3)
                    .testTag("chatSelectionDelete"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = null,
                size = 18.dp,
                tint = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "Delete",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
            )
        }
    }
}

// MARK: - Pre-bid send limit banner

@Composable
private fun SendLimitNoticeBanner(
    text: String,
    onDismiss: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.warningBg)
                .padding(start = Spacing.s3)
                .testTag("chatSendLimitNotice"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.warning,
        )
        Text(
            text = text,
            modifier = Modifier.weight(1f).padding(vertical = Spacing.s2),
            fontSize = 13.sp,
            color = PantopusColors.warning,
        )
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onDismiss)
                    .testTag("chatSendLimitNoticeDismiss"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Dismiss notice",
                size = 14.dp,
                tint = PantopusColors.warning,
            )
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

// MARK: - Conversation details

/**
 * Conversation-details drawer (person threads): topics filed under the
 * conversation plus the Safety section (Report + Block). Mirrors the RN
 * drawer (`apps/mobile/src/app/chat/conversation/[otherUserId].tsx`).
 * Report posts to `POST /api/users/:userId/report` (route
 * `backend/routes/users.js:4153`, validator `:4137`).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationDetailsSheet(
    counterpartyName: String,
    topics: List<ChatConversationTopic>,
    isBlocking: Boolean,
    onDismiss: () -> Unit,
    onReport: () -> Unit,
    onBlock: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s6)
                    .testTag("chatDetailsSheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "Conversation details",
                modifier = Modifier.fillMaxWidth(),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
            Text(
                text = "TOPICS",
                modifier = Modifier.padding(top = Spacing.s2),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            if (topics.isEmpty()) {
                Text(
                    text = "Topics appear when you chat about a task or listing.",
                    fontSize = 14.sp,
                    color = PantopusColors.appTextMuted,
                )
            } else {
                topics.forEach { topic -> DetailsTopicRow(topic = topic) }
            }
            Text(
                text = "SAFETY",
                modifier = Modifier.padding(top = Spacing.s3),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            // Report — non-destructive, above Block (design order).
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .clickable(onClick = onReport)
                        .padding(horizontal = Spacing.s1)
                        .testTag("chatDetailsReport"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Flag,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Report $counterpartyName",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .clickable(enabled = !isBlocking, onClick = onBlock)
                        .padding(horizontal = Spacing.s1)
                        .testTag("chatDetailsBlock"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Ban,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.error,
                )
                Text(
                    text = "Block $counterpartyName",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.error,
                )
                if (isBlocking) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 2.dp,
                        color = PantopusColors.error,
                    )
                }
            }
        }
    }
}

/**
 * Backend-accepted report reasons (`backend/routes/users.js:4137` Joi
 * schema: `spam · harassment · inappropriate · misinformation · safety ·
 * other`) with the friendly labels from the design.
 */
private val CHAT_REPORT_REASONS =
    listOf(
        "spam" to "Spam",
        "harassment" to "Harassment or bullying",
        "inappropriate" to "Inappropriate content",
        "misinformation" to "Misinformation",
        "safety" to "Safety concern",
        "other" to "Something else",
    )

/**
 * Report reason picker for the conversation Safety section: one of the
 * six backend reasons plus an optional details field. Submits via
 * [ChatConversationViewModel.reportUser] →
 * `POST /api/users/:userId/report` (`backend/routes/users.js:4153`).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatReportUserSheet(
    counterpartyName: String,
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (reason: String, details: String?) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedReason by remember { mutableStateOf<String?>(null) }
    var details by remember { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s6)
                    .testTag("chatReportSheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "Report $counterpartyName",
                modifier = Modifier.fillMaxWidth(),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
            Text(
                text = "Tell us what's going on. Our moderators review every report.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
            CHAT_REPORT_REASONS.forEach { (key, label) ->
                val isSelected = selectedReason == key
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .then(
                                if (isSelected) {
                                    Modifier
                                        .background(PantopusColors.primary50)
                                        .border(1.dp, PantopusColors.primary600, RoundedCornerShape(Radii.lg))
                                } else {
                                    Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                                },
                            ).clickable(enabled = !isSubmitting) { selectedReason = key }
                            .padding(horizontal = Spacing.s3)
                            .testTag("chatReportReason_$key"),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = label,
                        fontSize = 14.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        color = if (isSelected) PantopusColors.primary600 else PantopusColors.appText,
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 72.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s3),
            ) {
                BasicTextField(
                    value = details,
                    onValueChange = { details = it.take(1000) },
                    enabled = !isSubmitting,
                    textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth().testTag("chatReportDetails"),
                    decorationBox = { inner ->
                        if (details.isEmpty()) {
                            Text(
                                text = "Add anything that helps (optional)",
                                fontSize = 14.sp,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                        inner()
                    },
                )
            }
            PrimaryButton(
                title = "Submit report",
                onClick = { selectedReason?.let { onSubmit(it, details.trim().takeIf { d -> d.isNotEmpty() }) } },
                isEnabled = selectedReason != null && !isSubmitting,
                isLoading = isSubmitting,
                modifier = Modifier.fillMaxWidth().testTag("chatReportSubmit"),
            )
            GhostButton(
                title = "Cancel",
                onClick = onDismiss,
                isEnabled = !isSubmitting,
                modifier = Modifier.fillMaxWidth().testTag("chatReportCancel"),
            )
        }
    }
}

@Composable
private fun DetailsTopicRow(topic: ChatConversationTopic) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s1, vertical = Spacing.s2)
                .testTag("chatDetailsTopic_${topic.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = topicIcon(topic.topicType),
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary600,
        )
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = topic.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            topic.status?.takeIf { it.isNotBlank() }?.let { status ->
                Text(
                    text = status.replaceFirstChar { it.uppercase() },
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }
    }
}

// MARK: - Emoji picker

/** Curated quick-picker set for the composer (8 columns × 8 rows). */
private val CHAT_COMPOSER_EMOJI =
    listOf(
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
        "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😎",
        "🤩", "🥳", "😏", "😴", "🤔", "🤨", "😬", "🙄",
        "😢", "😭", "😤", "😡", "🤯", "😱", "🥺", "😳",
        "👍", "👎", "👏", "🙏", "🤝", "💪", "✌️", "🤞",
        "👋", "🙌", "👐", "🤲", "🤜", "🤛", "✊", "👊",
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💕",
        "🎉", "🎊", "🔥", "✨", "⭐", "💯", "✅", "🙈",
    )

/**
 * Compact emoji grid for the composer's emoji button. Picking appends to
 * the composer text and keeps the sheet open for multi-pick.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatEmojiPickerSheet(
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(8),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(330.dp)
                    .padding(horizontal = Spacing.s3)
                    .padding(bottom = Spacing.s4)
                    .testTag("chatEmojiPicker"),
        ) {
            items(CHAT_COMPOSER_EMOJI.size) { index ->
                val emoji = CHAT_COMPOSER_EMOJI[index]
                Box(
                    modifier =
                        Modifier
                            .height(38.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable { onPick(emoji) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = emoji, fontSize = 22.sp)
                }
            }
        }
    }
}

/**
 * Design `.reaction` — floating white pills that overlap the bubble's
 * bottom corner. Positioned by the caller via [modifier] (BottomStart for
 * outgoing / BottomEnd for incoming, ~10dp below the bubble edge).
 */
@Composable
private fun ReactionRow(
    reactions: List<ChatBubbleReaction>,
    onReact: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.testTag("chatReactions"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        reactions.forEach { reaction ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                modifier =
                    Modifier
                        .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.pill), clip = false)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (reaction.reactedByMe) PantopusColors.primary50 else PantopusColors.appSurface)
                        .border(
                            1.dp,
                            if (reaction.reactedByMe) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onReact(reaction.reaction) }
                        .padding(horizontal = 6.dp, vertical = 1.dp),
            ) {
                Text(text = reaction.reaction, fontSize = 11.sp)
                Text(
                    text = reaction.count.toString(),
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (reaction.reactedByMe) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun LockedPaywallOverlay(
    tier: String,
    contentId: String,
    onLockedAction: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .background(
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                PantopusColors.appSurface.copy(alpha = 0.15f),
                                PantopusColors.appSurface.copy(alpha = 0.96f),
                            ),
                    ),
                )
                .testTag("chatPaywallOverlay_$contentId"),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Row(
            modifier =
                Modifier
                    .padding(horizontal = 10.dp, vertical = 5.dp)
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .clickable(onClick = onLockedAction)
                    .padding(horizontal = 10.dp)
                    .testTag("chatLockedUpgrade_$contentId"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = Radii.lg, tint = PantopusColors.primary600)
            Text(
                text = "Upgrade to read",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
            Text(
                text = tier,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PaidSupportFooter(
    tier: String,
    contentId: String,
) {
    Row(
        modifier =
            Modifier
                .padding(top = Spacing.s1)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .padding(horizontal = 9.dp, vertical = Spacing.s1)
                .testTag("chatPaidSupportFooter_$contentId"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Crown, contentDescription = null, size = 10.dp, tint = PantopusColors.warning)
        Text(
            text = "Sent with $tier support",
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.warning,
        )
    }
}

@Composable
private fun MiniAvatar(
    initials: String,
    hidden: Boolean,
) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(if (hidden) Color.Transparent else PantopusColors.primary600),
        contentAlignment = Alignment.Center,
    ) {
        if (!hidden) {
            Text(
                text = initials,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun PhotoBubble(
    url: String?,
    isOut: Boolean,
    hasTail: Boolean,
    isContinuation: Boolean = false,
    lockedTier: String? = null,
    onLockedAction: () -> Unit = {},
    contentId: String = "",
) {
    val shape =
        RoundedCornerShape(
            topStart = if (!isOut && isContinuation) Radii.sm else 18.dp,
            topEnd = if (isOut && isContinuation) Radii.sm else 18.dp,
            bottomEnd = if (isOut && hasTail) Radii.sm else 18.dp,
            bottomStart = if (!isOut && hasTail) Radii.sm else 18.dp,
        )
    Box(
        modifier =
            Modifier
                .size(200.dp, 130.dp)
                .clip(shape)
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, if (isOut) Color.Transparent else PantopusColors.appBorder, shape)
                .testTag("chatPhotoBubble"),
    ) {
        if (url != null) {
            AsyncImage(
                model = url,
                contentDescription = "Photo attachment",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            PhotoPlaceholder(modifier = Modifier.fillMaxSize())
        }
        if (lockedTier != null) {
            LockedPaywallOverlay(
                tier = lockedTier,
                contentId = contentId,
                onLockedAction = onLockedAction,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
private fun PhotoPlaceholder(modifier: Modifier = Modifier) {
    Box(modifier = modifier.background(PantopusColors.appSurfaceSunken)) {
        Row(
            modifier = Modifier.fillMaxSize().padding(start = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            repeat(6) { index ->
                Box(
                    modifier =
                        Modifier
                            .size(width = 18.dp, height = 150.dp)
                            .clip(RoundedCornerShape(Radii.xs))
                            .background(
                                if (index % 2 == 0) {
                                    PantopusColors.appBorder
                                } else {
                                    PantopusColors.appBorderStrong
                                },
                            ),
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 10.dp, bottom = Spacing.s2)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface.copy(alpha = 0.72f))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
        ) {
            Text(
                text = "Photo",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun AiReplyBubble(
    body: ChatBubbleBody.AiReply,
    hasTail: Boolean,
    onUseDraft: (ChatAIDraftCard) -> Unit,
) {
    val shape =
        RoundedCornerShape(
            topStart = 18.dp,
            topEnd = 18.dp,
            bottomEnd = 18.dp,
            bottomStart = if (hasTail) Radii.sm else 18.dp,
        )
    val isThinking = body.text.isEmpty() && body.estimate == null && body.drafts.isEmpty()
    Column(
        modifier =
            Modifier
                .widthIn(max = 300.dp)
                .shadow(elevation = 1.dp, shape = shape, clip = false)
                .clip(shape)
                // A15.3 `.bubble.in.ai` — white incoming bubble with hairline border.
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(horizontal = Spacing.s3, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (isThinking) {
            // A15.3 `.thinking` — streaming has produced no text yet.
            AiThinkingRow()
        } else {
            AiTag()
            Text(text = body.text, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appText)
            body.estimate?.let { AiEstimateCard(estimate = it, modifier = Modifier.fillMaxWidth()) }
            body.drafts.forEach { draft ->
                AiDraftCard(draft = draft, onUse = onUseDraft)
            }
        }
    }
}

/** Pulsing sparkles + muted "Thinking…" shown while the AI stream has no text yet. */
@Composable
private fun AiThinkingRow() {
    val transition = rememberInfiniteTransition(label = "aiThinking")
    val sparkAlpha by transition.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 800),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "aiThinkingSpark",
    )
    Row(
        modifier = Modifier.testTag("chatAiThinking"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary600,
            modifier = Modifier.alpha(sparkAlpha),
        )
        Text(
            text = "Thinking…",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun AiDraftCard(
    draft: ChatAIDraftCard,
    onUse: (ChatAIDraftCard) -> Unit,
) {
    val accent =
        when (draft.type) {
            "listing" -> PantopusColors.success
            "mail_summary" -> PantopusColors.warning
            else -> PantopusColors.magic
        }
    val background =
        when (draft.type) {
            "listing" -> PantopusColors.successBg
            "mail_summary" -> PantopusColors.warningBg
            else -> PantopusColors.magicBg
        }
    val icon =
        when (draft.type) {
            "gig" -> PantopusIcon.Hammer
            "listing" -> PantopusIcon.Tag
            "post" -> PantopusIcon.Pencil
            "mail_summary" -> PantopusIcon.Mailbox
            else -> PantopusIcon.Sparkles
        }
    val label =
        when (draft.type) {
            "gig" -> "Task Draft"
            "listing" -> "Listing Draft"
            "post" -> "Post Draft"
            "mail_summary" -> "Mail Summary"
            else -> "Draft"
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, accent.copy(alpha = 0.22f), RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("chatAIDraft_${draft.type}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = accent,
                modifier =
                    Modifier
                        .size(26.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(background)
                        .padding(6.dp),
            )
            Text(text = label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = accent)
            Spacer(modifier = Modifier.weight(1f))
            if (draft.valid) {
                Text(text = "Draft ready", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.success)
            }
        }
        Text(text = draft.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText, maxLines = 2)
        if (!draft.summary.isNullOrBlank() && draft.summary != draft.title) {
            Text(
                text = draft.summary,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        draft.priceLabel?.let {
            Text(text = it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = accent)
        }
        if (draft.type != "mail_summary") {
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 34.dp)
                        .clickable { onUse(draft) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(text = draftActionTitle(draft.type), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = accent)
                PantopusIconImage(icon = PantopusIcon.ArrowRight, contentDescription = null, size = 11.dp, tint = accent)
            }
        }
    }
}

private fun draftActionTitle(type: String): String =
    when (type) {
        "gig" -> "Use in task composer"
        "listing" -> "Use in listing composer"
        "post" -> "Use in Pulse composer"
        else -> "Use draft"
    }

/** A15.3 `.ai-tag` — sparkles + "PANTOPUS AI" pill at the top of AI reply bubbles. */
@Composable
private fun AiTag() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = 6.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 9.dp, tint = PantopusColors.primary600)
        Text(
            text = "PANTOPUS AI",
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun SystemLinkPill(body: ChatBubbleBody.SystemLink) {
    val fg =
        when (body.accent) {
            ChatSystemLinkAccent.Primary -> PantopusColors.primary600
            ChatSystemLinkAccent.Success -> PantopusColors.success
            ChatSystemLinkAccent.Warning -> PantopusColors.warning
            ChatSystemLinkAccent.Error -> PantopusColors.error
        }
    val bg =
        when (body.accent) {
            ChatSystemLinkAccent.Primary -> PantopusColors.primary50
            ChatSystemLinkAccent.Success -> PantopusColors.successBg
            ChatSystemLinkAccent.Warning -> PantopusColors.warningBg
            ChatSystemLinkAccent.Error -> PantopusColors.errorBg
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(1.dp, fg.copy(alpha = 0.2f), RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(fg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Info,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextInverse,
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            modifier = Modifier.weight(1f),
        ) {
            Text(
                text = body.label,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = body.sub,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                color = fg,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 13.dp, tint = fg)
    }
}

@Composable
private fun StampRow(
    content: ChatBubbleContent,
    onRetry: () -> Unit,
) {
    val stamp = content.stamp ?: return
    val raw =
        when (content.deliveryState) {
            ChatDeliveryState.Read -> "Read $stamp"
            // Delivered is conveyed by the small check icon, not a loud word (RN).
            ChatDeliveryState.Delivered -> stamp
            ChatDeliveryState.Sending -> "Sending..."
            ChatDeliveryState.Failed -> "Failed to send"
            null -> stamp
        }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 2.dp, bottom = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement =
            if (content.side == ChatMessageSide.Outgoing) Arrangement.End else Arrangement.Start,
    ) {
        if (content.side == ChatMessageSide.Outgoing && content.deliveryState == ChatDeliveryState.Read) {
            ReadReceipt(timestamp = stamp)
        } else {
            Text(
                text = raw,
                fontSize = 10.sp,
                fontWeight = FontWeight.Normal,
                color = PantopusColors.appTextMuted,
            )
        }
        if (content.side == ChatMessageSide.Outgoing && content.deliveryState != ChatDeliveryState.Read) {
            when (content.deliveryState) {
                ChatDeliveryState.Read -> Unit
                ChatDeliveryState.Delivered ->
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 10.dp,
                        tint = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(start = Spacing.s1),
                    )
                ChatDeliveryState.Sending ->
                    CircularProgressIndicator(
                        modifier = Modifier.padding(start = Spacing.s1).size(10.dp),
                        strokeWidth = 1.5.dp,
                        color = PantopusColors.appTextSecondary,
                    )
                ChatDeliveryState.Failed ->
                    Row(
                        modifier =
                            Modifier
                                .padding(start = 6.dp)
                                .clickable(onClick = onRetry)
                                .testTag("chatRetry_${content.id}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.AlertCircle,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.error,
                        )
                        Text(
                            text = "Retry",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Normal,
                            textDecoration = TextDecoration.Underline,
                            color = PantopusColors.error,
                        )
                    }
                null -> Unit
            }
        }
    }
}

@Composable
private fun ReadReceipt(timestamp: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Read $timestamp",
            fontSize = 10.sp,
            fontWeight = FontWeight.Normal,
            color = PantopusColors.appTextMuted,
        )
        PantopusIconImage(
            icon = PantopusIcon.CheckCheck,
            contentDescription = null,
            // 12dp double-check in primary-500, per `.ts.out svg`.
            size = Radii.lg,
            strokeWidth = 2.5f,
            tint = PantopusColors.primary500,
        )
    }
}

@Composable
internal fun TypingIndicator(initials: String) {
    val transition = rememberInfiniteTransition(label = "typingDots")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, top = Spacing.s2, end = 14.dp, bottom = 6.dp)
                .testTag("chatTypingIndicator"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        MiniAvatar(initials = initials, hidden = false)
        Row(
            modifier =
                Modifier
                    .clip(
                        RoundedCornerShape(
                            topStart = Radii.xl,
                            topEnd = Radii.xl,
                            bottomEnd = Radii.xl,
                            bottomStart = Radii.xs,
                        ),
                    )
                    .background(PantopusColors.appSurfaceSunken)
                    .border(
                        1.dp,
                        PantopusColors.appBorder,
                        RoundedCornerShape(
                            topStart = Radii.xl,
                            topEnd = Radii.xl,
                            bottomEnd = Radii.xl,
                            bottomStart = Radii.xs,
                        ),
                    )
                    .padding(horizontal = Spacing.s3, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            repeat(3) { index ->
                val opacity by transition.animateFloat(
                    initialValue = 0.3f,
                    targetValue = 1f,
                    animationSpec =
                        infiniteRepeatable(
                            animation = tween(durationMillis = 600),
                            repeatMode = RepeatMode.Reverse,
                            initialStartOffset =
                                StartOffset(
                                    offsetMillis = index * 180,
                                    offsetType = StartOffsetType.Delay,
                                ),
                        ),
                    label = "typingDot$index",
                )
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appTextSecondary.copy(alpha = opacity)),
                )
            }
        }
        Spacer(modifier = Modifier.weight(1f))
    }
}

@Composable
internal fun Composer(
    text: String,
    placeholder: String,
    canSend: Boolean,
    showsSendCost: Boolean = false,
    isLockedAction: Boolean = false,
    // A15.3: while the AI stream is in flight the send disc becomes a
    // stop button that cancels the stream.
    isAiStreaming: Boolean = false,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    onAttach: () -> Unit = {},
    onEmoji: () -> Unit = {},
    onStopAiStream: () -> Unit = {},
) {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = Spacing.s2, bottom = Spacing.s4),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onAttach)
                        .testTag("chatComposerAttach"),
                contentAlignment = Alignment.Center,
            ) {
                // Design `.composer .plus` — 36dp sunken disc, 19dp plus.
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Plus,
                        contentDescription = "Attach",
                        size = 19.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextStrong,
                    )
                }
            }
            // Design `.composer .input` — sunken pill with the smile glyph
            // docked at its right edge.
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 36.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(18.dp))
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    if (text.isEmpty()) {
                        Text(
                            text = placeholder,
                            fontSize = 13.5.sp,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    BasicTextField(
                        value = text,
                        onValueChange = onTextChange,
                        textStyle =
                            TextStyle(
                                fontSize = 13.5.sp,
                                color = PantopusColors.appText,
                            ),
                        cursorBrush = SolidColor(PantopusColors.primary600),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = { if (canSend) onSend() }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                PantopusIconImage(
                    icon = PantopusIcon.Smile,
                    contentDescription = "Emoji",
                    size = 17.dp,
                    tint = PantopusColors.appTextMuted,
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .clickable(onClick = onEmoji)
                            .testTag("chatComposerEmoji"),
                )
            }
            if (isAiStreaming) {
                // A15.3 `.composer .stop` — white disc, error border, filled square.
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .clickable(onClick = onStopAiStream)
                            .testTag("chatComposerStop"),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.appSurface)
                                .border(1.5.dp, PantopusColors.error, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(Radii.lg)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(PantopusColors.error)
                                    .semantics { contentDescription = "Stop generating" },
                        )
                    }
                }
            } else {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .clickable(enabled = canSend, onClick = onSend)
                            .testTag("chatComposerSend"),
                    contentAlignment = Alignment.Center,
                ) {
                    // Design `.composer .send` — 36dp primary disc, arrow-up,
                    // soft primary shadow.
                    Box(
                        modifier =
                            Modifier
                                .then(
                                    if (canSend && !isLockedAction) {
                                        Modifier.shadow(
                                            elevation = 6.dp,
                                            shape = CircleShape,
                                            ambientColor = PantopusColors.primary600,
                                            spotColor = PantopusColors.primary600,
                                        )
                                    } else {
                                        Modifier
                                    },
                                )
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(sendBackground(canSend = canSend, isLockedAction = isLockedAction)),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = if (isLockedAction) PantopusIcon.Lock else PantopusIcon.ArrowUp,
                            contentDescription = "Send",
                            size = 18.dp,
                            strokeWidth = 2.5f,
                            tint = if (canSend) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                        )
                    }
                    if (showsSendCost && canSend) {
                        Box(
                            modifier =
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .clip(RoundedCornerShape(Radii.pill))
                                    .background(PantopusColors.appSurface)
                                    .border(1.dp, PantopusColors.primary600, RoundedCornerShape(Radii.pill))
                                    .padding(horizontal = 5.dp, vertical = 1.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "-1",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = PantopusColors.primary700,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun AttachmentStripView(
    attachments: List<ChatQueuedAttachment>,
    onRemove: (String) -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).testTag("chatAttachmentStrip")) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(start = Spacing.s3, end = Spacing.s3, top = 10.dp, bottom = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            attachments.forEach { attachment ->
                AttachmentTile(attachment = attachment, onRemove = onRemove)
            }
        }
    }
}

@Composable
private fun AttachmentTile(
    attachment: ChatQueuedAttachment,
    onRemove: (String) -> Unit,
) {
    Box(modifier = Modifier.size(64.dp)) {
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
            contentAlignment = Alignment.Center,
        ) {
            when (attachment.kind) {
                ChatQueuedAttachmentKind.Image -> PhotoPlaceholder(modifier = Modifier.fillMaxSize())
                ChatQueuedAttachmentKind.Document ->
                    Column(
                        modifier = Modifier.fillMaxSize().background(PantopusColors.appSurface),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.FileText,
                            contentDescription = null,
                            size = 22.dp,
                            tint = PantopusColors.primary600,
                        )
                        Text(
                            text = attachment.filename,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextStrong,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .size(44.dp)
                    .clickable { onRemove(attachment.id) }
                    .testTag("chatAttachmentRemove_${attachment.id}"),
            contentAlignment = Alignment.TopEnd,
        ) {
            Box(
                modifier =
                    Modifier
                        .padding(top = 3.dp, end = 3.dp)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appText.copy(alpha = 0.78f)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Remove ${attachment.filename}",
                    size = 11.dp,
                    strokeWidth = 3f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

private fun sendBackground(
    canSend: Boolean,
    isLockedAction: Boolean,
): Color =
    when {
        !canSend -> PantopusColors.appSurfaceSunken
        isLockedAction -> PantopusColors.warning
        else -> PantopusColors.primary600
    }

@Composable
internal fun FanTierUpgradePromptSheet(entitlement: ChatFanEntitlement) {
    val targetTier = entitlement.requiredReplyTier ?: "Silver"
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s5, end = Spacing.s5, top = Spacing.s3, bottom = Spacing.s6)
                .testTag("chatFanUpgradePromptSheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = Radii.xl2, tint = PantopusColors.primary600)
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
                Text(
                    text = "Upgrade to $targetTier",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = "Your ${entitlement.currentTier} support does not unlock this reply yet.",
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            FanUpgradeBenefit(icon = PantopusIcon.MessageSquare, title = "Read tier-locked replies")
            FanUpgradeBenefit(icon = PantopusIcon.ArrowUpRight, title = "Reply without the current tier gate")
            FanUpgradeBenefit(icon = PantopusIcon.Crown, title = "Keep supporting this creator")
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable {}
                    .testTag("chatFanUpgradeConfirm"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Upgrade membership",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun FanUpgradeBenefit(
    icon: PantopusIcon,
    title: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            modifier = Modifier.size(28.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
        }
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s6)
                .testTag("chatConversationError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "Couldn't load this conversation",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(text = message, fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
        Spacer(modifier = Modifier.size(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
