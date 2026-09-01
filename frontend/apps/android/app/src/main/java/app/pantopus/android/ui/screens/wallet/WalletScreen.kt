@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "FunctionNaming", "LongParameterList")

package app.pantopus.android.ui.screens.wallet

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.core.security.SensitiveScreenGuard
import app.pantopus.android.core.security.rememberSensitiveActionGuard
import app.pantopus.android.ui.components.BalanceHero
import app.pantopus.android.ui.components.BalanceHeroSplitCell
import app.pantopus.android.ui.components.BalanceHeroTone
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.wallet.components.ActivityRow
import app.pantopus.android.ui.screens.wallet.components.HoldBanner
import app.pantopus.android.ui.screens.wallet.components.LifetimeTotalsCard
import app.pantopus.android.ui.screens.wallet.components.PayoutAccountCard
import app.pantopus.android.ui.screens.wallet.components.PayoutMethodCard
import app.pantopus.android.ui.screens.wallet.components.PendingReleaseCard
import app.pantopus.android.ui.screens.wallet.components.TaxDocsRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import kotlinx.coroutines.launch

/**
 * A10.10 — earnings wallet. Top-level destination distinct from
 * Settings → Payments: this is the earnings-side surface (BalanceHero
 * + recent activity + payout method + tax docs + Withdraw CTA). The
 * Settings → Payments row routes here in P3.2 (replacing the prior
 * `NotYetAvailableView` placeholder); the `pantopus://wallet` deep
 * link lands here too.
 *
 * Two designed frames: populated (happy path) and payout-on-hold
 * (bank verification expired — amber banner, locked withdraw,
 * re-verify CTA in the payout method card).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    onBack: () -> Unit,
    onOpenHistory: () -> Unit = {},
    onOpenTaxDocs: () -> Unit = {},
    onSeeAllActivity: () -> Unit = {},
    viewModel: WalletViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.action.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val withdrawError by viewModel.withdrawError.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val toastController = remember { ToastController() }
    var showWithdrawSheet by remember { mutableStateOf(false) }
    var withdrawAmount by remember { mutableStateOf("") }
    var awaitingConnectReturn by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    val scope = rememberCoroutineScope()
    // RN re-verifies identity at the moment of withdrawal on top of the screen
    // guard (`components/payments/WalletTab.tsx:88`). The prompt needs the host
    // Activity, so it is raised here; iOS mirrors the same call site.
    val verifyIdentity = rememberSensitiveActionGuard()

    LaunchedEffect(Unit) { viewModel.load() }

    // Open the Stripe-hosted onboarding / dashboard URL in the browser.
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is WalletEvent.OpenUrl -> {
                    if (event.refreshOnReturn) awaitingConnectReturn = true
                    runCatching { openStripeHostedUrl(context, event.url) }
                        .onFailure { toastController.error("Couldn't open the payout page.") }
                }
            }
        }
    }

    // Re-read Connect status when the seller returns from hosted onboarding.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, e ->
                if (e == Lifecycle.Event.ON_RESUME && awaitingConnectReturn) {
                    awaitingConnectReturn = false
                    viewModel.onReturnFromConnect()
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Surface the payout action result as a toast + dismiss the sheet.
    LaunchedEffect(action) {
        when (val current = action) {
            is WalletAction.WithdrawSucceeded -> {
                showWithdrawSheet = false
                toastController.success(current.message)
            }
            is WalletAction.WithdrawFailed -> {
                showWithdrawSheet = false
                toastController.error(current.message)
            }
            is WalletAction.ActionFailed -> toastController.error(current.message)
            else -> Unit
        }
    }

    SecureScreenEffect()

    // Money surface — RN wraps this route in `SensitiveScreenGuard`
    // (`app/wallet.tsx:195`), so the device credential is checked before any
    // balance is composed. A 5-minute grace means Wallet → Payments doesn't
    // prompt twice.
    SensitiveScreenGuard(reason = "Verify to access your Wallet", onRejected = onBack) {
        Box(modifier = Modifier.fillMaxSize()) {
            // RN keeps a `RefreshControl` on the wallet route
            // (`app/wallet.tsx:50`) — without it the balance can only be
            // re-read by leaving and re-entering the screen.
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = { viewModel.refresh() },
                modifier = Modifier.fillMaxSize(),
            ) {
                WalletScreenContent(
                    state = state,
                    onBack = onBack,
                    onOpenHistory = onOpenHistory,
                    onWithdraw = { showWithdrawSheet = true },
                    onSetupPayouts = { viewModel.setupPayouts() },
                    onManagePayout = { viewModel.openDashboard() },
                    onReverifyPayout = { viewModel.setupPayouts() },
                    onOpenTaxDocs = onOpenTaxDocs,
                    onSeeAllActivity = onSeeAllActivity,
                    onRetry = { viewModel.refresh() },
                )
            }
            PayoutResultMarker(action)
            ToastHost(controller = toastController)
        }
    }

    if (showWithdrawSheet) {
        ModalBottomSheet(
            onDismissRequest = { showWithdrawSheet = false },
            sheetState = sheetState,
        ) {
            WithdrawConfirmSheet(
                amount = currentAvailable(state),
                amountText = withdrawAmount,
                amountError = withdrawError,
                processing = action is WalletAction.Withdrawing,
                onAmountChange = {
                    withdrawAmount = it
                    viewModel.clearWithdrawError()
                },
                onUseMax = { withdrawAmount = currentAvailable(state) },
                onConfirm = {
                    scope.launch {
                        when (val outcome = verifyIdentity("Approve wallet withdrawal")) {
                            is AppLockManager.SensitiveActionOutcome.Verified -> {
                                val trimmed = withdrawAmount.trim()
                                viewModel.withdraw(if (trimmed.isEmpty()) null else trimmed)
                            }
                            is AppLockManager.SensitiveActionOutcome.Cancelled -> Unit
                            is AppLockManager.SensitiveActionOutcome.Failed ->
                                toastController.error(outcome.message)
                        }
                    }
                },
                onCancel = { showWithdrawSheet = false },
            )
        }
    }
}

private fun openStripeHostedUrl(
    context: Context,
    url: String,
) {
    val uri = Uri.parse(url)
    runCatching {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(context, uri)
    }.getOrElse {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }
}

private fun currentAvailable(state: WalletUiState): String =
    when (state) {
        is WalletUiState.Populated -> state.content.available
        is WalletUiState.Hold -> state.content.available
        else -> "0.00"
    }

@Composable
private fun WithdrawConfirmSheet(
    amount: String,
    amountText: String,
    amountError: String?,
    processing: Boolean,
    onAmountChange: (String) -> Unit,
    onUseMax: () -> Unit,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5)
                .testTag("wallet.withdrawSheet"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ArrowDownToLine,
            contentDescription = null,
            size = 32.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Withdraw to your bank",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Funds arrive in 2–3 business days. Available to withdraw: \$$amount.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        // RN gives the user a decimal-pad amount field and posts *that* amount
        // (`components/payments/WalletTab.tsx:193`) — leaving it blank keeps
        // the whole-balance shortcut.
        WithdrawAmountField(
            amountText = amountText,
            amountError = amountError,
            enabled = !processing,
            onAmountChange = onAmountChange,
            onUseMax = onUseMax,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(enabled = !processing, onClick = onConfirm)
                    .heightIn(min = 48.dp)
                    .testTag("wallet.withdrawBtn"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (processing) "Processing…" else "Confirm withdrawal",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = "Cancel",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.clickable(onClick = onCancel),
        )
        Spacer(Modifier.height(Spacing.s5))
    }
}

/**
 * Decimal-pad amount input for a partial withdrawal, with an inline
 * validation line. Mirrors iOS `WalletView.withdrawSheet`'s field.
 */
@Composable
private fun WithdrawAmountField(
    amountText: String,
    amountError: String?,
    enabled: Boolean,
    onAmountChange: (String) -> Unit,
    onUseMax: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .border(
                        BorderStroke(
                            1.dp,
                            if (amountError == null) PantopusColors.appBorder else PantopusColors.error,
                        ),
                        RoundedCornerShape(Radii.md),
                    ).heightIn(min = 48.dp)
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "$",
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            BasicTextField(
                value = amountText,
                onValueChange = onAmountChange,
                enabled = enabled,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                textStyle =
                    TextStyle(
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("wallet.withdrawAmountField"),
                decorationBox = { inner ->
                    if (amountText.isEmpty()) {
                        Text(
                            text = "Amount",
                            fontSize = 17.sp,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            Text(
                text = "Max",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clickable(enabled = enabled, onClick = onUseMax)
                        .testTag("wallet.withdrawMaxBtn"),
            )
        }
        if (amountError != null) {
            Text(
                text = amountError,
                fontSize = 12.sp,
                color = PantopusColors.error,
                modifier = Modifier.testTag("wallet.withdrawAmountError"),
            )
        }
    }
}

/** Invisible test anchor mirroring the last terminal payout outcome. */
@Composable
private fun PayoutResultMarker(action: WalletAction) {
    val tag =
        when (action) {
            is WalletAction.WithdrawSucceeded -> "wallet.withdrawSuccess"
            is WalletAction.WithdrawFailed, is WalletAction.ActionFailed -> "wallet.actionError"
            else -> null
        }
    if (tag != null) {
        Box(modifier = Modifier.size(0.dp).testTag(tag))
    }
}

@Composable
internal fun WalletScreenContent(
    state: WalletUiState,
    onBack: () -> Unit = {},
    onOpenHistory: () -> Unit = {},
    onWithdraw: () -> Unit = {},
    onSetupPayouts: () -> Unit = {},
    onManagePayout: () -> Unit = {},
    onReverifyPayout: () -> Unit = {},
    onOpenTaxDocs: () -> Unit = {},
    onSeeAllActivity: () -> Unit = {},
    onRetry: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("wallet"),
    ) {
        WalletTopBar(onBack = onBack, onOpenHistory = onOpenHistory)
        when (val current = state) {
            WalletUiState.Loading -> LoadingBody()
            is WalletUiState.Populated ->
                WalletBody(
                    content = current.content,
                    onWithdraw = onWithdraw,
                    onSetupPayouts = onSetupPayouts,
                    onManagePayout = onManagePayout,
                    onReverifyPayout = onReverifyPayout,
                    onOpenTaxDocs = onOpenTaxDocs,
                    onSeeAllActivity = onSeeAllActivity,
                )
            is WalletUiState.Hold ->
                WalletBody(
                    content = current.content,
                    onWithdraw = onWithdraw,
                    onSetupPayouts = onSetupPayouts,
                    onManagePayout = onManagePayout,
                    onReverifyPayout = onReverifyPayout,
                    onOpenTaxDocs = onOpenTaxDocs,
                    onSeeAllActivity = onSeeAllActivity,
                )
            is WalletUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load wallet",
                    subcopy = current.message,
                    modifier = Modifier.testTag("walletError"),
                    ctaTitle = "Try again",
                    onCta = onRetry,
                )
        }
    }
}

// MARK: - Top bar

@Composable
private fun WalletTopBar(
    onBack: () -> Unit,
    onOpenHistory: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                tag = "walletBackButton",
                onClick = onBack,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = "Wallet",
                color = PantopusColors.appText,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.weight(1f))
            IconButton(
                icon = PantopusIcon.History,
                contentDescription = "History",
                tag = "walletHistoryButton",
                onClick = onOpenHistory,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
private fun IconButton(
    icon: PantopusIcon,
    contentDescription: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = contentDescription,
            size = 22.dp,
            tint = PantopusColors.appText,
        )
    }
}

// MARK: - Loaded body

@Composable
private fun WalletBody(
    content: WalletContent,
    onWithdraw: () -> Unit,
    onSetupPayouts: () -> Unit,
    onManagePayout: () -> Unit,
    onReverifyPayout: () -> Unit,
    onOpenTaxDocs: () -> Unit,
    onSeeAllActivity: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = if (content.canWithdraw) 116.dp else 140.dp),
        ) {
            if (content.holdState != null) {
                HoldBanner(
                    headline = content.holdState.bannerHeadline,
                    body = content.holdState.bannerBody,
                )
                Spacer(Modifier.height(Spacing.s3))
            }
            Hero(content)
            content.pendingBreakdown?.let { breakdown ->
                // RN splits the escrow total into "In review" / "Releasing
                // soon" (`WalletTab.tsx:161-173`); the hero's single Pending
                // figure can't say which is which.
                SectionOverline(title = "Pending release")
                PendingReleaseCard(breakdown = breakdown)
            }
            if (content.hasLifetimeTotals) {
                // `GET api/wallet` returns lifetime_received /
                // lifetime_withdrawals alongside the balance; RN shows both
                // beside it (`WalletTab.tsx:150-159`).
                SectionOverline(title = "Lifetime")
                LifetimeTotalsCard(
                    earned = content.lifetimeEarned,
                    withdrawn = content.lifetimeWithdrawn,
                )
            }
            SectionOverline(
                title = "Recent activity",
                actionLabel = "See all",
                onAction = onSeeAllActivity,
                actionTag = "walletSeeAllActivity",
            )
            ActivityList(items = content.activity)
            if (content.payoutMethod != null) {
                SectionOverline(title = "Payout method")
                PayoutMethodCard(
                    method = content.payoutMethod,
                    onManage = onManagePayout,
                    onReverify = onReverifyPayout,
                )
            } else if (content.payoutAccount != null) {
                // Live path: Stripe gives us no bank detail for an Express
                // account, so the connected *account* is what we render — and
                // it carries the only reachable "Open Stripe Dashboard".
                val account = content.payoutAccount
                SectionOverline(title = "Payout account")
                PayoutAccountCard(
                    account = account,
                    onAction = { if (account.warn) onReverifyPayout() else onManagePayout() },
                )
            }
            content.taxDocs?.let { docs ->
                SectionOverline(title = "Taxes")
                TaxDocsRow(docs = docs, onClick = onOpenTaxDocs)
            }
        }
        WalletBottomBar(
            content = content,
            modifier = Modifier.align(Alignment.BottomCenter),
            onWithdraw = onWithdraw,
            onSetupPayouts = onSetupPayouts,
        )
    }
}

@Composable
private fun Hero(content: WalletContent) {
    BalanceHero(
        overline = "Available to withdraw",
        amount = content.available,
        currencyCode = "USD",
        split =
            listOf(
                BalanceHeroSplitCell(
                    icon = PantopusIcon.Clock,
                    overline = "Pending",
                    value = content.pending,
                    note = content.pendingMeta,
                ),
                BalanceHeroSplitCell(
                    icon = PantopusIcon.TrendingUp,
                    overline = "This month",
                    value = content.monthValue,
                    note = content.monthMeta,
                ),
            ),
        tone = if (content.isOnHold) BalanceHeroTone.HoldTone else BalanceHeroTone.Default,
        holdHeadline = content.holdState?.heroBannerHeadline,
        holdBody = content.holdState?.heroBannerBody,
    )
}

@Composable
private fun SectionOverline(
    title: String,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
    actionTag: String? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s4, bottom = Spacing.s1),
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            text = title.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
        Spacer(Modifier.weight(1f))
        if (actionLabel != null) {
            Text(
                text = actionLabel,
                color = PantopusColors.primary600,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clickable(onClick = onAction)
                        .testTag(actionTag ?: "walletSectionAction"),
            )
        }
    }
}

@Composable
private fun ActivityList(items: List<WalletActivityItem>) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape),
    ) {
        items.forEachIndexed { index, item ->
            val isNewDay = index == 0 || items[index - 1].day != item.day
            if (isNewDay) {
                if (index != 0) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(PantopusColors.appBorderSubtle),
                    )
                }
                Text(
                    text = item.day.uppercase(),
                    color = PantopusColors.appTextMuted,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.7.sp,
                    modifier =
                        Modifier
                            .padding(
                                start = 14.dp,
                                end = 14.dp,
                                top = if (index == 0) Spacing.s2 else Spacing.s3,
                                bottom = Spacing.s1,
                            ),
                )
            }
            ActivityRow(item = item, isLast = index == items.size - 1)
        }
    }
}

@Composable
private fun WalletBottomBar(
    content: WalletContent,
    modifier: Modifier = Modifier,
    onWithdraw: () -> Unit,
    onSetupPayouts: () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colorStops =
                            arrayOf(
                                0f to PantopusColors.appBg.copy(alpha = 0f),
                                0.3f to PantopusColors.appBg.copy(alpha = 0.92f),
                                0.6f to PantopusColors.appBg,
                                1f to PantopusColors.appBg,
                            ),
                    ),
                )
                .padding(horizontal = Spacing.s4)
                .padding(top = 28.dp, bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (content.isOnHold) {
            WithdrawLockedCta(amount = content.available)
            content.holdState?.withdrawFootnote?.let { footnote ->
                Text(
                    text = footnote,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 10.5.sp,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .testTag("walletWithdrawFootnote"),
                )
            }
        } else if (!content.payoutsEnabled) {
            // Block 3C — withdraw is gated behind Stripe Connect payouts.
            SetupPayoutsCta(onClick = onSetupPayouts)
            Text(
                text = "Set up payouts to withdraw your earnings.",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("wallet.connectStatus"),
            )
        } else if (content.frozen) {
            // `Wallet.frozen` — the server answers this withdraw with 403
            // "Wallet is frozen", so the CTA must not look live.
            WithdrawLockedCta(amount = content.available)
            Text(
                text = "Your wallet is frozen. Contact support to release your funds.",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("wallet.frozenNote"),
            )
        } else if (!content.hasBalance) {
            WithdrawLockedCta(amount = content.available)
            Text(
                text = "No funds to withdraw yet.",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("wallet.noFundsNote"),
            )
        } else {
            WithdrawCta(amount = content.available, onClick = onWithdraw)
        }
    }
}

@Composable
private fun SetupPayoutsCta(onClick: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .pantopusShadow(PantopusElevations.primary, shape)
                .clip(shape)
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .padding(horizontal = 18.dp)
                .testTag("wallet.setupPayoutsBtn"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2.2f,
            tint = Color.White,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "Set up payouts",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.15).sp,
        )
    }
}

@Composable
private fun WithdrawCta(
    amount: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .pantopusShadow(PantopusElevations.primary, shape)
                .clip(shape)
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .padding(horizontal = 18.dp)
                .semantics { contentDescription = "Withdraw $$amount" }
                .testTag("walletWithdrawButton"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowDownToLine,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2.2f,
                tint = Color.White,
            )
            Text(
                text = "Withdraw",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.15).sp,
            )
        }
        Spacer(Modifier.weight(1f))
        Text(
            text = "\$$amount",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.15).sp,
        )
    }
}

@Composable
private fun WithdrawLockedCta(amount: String) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(shape)
                .background(PantopusColors.appSurfaceSunken)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape)
                .padding(horizontal = 18.dp)
                .semantics { contentDescription = "Withdraw locked. $$amount." }
                .testTag("walletWithdrawLockedButton"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "Withdraw",
                color = PantopusColors.appTextMuted,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.15).sp,
            )
        }
        Spacer(Modifier.weight(1f))
        Text(
            text = "\$$amount",
            color = PantopusColors.appTextMuted,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.15).sp,
        )
    }
}

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("walletLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        SkeletonBlock(height = 188.dp)
        SkeletonBlock(height = 220.dp)
        SkeletonBlock(height = 66.dp)
        SkeletonBlock(height = 66.dp)
    }
}

@Composable
private fun SkeletonBlock(height: androidx.compose.ui.unit.Dp) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceSunken),
    )
}
