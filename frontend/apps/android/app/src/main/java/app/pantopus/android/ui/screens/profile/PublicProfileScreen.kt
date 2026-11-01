@file:Suppress("LongMethod", "MagicNumber", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.ui.components.BeaconIdentity
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.InviteLinks
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastAppearance
import app.pantopus.android.ui.components.rememberShareTextWithCompletion
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.components.toastDurationMillis
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileTab
import app.pantopus.android.ui.screens.shared.content_detail.bodies.StatsTabsBody
import app.pantopus.android.ui.screens.transaction_reviews.ReceivedTransactionReviewsSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * Public profile detail screen. ViewModel reads the user id via the
 * nav-backstack [androidx.lifecycle.SavedStateHandle].
 *
 * P6.5 — The view-model picks the profile kind (Persona vs Local) from
 * the loaded DTO. The screen swaps banner color, header chips, sticky
 * footer CTAs (Follow vs Message + Connect), and post styling
 * accordingly.
 *
 * `onOpenMessages` is invoked with the loaded `PublicProfileDto` so the
 * host nav stack can construct a chat-conversation destination with the
 * profile's user as counterparty. The Report flow is presented as a
 * [ReportUserSheet] hosted locally here, not via the nav graph (per P6.2).
 */
@Suppress("CyclomaticComplexMethod")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicProfileScreen(
    onBack: () -> Unit,
    onOpenMessages: (app.pantopus.android.data.api.models.profile.PublicProfileDto) -> Unit = {},
    onOpenHandshake: (String, Int?) -> Unit = { _, _ -> },
    onOpenInsights: () -> Unit = {},
    onEditPersona: () -> Unit = {},
    onComposeBroadcast: () -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    /** Opens a post from the Posts tab, as a tap on a Pulse card does. */
    onOpenPost: (String) -> Unit = {},
    /** Your own profile's Edit profile. */
    onEditProfile: () -> Unit = {},
    /** "You and …": a plan you're both in, a Support Train you both help on. */
    onOpenPlan: (String) -> Unit = {},
    onOpenSupportTrain: (String) -> Unit = {},
    /** ☰ → Your profile: your page as a cover with ✕ (pushed from your own name, it keeps Back). */
    ownerCover: Boolean = false,
    /** Where your own page's rows and buttons go (PRF step 2). */
    ownerNavigation: OwnerNavigation = OwnerNavigation(),
    /** The `monthly_receipt` push (`?tab=receipt`): last month opens in full. */
    expandMonthlyReceipt: Boolean = false,
    viewModel: PublicProfileViewModel = hiltViewModel(),
    usernameShare: UsernameShareViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    val inCommon by viewModel.inCommon.state.collectAsStateWithLifecycle()
    val pinnedPosts by viewModel.pins.state.collectAsStateWithLifecycle()
    val pinnedCards = remember(pinnedPosts) { pinnedPosts?.map(::pinnedCard) }
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val usernameShareForm by usernameShare.form.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val selectedLocalTab by viewModel.selectedLocalTab.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val showOverflow by viewModel.showOverflow.collectAsStateWithLifecycle()
    val connectState by viewModel.connectState.collectAsStateWithLifecycle()
    val connection by viewModel.connection.collectAsStateWithLifecycle()
    val isBlockedByViewer by viewModel.isBlockedByViewer.collectAsStateWithLifecycle()
    val showDisconnectConfirm by viewModel.showDisconnectConfirm.collectAsStateWithLifecycle()
    val showHandshake by viewModel.showFollowHandshake.collectAsStateWithLifecycle()
    val handshakeTier by viewModel.handshakePreselectedTierRank.collectAsStateWithLifecycle()
    val isFollowing by viewModel.isFollowing.collectAsStateWithLifecycle()
    val isFollowInFlight by viewModel.isFollowInFlight.collectAsStateWithLifecycle()
    val canFollow by viewModel.canFollow.collectAsStateWithLifecycle()
    val relationshipLoaded by viewModel.relationshipLoaded.collectAsStateWithLifecycle()
    val relationshipFailed by viewModel.relationshipFailed.collectAsStateWithLifecycle()
    val postsLoadFailed by viewModel.postsLoadFailed.collectAsStateWithLifecycle()
    val postCards by viewModel.postCards.cards.collectAsStateWithLifecycle()
    val postOptionsId by viewModel.postCards.optionsPostId.collectAsStateWithLifecycle()
    val reportingPostId by viewModel.postCards.reportingPostId.collectAsStateWithLifecycle()
    val showUnfollowConfirm by viewModel.showUnfollowConfirm.collectAsStateWithLifecycle()
    val showConnectSheet by viewModel.showConnectSheet.collectAsStateWithLifecycle()
    val showWithdrawConfirm by viewModel.showWithdrawConfirm.collectAsStateWithLifecycle()
    val postsLoading by viewModel.postsLoading.collectAsStateWithLifecycle()
    val ownerExtras by viewModel.owner.extras.collectAsStateWithLifecycle()
    val preview by viewModel.preview.state.collectAsStateWithLifecycle()
    var showPreviewSheet by rememberSaveable { mutableStateOf(false) }
    var showReceipt by rememberSaveable { mutableStateOf(false) }
    var showInvite by rememberSaveable { mutableStateOf(false) }
    var receiptOpened by rememberSaveable { mutableStateOf(false) }
    var showLogOutConfirm by rememberSaveable { mutableStateOf(false) }
    var showTrustExplainer by remember { mutableStateOf(false) }
    val uriHandler = LocalUriHandler.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val shareTextWithCompletion = rememberShareTextWithCompletion()
    val postCardActions =
        remember(viewModel, onOpenPost) {
            ProfilePostCardActions(
                onOpen = onOpenPost,
                onReact = viewModel.postCards::tapReaction,
                onOptions = viewModel.postCards::openOptions,
                onToggleSave = viewModel.postCards::toggleSave,
                onToggleRepost = viewModel.postCards::toggleRepost,
            )
        }
    val sheetState = rememberModalBottomSheetState()
    val reportSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showReportSheet by remember { mutableStateOf(false) }
    var showBlockConfirm by remember { mutableStateOf(false) }
    var showUnblockConfirm by remember { mutableStateOf(false) }
    val context = LocalContext.current

    LaunchedEffect(showHandshake) {
        if (showHandshake) {
            val handle = viewModel.loadedPersonaHandle()
            if (handle.isNotBlank()) {
                onOpenHandshake(handle, handshakeTier)
                viewModel.setShowFollowHandshake(false)
                viewModel.clearHandshakeTier()
            }
        }
    }
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        onPauseOrDispose { }
    }
    RefreshOnStoreChange(viewModel::load)
    // The `monthly_receipt` push opens last month in full, once its receipt has loaded.
    LaunchedEffect(expandMonthlyReceipt, ownerExtras?.receipt) {
        if (expandMonthlyReceipt && !receiptOpened && ownerExtras?.receipt != null) {
            receiptOpened = true
            showReceipt = true
        }
    }
    // A preview ends with Done or Back, never by leaving the page.
    BackHandler(enabled = preview != null) { viewModel.endPreview() }
    // Your own link on a made-up username offers to pick one first, once (as the ⋯ menu's Share does).
    val shareOwnProfile: (PublicProfileContent) -> Unit = { loaded ->
        if (usernameShare.shouldAsk(loaded.profile.id, loaded.profile.chosenUsername == null)) {
            usernameShare.open(loaded.profile.id, loaded.profile.username)
        } else {
            profileShareUrl(state)?.let { context.shareText(it) }
        }
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(toastDurationMillis(toast.orEmpty(), minimumMillis = 2_000))
            viewModel.dismissToast()
        }
    }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = viewModel::refresh,
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("publicProfile"),
    ) {
        Column(Modifier.fillMaxSize()) {
            refreshNotice?.let { RefreshFailedLine(it, Modifier.padding(horizontal = Spacing.s4)) }
            Box(Modifier.weight(1f)) {
                when (val s = state) {
                    PublicProfileUiState.Loading -> LoadingLayout(onBack = onBack)
                    is PublicProfileUiState.Error -> ErrorLayout(message = s.message, onRetry = { viewModel.refresh() }, onBack = onBack)
                    is PublicProfileUiState.Loaded -> {
                        val content = s.content
                        val neighbor = content.neighbor
                        val currentPreview = preview
                        if (currentPreview != null && content.isOwner) {
                            OwnerPreviewFrame(
                                preview = currentPreview,
                                onDone = viewModel::endPreview,
                                onRetry = { viewModel.startPreview(currentPreview.audience) },
                                onOpenGig = onOpenGig,
                                onOpenProfile = onOpenProfile,
                                onOpenLink = { url -> runCatching { uriHandler.openUri(url) } },
                            )
                        } else if (content.kind == PublicProfileKind.Local && neighbor != null) {
                            LocalProfileLoadedFrame(
                                content = content,
                                selectedTab = selectedLocalTab,
                                actions =
                                    ProfileActionsState(
                                        isOwner = content.isOwner,
                                        connection = connection,
                                        showsConnection = canFollow && relationshipLoaded,
                                        inFlight = connectState is PublicProfileActionState.InFlight,
                                        relationshipPending = !content.isOwner && !relationshipLoaded && !relationshipFailed,
                                    ),
                                callbacks =
                                    ProfileActionCallbacks(
                                        onConnect = viewModel::openConnectSheet,
                                        onWithdraw = viewModel::requestWithdraw,
                                        onAccept = { viewModel.connect() },
                                        onDecline = viewModel::declineRequest,
                                        onDisconnect = viewModel::requestDisconnect,
                                        onMessage = { onOpenMessages(content.profile) },
                                        onEditProfile = onEditProfile,
                                    ),
                                onBack = onBack,
                                onSelectTab = { viewModel.selectLocalTab(it) },
                                onOverflow = { viewModel.setShowOverflow(true) },
                                onTrustClick = { showTrustExplainer = true },
                                hiddenByBlock = connection == ProfileConnection.Blocked,
                                onOpenGig = onOpenGig,
                                onOpenProfile = onOpenProfile,
                                onOpenLink = { url -> runCatching { uriHandler.openUri(url) } },
                                postsLoadFailed = postsLoadFailed,
                                postsLoading = postsLoading,
                                onRetryPosts = { viewModel.refresh() },
                                postCards = postCards,
                                postCardActions = postCardActions,
                                // Nothing shared shows on your own page or across a block.
                                inCommon = inCommon.takeIf { !content.isOwner && connection != ProfileConnection.Blocked },
                                pinned = pinnedCards.takeIf { connection != ProfileConnection.Blocked },
                                onOpenInCommon = { target ->
                                    when (target) {
                                        is InCommonTarget.Plan -> onOpenPlan(target.id)
                                        is InCommonTarget.SupportTrain -> onOpenSupportTrain(target.id)
                                    }
                                },
                                mode =
                                    if (content.isOwner) {
                                        ProfileFrameMode.Owner(
                                            extras = ownerExtras,
                                            cover = ownerCover,
                                            navigation = ownerNavigation,
                                            actions =
                                                OwnerPageActions(
                                                    onShare = { shareOwnProfile(content) },
                                                    onPreviewAs = { showPreviewSheet = true },
                                                    onDismissTip = viewModel.owner::dismissTip,
                                                    onOpenMonth = { showReceipt = true },
                                                    onShareMonth = { viewModel.owner.receiptShareMessage()?.let { context.shareText(it) } },
                                                    onOpenInvite = {
                                                        if (ownerExtras?.invite != null) {
                                                            showInvite = true
                                                        } else {
                                                            viewModel.owner.inviteShareMessage()?.let { context.shareText(it) }
                                                        }
                                                    },
                                                    onLogOut = { showLogOutConfirm = true },
                                                ),
                                        )
                                    } else {
                                        ProfileFrameMode.Visitor
                                    },
                            )
                        } else {
                            PublicProfileLoadedFrame(
                                content = content,
                                selectedTab = selectedTab,
                                connectState = connectState,
                                onBack = onBack,
                                onSelectTab = { viewModel.selectTab(it) },
                                follow =
                                    ProfileFollowState(
                                        canFollow = canFollow,
                                        isFollowing = isFollowing,
                                        isInFlight = isFollowInFlight,
                                        relationshipLoaded = relationshipLoaded,
                                    ),
                                connection = connection,
                                onFollow = { viewModel.follow() },
                                onMessage = { onOpenMessages(content.profile) },
                                onConnect = { viewModel.connect() },
                                onOverflow = { viewModel.setShowOverflow(true) },
                                onUnlock = { post -> viewModel.unlockBroadcast(post.targetTierRank) },
                                onOpenInsights = onOpenInsights,
                                onEditPersona = onEditPersona,
                                onComposeBroadcast = onComposeBroadcast,
                                profileUserId = content.profile.id,
                                onOpenGig = onOpenGig,
                                onOpenProfile = onOpenProfile,
                                receivedReviews = {
                                    // Launch cut #3 (Marketplace): no "Marketplace reviews" section.
                                    if (LaunchFeatures.marketplace) {
                                        ReceivedTransactionReviewsSection(userId = content.profile.id)
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
        toast?.let { message ->
            Toast(
                text = message,
                appearance =
                    ToastAppearance(
                        background = PantopusColors.appText.copy(alpha = 0.9f),
                        foreground = PantopusColors.appTextInverse,
                        textStyle = PantopusTextStyle.small,
                    ),
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp),
            )
        }
        if (showOverflow) {
            ModalBottomSheet(
                onDismissRequest = { viewModel.setShowOverflow(false) },
                sheetState = sheetState,
            ) {
                val loaded = (state as? PublicProfileUiState.Loaded)?.content
                val canOfferFollow = canFollow && relationshipLoaded && !isBlockedByViewer
                OverflowSheetContent(
                    // The header's "Share profile" opens this sheet, so it shares first.
                    shareUrl = profileShareUrl(state),
                    isOwnProfile = loaded?.isOwner == true,
                    isBlockedByViewer = isBlockedByViewer,
                    // Follow lives here and in the Connect sheet now (no separate Follow row). A failed relationship
                    // read offers neither, rather than guessing.
                    follow =
                        loaded
                            ?.takeIf { it.kind == PublicProfileKind.Local && canOfferFollow }
                            ?.let { OverflowFollow(profileFirstName(it.header), isFollowing, enabled = !isFollowInFlight) },
                    onFollow = {
                        viewModel.setShowOverflow(false)
                        if (isFollowing) viewModel.requestUnfollow() else viewModel.follow()
                    },
                    onShare = { url ->
                        viewModel.setShowOverflow(false)
                        // Your own link still on a made-up username: offer to pick one first, once.
                        val madeUp = loaded?.profile?.chosenUsername == null
                        if (loaded != null && loaded.isOwner && usernameShare.shouldAsk(loaded.profile.id, madeUp)) {
                            usernameShare.open(loaded.profile.id, loaded.profile.username)
                        } else {
                            context.shareText(url)
                        }
                    },
                    onBlock = {
                        viewModel.setShowOverflow(false)
                        showBlockConfirm = true
                    },
                    onUnblock = {
                        viewModel.setShowOverflow(false)
                        showUnblockConfirm = true
                    },
                    onReport = {
                        viewModel.setShowOverflow(false)
                        showReportSheet = true
                    },
                    onCancel = { viewModel.setShowOverflow(false) },
                )
            }
        }
        usernameShareForm?.let { form ->
            UsernameShareSheet(
                model = usernameShare,
                form = form,
                onShareAsIs = {
                    usernameShare.close()
                    profileShareUrl(state)?.let { context.shareText(it) }
                },
                onSaved = { username ->
                    viewModel.refresh()
                    context.shareText(InviteLinks.profileUrl(username))
                },
            )
        }
        if (showReportSheet) {
            val loaded = state as? PublicProfileUiState.Loaded
            if (loaded != null) {
                ReportUserSheet(
                    userId = loaded.content.profile.id,
                    handle = loaded.content.header.handle,
                    displayName = loaded.content.header.displayName,
                    sheetState = reportSheetState,
                    onDismiss = { showReportSheet = false },
                    onSubmitted = {
                        showReportSheet = false
                        viewModel.showToast("Report received")
                    },
                )
            }
        }
        // Blocking from a chat asks first (`ChatConversationScreen`), so the
        // profile does too before it sends `POST api/users/:id/block`.
        if (showBlockConfirm) {
            val name = (state as? PublicProfileUiState.Loaded)?.content?.header?.displayName?.trim().orEmpty()
            AlertDialog(
                onDismissRequest = { showBlockConfirm = false },
                title = { Text(if (name.isEmpty()) "Block this user?" else "Block $name?") },
                text = { Text("You won't be able to message each other or see each other's posts. You can unblock them later.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showBlockConfirm = false
                            viewModel.block()
                        },
                        modifier = Modifier.testTag("publicProfileBlockConfirm"),
                    ) {
                        Text("Block", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { showBlockConfirm = false },
                        modifier = Modifier.testTag("publicProfileBlockCancel"),
                    ) {
                        Text("Cancel")
                    }
                },
            )
        }
        if (showUnblockConfirm) {
            val name = (state as? PublicProfileUiState.Loaded)?.content?.header?.displayName?.trim().orEmpty()
            AlertDialog(
                onDismissRequest = { showUnblockConfirm = false },
                title = { Text(if (name.isEmpty()) "Unblock this user?" else "Unblock $name?") },
                text = { Text("You'll be able to see each other's posts and message each other again. They aren't notified.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showUnblockConfirm = false
                            viewModel.unblock()
                        },
                        modifier = Modifier.testTag("publicProfileUnblockConfirm"),
                    ) {
                        Text("Unblock")
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { showUnblockConfirm = false },
                        modifier = Modifier.testTag("publicProfileUnblockCancel"),
                    ) {
                        Text("Cancel")
                    }
                },
            )
        }
        // A stray tap on Following never unfollows: it asks first, as Connected does.
        if (showUnfollowConfirm) {
            val name = (state as? PublicProfileUiState.Loaded)?.content?.header?.displayName?.trim().orEmpty()
            AlertDialog(
                onDismissRequest = { viewModel.cancelUnfollow() },
                title = { Text(if (name.isEmpty()) "Unfollow this person?" else "Unfollow $name?") },
                text = { Text("They won't be notified.") },
                confirmButton = {
                    TextButton(
                        onClick = { viewModel.unfollow() },
                        modifier = Modifier.testTag("publicProfileUnfollowConfirm"),
                    ) {
                        Text("Unfollow", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { viewModel.cancelUnfollow() },
                        modifier = Modifier.testTag("publicProfileUnfollowCancel"),
                    ) {
                        Text("Cancel")
                    }
                },
            )
        }
        postOptionsId?.let { id ->
            postCards.firstOrNull { it.id == id }?.let { card ->
                ProfilePostOptionsSheet(
                    card = card,
                    onShare = {
                        viewModel.postCards.dismissOptions()
                        viewModel.postCards.shareExternally(card.id) { url, onCompleted ->
                            lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) && shareTextWithCompletion(url, onCompleted)
                        }
                    },
                    onReport = { viewModel.postCards.beginReport(card.id) },
                    onDismiss = { viewModel.postCards.dismissOptions() },
                    onToggleProfilePin = { viewModel.postCards.toggleProfilePin(card.id) },
                )
            }
        }
        reportingPostId?.let { id ->
            ProfilePostReportDialog(
                onReport = { reason -> viewModel.postCards.report(id, reason) },
                onDismiss = { viewModel.postCards.cancelReport() },
            )
        }
        // Tapping "Connected" removes the edge, and RN gates the same
        // `DELETE api/relationships/:id` behind a "Disconnect · Remove this
        // connection?" alert (`src/app/connections.tsx:69-77`), so confirm
        // first. Mirrors iOS `PublicProfileView`'s disconnect dialog.
        if (showDisconnectConfirm) {
            val name = (state as? PublicProfileUiState.Loaded)?.content?.header?.displayName?.trim().orEmpty()
            AlertDialog(
                onDismissRequest = { viewModel.cancelDisconnect() },
                title = { Text(if (name.isEmpty()) "Disconnect?" else "Disconnect from $name?") },
                text = { Text("You'll stop seeing each other's connections-only posts.") },
                confirmButton = {
                    TextButton(
                        onClick = { viewModel.disconnect() },
                        modifier = Modifier.testTag("publicProfileDisconnectConfirm"),
                    ) {
                        Text("Disconnect", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { viewModel.cancelDisconnect() },
                        modifier = Modifier.testTag("publicProfileDisconnectCancel"),
                    ) {
                        Text("Cancel")
                    }
                },
            )
        }
        val loadedContent = (state as? PublicProfileUiState.Loaded)?.content
        // Requested → "Withdraw your request?", so a stray tap never takes it back.
        if (showWithdrawConfirm) {
            val firstName = loadedContent?.header?.let(::profileFirstName) ?: "them"
            AlertDialog(
                onDismissRequest = { viewModel.cancelWithdraw() },
                title = { Text("Withdraw your request?") },
                text = { Text("This takes back your request to $firstName. You can ask again later.") },
                confirmButton = {
                    TextButton(
                        onClick = { viewModel.withdrawRequest() },
                        modifier = Modifier.testTag("publicProfileWithdrawConfirm"),
                    ) {
                        Text("Withdraw", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { viewModel.cancelWithdraw() },
                        modifier = Modifier.testTag("publicProfileWithdrawCancel"),
                    ) {
                        Text("Keep it")
                    }
                },
            )
        }
        if (showConnectSheet && loadedContent != null) {
            ProfileConnectSheet(
                header = loadedContent.header,
                firstName = profileFirstName(loadedContent.header),
                plansOn = DeepLinkRouter.plansEnabled(),
                isFollowing = isFollowing,
                canFollow = canFollow && relationshipLoaded,
                connectState = connectState,
                onSend = viewModel::sendRequestFromSheet,
                onJustFollow = viewModel::followFromSheet,
                onDismiss = viewModel::dismissConnectSheet,
            )
        }
        if (showPreviewSheet) {
            PreviewAsSheet(
                onPick = { audience ->
                    showPreviewSheet = false
                    viewModel.startPreview(audience)
                },
                onDismiss = { showPreviewSheet = false },
            )
        }
        ownerExtras?.receipt?.takeIf { showReceipt }?.let { receipt ->
            OwnerReceiptSheet(
                receipt = receipt,
                onShare = { viewModel.owner.receiptShareMessage()?.let { context.shareText(it) } },
                onDismiss = { showReceipt = false },
            )
        }
        ownerExtras?.invite?.takeIf { showInvite }?.let { progress ->
            OwnerInviteSheet(
                progress = progress,
                onShare = viewModel.owner.inviteShareMessage()?.let { message -> { context.shareText(message) } },
                onDismiss = { showInvite = false },
            )
        }
        // Instant Screens contract §7: the sign-out confirmation says the phone's saved copy goes too.
        if (showLogOutConfirm) {
            AlertDialog(
                onDismissRequest = { showLogOutConfirm = false },
                title = { Text("Sign out of Pantopus?") },
                text = {
                    Text("You'll need to sign in again to use your account. Signing out removes what Pantopus saved on this phone.")
                },
                modifier = Modifier.testTag("ownerLogOutDialog"),
                confirmButton = {
                    TextButton(
                        onClick = {
                            showLogOutConfirm = false
                            ownerNavigation.onLogOut()
                        },
                        modifier = Modifier.testTag("ownerLogOutConfirm"),
                    ) {
                        Text("Sign out", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showLogOutConfirm = false }) { Text("Cancel") }
                },
            )
        }
        if (showTrustExplainer && loadedContent != null) {
            ProfileTrustExplainer(
                firstName = profileFirstName(loadedContent.header),
                trust = loadedContent.header.trust,
                isOwner = loadedContent.isOwner,
                onDismiss = { showTrustExplainer = false },
            )
        }
    }
}

/** The posts read returns at most [StoreKeys.PROFILE_POSTS_LIMIT]; a full page reads "50+". */
internal fun postCountLabel(count: Int): String = if (count >= StoreKeys.PROFILE_POSTS_LIMIT) "$count+" else "$count"

/** The name in sentences ("Connect with Rowan?"): the first word of the name neighbors see. */
internal fun profileFirstName(header: PublicProfileHeader): String =
    header.displayName
        .takeIf { header.hasName }
        ?.trim()
        ?.removePrefix("@")
        ?.split(" ")
        ?.firstOrNull { it.isNotBlank() }
        ?: "this neighbor"

/**
 * T3 — render state for the plain Follow / Following control. A Beacon
 * (persona with a resolvable handle) still hands the tap to the privacy
 * handshake wizard, which owns its own in-flight pose; everyone else
 * toggles `api/users/:id/follow` and uses [isInFlight]. Follow and Connect
 * render only once [relationshipLoaded], so a failed relationship read
 * can't show them to an existing follower or connection.
 */
internal data class ProfileFollowState(
    val canFollow: Boolean = false,
    val isFollowing: Boolean = false,
    val isInFlight: Boolean = false,
    val relationshipLoaded: Boolean = true,
)

/**
 * P6.5 — Kind-aware loaded frame, exposed as `internal` so Paparazzi
 * snapshot tests can render the populated view without spinning up a
 * Hilt VM.
 *
 * [connection] drives the local profile's Connect → Requested → Accept →
 * Connected label ([connectState] only greys the control while a call is
 * in flight) and [follow] drives the Follow → Following flip; iOS
 * `PublicProfileView.identityActions` renders exactly the same pair.
 */
@Composable
internal fun PublicProfileLoadedFrame(
    content: PublicProfileContent,
    selectedTab: ProfileTab,
    connectState: PublicProfileActionState,
    onBack: () -> Unit,
    onSelectTab: (ProfileTab) -> Unit,
    onFollow: () -> Unit,
    onMessage: () -> Unit,
    onConnect: () -> Unit,
    onOverflow: () -> Unit,
    onUnlock: (PublicProfilePost) -> Unit,
    follow: ProfileFollowState = ProfileFollowState(),
    connection: ProfileConnection = ProfileConnection.None,
    onOpenInsights: () -> Unit = {},
    onEditPersona: () -> Unit = {},
    onComposeBroadcast: () -> Unit = {},
    // Threading the profile id lights up the live Reviews / Gigs /
    // Portfolio panels, which self-load through `hiltViewModel()`. It
    // stays null for the Paparazzi hosts (same escape hatch as
    // [receivedReviews]) — they render without a Hilt graph.
    profileUserId: String? = null,
    onOpenGig: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    receivedReviews: @Composable () -> Unit = {},
) {
    val persona = content.kind == PublicProfileKind.Persona
    ContentDetailShell(
        title = null,
        onBack = onBack,
        topBarAction =
            ContentDetailTopBarAction(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = "More",
                onClick = onOverflow,
            ),
        header = {
            // Box stacks the 120dp banner with the identity block pulled
            // down to overlap the banner's lower 40dp (banner − overlap).
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag(if (persona) "publicProfilePersonaHeader" else "publicProfileLocalHeader"),
            ) {
                PublicProfileBanner(kind = content.kind)
                Box(modifier = Modifier.padding(top = 80.dp)) {
                    BeaconIdentityBlock(
                        identity = if (persona) BeaconIdentity.Personal else BeaconIdentity.Home,
                        name = content.header.displayName,
                        handle = content.header.handle,
                        tierLabel = content.header.tierLabel,
                        isVerifiedNeighbor = content.header.isVerifiedNeighbor,
                        locality = content.header.locality,
                        bio = content.stats.bio,
                        isVerified = content.header.isVerified,
                        avatarUrl = content.header.avatarUrl,
                        stats = content.stats.stats,
                        avatarName = content.header.avatarName,
                    ) {
                        if (persona) {
                            // Launch cut #1/#2 (Beacon + Personas): no Beacon insights or persona editor.
                            if (content.isOwner && LaunchFeatures.beacon && LaunchFeatures.personas) {
                                BeaconHeaderGhostButton(
                                    icon = PantopusIcon.BarChart3,
                                    actionLabel = "Insights",
                                    onClick = onOpenInsights,
                                )
                                BeaconHeaderGhostButton(
                                    title = "Edit",
                                    icon = PantopusIcon.Pencil,
                                    actionLabel = "Edit Persona",
                                    onClick = onEditPersona,
                                )
                            } else if (!content.isOwner) {
                                BeaconHeaderGhostButton(
                                    icon = PantopusIcon.Share,
                                    actionLabel = "Share profile",
                                    onClick = onOverflow,
                                )
                                if (follow.relationshipLoaded) {
                                    if (follow.isFollowing) {
                                        BeaconHeaderGhostButton(
                                            icon = PantopusIcon.Check,
                                            actionLabel = "Following. Tap to unfollow",
                                            onClick = onFollow,
                                            title = "Following",
                                        )
                                    } else {
                                        BeaconHeaderPrimaryButton(
                                            title = "Follow",
                                            icon = PantopusIcon.Plus,
                                            onClick = onFollow,
                                        )
                                    }
                                }
                            }
                        } else {
                            NeighborHeaderActions(
                                connection = connection,
                                connectState = connectState,
                                canFollow = follow.canFollow && follow.relationshipLoaded,
                                isOwnProfile = content.isOwner,
                                onConnect = onConnect,
                                onMessage = onMessage,
                            )
                        }
                    }
                }
            }
        },
        body = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                StatsTabsBody(
                    content = content.stats,
                    selectedTab = selectedTab,
                    onSelectTab = onSelectTab,
                    showStats = false,
                    showActionRow = false,
                    profileUserId = profileUserId,
                    isOwnProfile = content.isOwner,
                    onMessage = onMessage,
                    onConnect = onConnect,
                    onOverflow = onOverflow,
                    onOpenGig = onOpenGig,
                    onOpenReviewer = onOpenProfile,
                )
                receivedReviews()
                // Launch cut #1/#2 (Beacon + Personas): no Beacon broadcasts feed.
                if (!persona || (LaunchFeatures.beacon && LaunchFeatures.personas)) {
                    PublicProfilePostsFeed(
                        kind = content.kind,
                        posts = content.posts,
                        onUnlock = onUnlock,
                        onEmptyCta =
                            when {
                                !persona -> onMessage
                                content.isOwner -> onComposeBroadcast
                                else -> onFollow
                            },
                        isOwnProfile = content.isOwner,
                    )
                }
            }
        },
    )
}

/** How the page shows: someone else's, your own (owner mode), or your own as one audience sees it. */
internal sealed interface ProfileFrameMode {
    data object Visitor : ProfileFrameMode

    data class Owner(
        val extras: OwnerExtras?,
        val cover: Boolean,
        val navigation: OwnerNavigation,
        val actions: OwnerPageActions,
    ) : ProfileFrameMode

    data class Preview(
        val audience: PreviewAudience,
        val onDone: () -> Unit,
    ) : ProfileFrameMode
}

/** Your own page's buttons that stay on the page (the rest go through [OwnerNavigation]). */
internal data class OwnerPageActions(
    val onShare: () -> Unit = {},
    val onPreviewAs: () -> Unit = {},
    val onDismissTip: (OwnerTip) -> Unit = {},
    val onOpenMonth: () -> Unit = {},
    val onShareMonth: () -> Unit = {},
    val onOpenInvite: () -> Unit = {},
    val onLogOut: () -> Unit = {},
)

/**
 * Someone's profile (PRF, 2026-11-01; `Main.dc.html`): the short header with its trust line and the actions for
 * this relationship, then Posts · About (· Work when there is work). Your own profile ([ProfileFrameMode.Owner]) is
 * the same page with the name neighbors see, Edit profile + Preview as, tips only you see, your latest two posts and
 * "Your account"; a preview ([ProfileFrameMode.Preview]) is the page as that audience gets it. `internal` so Paparazzi
 * can render it without Hilt.
 */
@Composable
internal fun LocalProfileLoadedFrame(
    content: PublicProfileContent,
    selectedTab: LocalProfileTab,
    actions: ProfileActionsState,
    callbacks: ProfileActionCallbacks,
    onBack: () -> Unit,
    onSelectTab: (LocalProfileTab) -> Unit,
    onOverflow: () -> Unit,
    onTrustClick: () -> Unit = {},
    hiddenByBlock: Boolean = false,
    onOpenGig: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    onOpenLink: (String) -> Unit = {},
    postsLoadFailed: Boolean = false,
    postsLoading: Boolean = false,
    onRetryPosts: () -> Unit = {},
    postCards: List<PulsePostCardContent> = emptyList(),
    postCardActions: ProfilePostCardActions = ProfilePostCardActions(),
    mode: ProfileFrameMode = ProfileFrameMode.Visitor,
    inCommon: ProfileInCommon? = null,
    onOpenInCommon: (InCommonTarget) -> Unit = {},
    /** The Pinned row; null until read (then the "Pin a post" tip waits too). */
    pinned: List<PinnedCard>? = null,
) {
    val owner = mode as? ProfileFrameMode.Owner
    val preview = mode as? ProfileFrameMode.Preview
    // Your own page shows the name and photo neighbors see, never the account's.
    val header = owner?.extras?.let { ownerHeader(content.header, it) } ?: content.header
    val firstName = profileFirstName(header)
    // Work shows when there is work to show, and always on your own profile, where "Add portfolio item" lives.
    val tabs =
        listOfNotNull(
            LocalProfileTab.Posts,
            LocalProfileTab.About,
            LocalProfileTab.Work.takeIf { content.work.hasWork || owner != null },
        )
    // Work leaves when its last item goes; the strip falls back to Posts.
    val tab = selectedTab.takeIf { it in tabs } ?: LocalProfileTab.Posts
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("publicProfileLocalHeader")) {
        ProfileFrameTopBar(mode = mode, onBack = onBack, onOverflow = onOverflow)
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            ProfileIdentityHeader(
                header = header,
                bio = content.stats.bio,
                onTrustClick = onTrustClick,
                accountNameLine = owner?.extras?.accountNameLine,
            ) {
                ProfileFrameHeaderActions(
                    mode = mode,
                    content = content,
                    header = header,
                    actions = actions,
                    callbacks = callbacks,
                    hasNoPins = pinned?.isEmpty() == true,
                )
            }
            YouAndCard(firstName = firstName, inCommon = inCommon, onOpen = onOpenInCommon)
            GetToKnowCard(
                firstName = firstName,
                prompts = content.profile.prompts,
                onEdit = callbacks.onEditProfile.takeIf { owner != null },
            )
            PinnedRow(
                cards = pinned.orEmpty(),
                onOpen = postCardActions.onOpen.takeIf { preview == null },
                onEdit = callbacks.onEditProfile.takeIf { owner != null },
            )
            Spacer(Modifier.height(28.dp))
            if (preview?.audience == PreviewAudience.Anyone) {
                // Signed-out visitors can't read posts: no tabs, no posts, as the drawing's "anyone" frame.
                PostsForNeighborsCard(firstName = firstName)
            } else {
                LocalProfileTabStrip(
                    tabs = tabs,
                    postCount = postCountLabel(postCards.size).takeIf { postCards.isNotEmpty() && !hiddenByBlock },
                    selected = tab,
                    onSelect = onSelectTab,
                )
                Spacer(Modifier.height(Spacing.s3))
                when (tab) {
                    LocalProfileTab.Posts ->
                        if (owner != null && postCards.isNotEmpty()) {
                            OwnerLatestPosts(cards = postCards, actions = postCardActions, onSeeAll = owner.navigation.onSeeAllPosts)
                        } else {
                            LocalProfilePosts(
                                cards = postCards,
                                actions = postCardActions,
                                firstName = firstName,
                                joinedRecently = content.header.trust.joinedRecently,
                                isOwnProfile = content.isOwner || owner != null,
                                loadFailed = postsLoadFailed,
                                hiddenByBlock = hiddenByBlock,
                                onSayHi = callbacks.onMessage,
                                onRetry = onRetryPosts,
                                loading = postsLoading,
                                interactive = preview == null,
                            )
                        }
                    LocalProfileTab.About ->
                        LocalProfileAboutSection(
                            firstName = firstName,
                            skills = content.stats.skills,
                            trust = content.header.trust,
                            emailConfirmed = content.profile.verified == true,
                            links = content.links,
                            onOpenLink = onOpenLink,
                            aroundTheNeighborhood = { AroundTheNeighborhood(firstName, content.profile.contributions) },
                        )
                    LocalProfileTab.Work ->
                        LocalProfileWorkSection(
                            userId = content.profile.id,
                            isOwnProfile = content.isOwner,
                            work = content.work,
                            onOpenGig = onOpenGig,
                            onOpenProfile = onOpenProfile,
                        )
                }
            }
            if (owner != null) {
                Spacer(Modifier.height(28.dp))
                OwnerAccountSection(
                    extras = owner.extras ?: OwnerExtras(),
                    navigation = owner.navigation,
                    onOpenMonth = owner.actions.onOpenMonth,
                    onShareMonth = owner.actions.onShareMonth,
                    onOpenInvite = owner.actions.onOpenInvite,
                    onLogOut = owner.actions.onLogOut,
                )
            }
            Spacer(Modifier.height(Spacing.s10))
        }
    }
}

/** The bar over the page: a preview's banner, your own page's ✕ (or Back) and Share, or a visitor's Back and ⋯. */
@Composable
private fun ProfileFrameTopBar(
    mode: ProfileFrameMode,
    onBack: () -> Unit,
    onOverflow: () -> Unit,
) {
    when (mode) {
        is ProfileFrameMode.Preview -> PreviewBanner(audience = mode.audience, onDone = mode.onDone)
        is ProfileFrameMode.Owner -> OwnerTopBar(cover = mode.cover, onClose = onBack, onShare = mode.actions.onShare)
        ProfileFrameMode.Visitor -> ProfileTopBar(onBack = onBack, onMore = onOverflow)
    }
}

/** Under the name: a preview's note, your Edit profile and Preview as (then your tips), or a visitor's actions. */
@Composable
private fun ProfileFrameHeaderActions(
    mode: ProfileFrameMode,
    content: PublicProfileContent,
    header: PublicProfileHeader,
    actions: ProfileActionsState,
    callbacks: ProfileActionCallbacks,
    hasNoPins: Boolean,
) {
    val firstName = profileFirstName(header)
    when (mode) {
        is ProfileFrameMode.Preview -> PreviewHeaderActions(audience = mode.audience, firstName = firstName)
        is ProfileFrameMode.Owner -> {
            OwnerHeaderActions(onEditProfile = callbacks.onEditProfile, onPreviewAs = mode.actions.onPreviewAs)
            OwnerTips(
                tips = ownerTips(content, header, mode.extras, hasNoPins),
                // Pins come from a post's ⋯ menu: "Pin a post" opens My posts; the rest open the editor.
                onOpen = { tip -> if (tip == OwnerTip.Pin) mode.navigation.onSeeAllPosts() else callbacks.onEditProfile() },
                onDismiss = mode.actions.onDismissTip,
            )
        }
        ProfileFrameMode.Visitor -> ProfileHeaderActions(state = actions, callbacks = callbacks, firstName = firstName)
    }
}

/** Your own Posts tab: your latest two, then "See all N posts" (My posts). */
@Composable
private fun OwnerLatestPosts(
    cards: List<PulsePostCardContent>,
    actions: ProfilePostCardActions,
    onSeeAll: () -> Unit,
) {
    ProfilePulseCards(cards = cards.take(OWNER_POSTS_SHOWN), actions = actions, showHeading = false)
    if (cards.size > OWNER_POSTS_SHOWN) {
        Spacer(Modifier.height(Spacing.s3))
        SeeAllPostsButton(label = "See all ${postCountLabel(cards.size)} posts", onClick = onSeeAll)
    }
}

/** Your own page shows your latest two posts, then "See all N posts". */
private const val OWNER_POSTS_SHOWN = 2

/** Your own page's header: the name and photo neighbors see (your Local Profile), once read. */
internal fun ownerHeader(
    header: PublicProfileHeader,
    extras: OwnerExtras,
): PublicProfileHeader =
    header.copy(
        displayName = extras.neighborName?.takeIf { it.isNotBlank() } ?: header.displayName,
        avatarUrl = if (extras.localProfileRead) extras.neighborPhoto else header.avatarUrl,
        hasName = header.hasName || !extras.neighborName.isNullOrBlank(),
    )

/** At most two tips only you see, for what your profile is missing, minus the ones you closed on this phone. */
internal fun ownerTips(
    content: PublicProfileContent,
    header: PublicProfileHeader,
    extras: OwnerExtras?,
    hasNoPins: Boolean = false,
): List<OwnerTip> {
    if (extras == null) return emptyList()
    return listOfNotNull(
        OwnerTip.Photo.takeIf { extras.localProfileRead && header.avatarUrl.isNullOrBlank() },
        OwnerTip.Tagline.takeIf { header.tagline == null },
        OwnerTip.Skills.takeIf { content.stats.skills.isEmpty() },
        OwnerTip.Prompt.takeIf { promptAnswers(content.profile.prompts).isEmpty() },
        OwnerTip.Pin.takeIf { hasNoPins && content.posts.isNotEmpty() },
    ).filter { it.key !in extras.dismissedTips }.take(OWNER_TIPS_SHOWN)
}

private const val OWNER_TIPS_SHOWN = 2

/**
 * The Local header's two actions, Connect and Message (`beacon-primitives.jsx:268-272`), on the persona frame's
 * Local branch. Message doesn't show for someone the viewer blocked, nor on your own profile (#3092: nobody
 * messages themselves). Mirrors iOS `identityActions`.
 */
@Composable
private fun NeighborHeaderActions(
    connection: ProfileConnection,
    connectState: PublicProfileActionState,
    canFollow: Boolean,
    isOwnProfile: Boolean,
    onConnect: () -> Unit,
    onMessage: () -> Unit,
) {
    ConnectHeaderButton(
        connection = connection,
        connectState = connectState,
        canFollow = canFollow,
        onConnect = onConnect,
    )
    if (isOwnProfile || connection == ProfileConnection.Blocked) return
    BeaconHeaderPrimaryButton(
        title = "Message",
        icon = PantopusIcon.MessageSquare,
        onClick = onMessage,
    )
}

/**
 * The relationship-driven Connect header action.
 *
 * The label, the glyph and whether the tap does anything all come from the
 * edge `GET api/users/:id/relationship` reported: Connect → Requested →
 * Accept → Connected. An outstanding request renders inert (RN's
 * `disabled={actionLoading || connectionState === 'pending_sent'}`). The
 * control disappears altogether on your own profile, for a signed-out
 * viewer, and once the viewer has blocked this neighbour — RN drops the
 * whole action row in those cases (`src/app/user/[id].tsx:391-398,523`).
 * Mirrors iOS `PublicProfileView.identityActions`.
 */
@Composable
private fun ConnectHeaderButton(
    connection: ProfileConnection,
    connectState: PublicProfileActionState,
    canFollow: Boolean,
    onConnect: () -> Unit,
) {
    if (!canFollow || connection == ProfileConnection.Blocked) return
    Box(modifier = Modifier.testTag("publicProfileConnectCta")) {
        BeaconHeaderGhostButton(
            icon =
                when (connection) {
                    ProfileConnection.Connected -> PantopusIcon.Check
                    ProfileConnection.PendingSent -> PantopusIcon.Clock
                    else -> PantopusIcon.UserPlus
                },
            actionLabel = connection.accessibilityLabel,
            onClick = onConnect,
            title = connection.label,
            enabled = connection.isActionable && connectState !is PublicProfileActionState.InFlight,
        )
    }
}

/** The profile's public link (web `/u/:username`, the link web's own profile Share uses), or null without one. */
private fun profileShareUrl(state: PublicProfileUiState): String? {
    val username = (state as? PublicProfileUiState.Loaded)?.content?.profile?.username
    return username?.takeIf { it.isNotBlank() }?.let(InviteLinks::profileUrl)
}

/** The ⋯ menu's Follow / Unfollow row; null leaves it out (your own profile, a block, an unknown relationship). */
private data class OverflowFollow(
    val firstName: String,
    val isFollowing: Boolean,
    val enabled: Boolean,
)

@Composable
private fun OverflowSheetContent(
    shareUrl: String?,
    isOwnProfile: Boolean,
    isBlockedByViewer: Boolean,
    onShare: (String) -> Unit,
    onBlock: () -> Unit,
    onUnblock: () -> Unit,
    onReport: () -> Unit,
    onCancel: () -> Unit,
    follow: OverflowFollow? = null,
    onFollow: () -> Unit = {},
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        shareUrl?.let { url -> OverflowSheetRow(label = "Share profile", onClick = { onShare(url) }) }
        follow?.let {
            // Unfollow keeps its confirm (10-30); Follow is one tap, as in the Connect sheet.
            OverflowSheetRow(
                label = if (it.isFollowing) "Unfollow ${it.firstName}" else "Follow ${it.firstName}'s public posts",
                onClick = { if (it.enabled) onFollow() },
            )
        }
        // Nobody blocks or reports themselves.
        if (!isOwnProfile) {
            // Someone you blocked can be unblocked here, as in Settings → Blocked users.
            if (isBlockedByViewer) {
                OverflowSheetRow(label = "Unblock this user", onClick = onUnblock)
            } else {
                OverflowSheetRow(label = "Block this user", destructive = true, onClick = onBlock)
            }
            OverflowSheetRow(label = "Report", onClick = onReport)
        }
        OverflowSheetRow(label = "Cancel", onClick = onCancel)
    }
}

@Composable
private fun OverflowSheetRow(
    label: String,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.body,
            color = if (destructive) PantopusColors.error else PantopusColors.appText,
        )
    }
}

@Composable
internal fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Shimmer(width = 72.dp, height = 72.dp, cornerRadius = 36.dp)
            Shimmer(width = 160.dp, height = 22.dp, cornerRadius = Radii.sm)
            Shimmer(width = 220.dp, height = 12.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 80.dp, cornerRadius = Radii.lg)
            Shimmer(width = 320.dp, height = 42.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
internal fun ErrorLayout(
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit,
) {
    // Mirror iOS: the error layout keeps a back chevron so a load failure
    // is escapable from in-screen chrome (LoadingLayout already does this).
    Column(modifier = Modifier.fillMaxSize()) {
        ContentDetailTopBar(title = null, onBack = onBack, action = null)
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load this profile",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}
