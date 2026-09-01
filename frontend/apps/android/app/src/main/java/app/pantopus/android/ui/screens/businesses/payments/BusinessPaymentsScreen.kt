@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.payments

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Test tag on the Business Payments root container. */
const val BUSINESS_PAYMENTS_TAG = "businessPayments.screen"

/** How long the inline result banner stays up. */
internal const val TOAST_DURATION_MS = 3_000L

/**
 * A10.7 owner surface — "Payments". One card that reads the business's
 * Stripe Connect account and offers exactly the action the current stage
 * allows: Connect · Continue setup · (waiting) · Open Stripe Dashboard.
 * Mirrors RN `PaymentsTab.tsx` and iOS `BusinessPaymentsView`.
 */
@Composable
fun BusinessPaymentsScreen(
    onBack: () -> Unit,
    viewModel: BusinessPaymentsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.action.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var awaitingConnectReturn by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load() }

    // Open the Stripe-hosted onboarding / dashboard URL in a Custom Tab.
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            if (event.refreshOnReturn) awaitingConnectReturn = true
            runCatching { openStripeHostedUrl(context, event.url) }
        }
    }

    // Re-read Connect status when the owner returns from hosted onboarding.
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

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(BUSINESS_PAYMENTS_TAG)) {
        Column(Modifier.fillMaxSize()) {
            ContentDetailTopBar(title = "Payments", onBack = onBack)
            OfflineBannerHost(isOffline = !online) {
                when (val current = state) {
                    BusinessPaymentsUiState.Loading -> PaymentsLoading()
                    is BusinessPaymentsUiState.Loaded ->
                        PaymentsLoaded(
                            content = current.content,
                            isBusy = action is BusinessPaymentsAction.Connecting,
                            onConnect = viewModel::connect,
                            onContinueSetup = viewModel::continueSetup,
                            onOpenDashboard = viewModel::openDashboard,
                        )
                    is BusinessPaymentsUiState.Error ->
                        EmptyState(
                            icon = PantopusIcon.AlertCircle,
                            headline = "Couldn't load payments",
                            subcopy = current.message,
                            ctaTitle = "Try again",
                            onCta = viewModel::refresh,
                            tint = PantopusColors.businessBg,
                            accent = PantopusColors.business,
                            modifier = Modifier.testTag("businessPayments.error"),
                        )
                }
            }
        }
        (action as? BusinessPaymentsAction.Failed)?.let { failure ->
            ActionToast(
                message = failure.message,
                background = PantopusColors.error,
                onDismiss = viewModel::clearAction,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

// ─── Loading ──────────────────────────────────────────────────────────

@Composable
private fun PaymentsLoading() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("businessPayments.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 320.dp, height = 190.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(width = 320.dp, height = 68.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
    }
}

// ─── Loaded ───────────────────────────────────────────────────────────

@Composable
private fun PaymentsLoaded(
    content: BusinessPaymentsContent,
    isBusy: Boolean,
    onConnect: () -> Unit,
    onContinueSetup: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("businessPayments.loaded"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PayoutCard(
            content = content,
            isBusy = isBusy,
            onConnect = onConnect,
            onContinueSetup = onContinueSetup,
            onOpenDashboard = onOpenDashboard,
        )
        Footnote()
    }
}

@Composable
private fun PayoutCard(
    content: BusinessPaymentsContent,
    isBusy: Boolean,
    onConnect: () -> Unit,
    onContinueSetup: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(14.dp)
                .testTag("businessPayments.payoutCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Business payout account",
                color = PantopusColors.appText,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Set up Stripe to receive payments for business gigs and services.",
                color = PantopusColors.appTextSecondary,
                fontSize = 13.sp,
            )
        }

        StatusBanner(content)

        if (content.stage == BusinessPayoutStage.Onboarded) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                StatBox(
                    label = "Card payments",
                    value = if (content.chargesEnabled) "Enabled" else "Disabled",
                    modifier = Modifier.weight(1f),
                )
                StatBox(
                    label = "Payouts",
                    value = if (content.payoutsEnabled) "Enabled" else "Disabled",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        when (content.stage) {
            BusinessPayoutStage.NotConnected ->
                PrimaryButton(
                    title = "Connect with Stripe",
                    onClick = onConnect,
                    isLoading = isBusy,
                    modifier = Modifier.fillMaxWidth().testTag("businessPayments.connect"),
                )
            BusinessPayoutStage.SetupIncomplete ->
                PrimaryButton(
                    title = "Continue setup",
                    onClick = onContinueSetup,
                    isLoading = isBusy,
                    modifier = Modifier.fillMaxWidth().testTag("businessPayments.continueSetup"),
                )
            BusinessPayoutStage.Verifying ->
                Text(
                    text = "Verification pending…",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = Spacing.s3)
                            .testTag("businessPayments.verifying"),
                )
            BusinessPayoutStage.Onboarded ->
                GhostButton(
                    title = "Open Stripe Dashboard",
                    onClick = onOpenDashboard,
                    modifier = Modifier.fillMaxWidth().testTag("businessPayments.openDashboard"),
                )
        }
    }
}

@Composable
private fun StatusBanner(content: BusinessPaymentsContent) {
    val icon =
        when (content.stage) {
            BusinessPayoutStage.Onboarded -> PantopusIcon.CheckCircle
            BusinessPayoutStage.Verifying -> PantopusIcon.Clock
            BusinessPayoutStage.SetupIncomplete -> PantopusIcon.AlertCircle
            BusinessPayoutStage.NotConnected -> PantopusIcon.CreditCard
        }
    val accent = bannerAccent(content.stage)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(bannerBackground(content.stage))
                .padding(Spacing.s3)
                .semantics { contentDescription = "${content.headline}. ${content.subcopy}" }
                .testTag("businessPayments.statusBanner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, strokeWidth = 2f, tint = accent)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = content.headline,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(text = content.subcopy, color = PantopusColors.appTextSecondary, fontSize = 12.sp)
        }
    }
}

private fun bannerAccent(stage: BusinessPayoutStage): Color =
    when (stage) {
        BusinessPayoutStage.Onboarded -> PantopusColors.success
        BusinessPayoutStage.Verifying -> PantopusColors.info
        BusinessPayoutStage.SetupIncomplete -> PantopusColors.warning
        BusinessPayoutStage.NotConnected -> PantopusColors.business
    }

private fun bannerBackground(stage: BusinessPayoutStage): Color =
    when (stage) {
        BusinessPayoutStage.Onboarded -> PantopusColors.successBg
        BusinessPayoutStage.Verifying -> PantopusColors.infoBg
        BusinessPayoutStage.SetupIncomplete -> PantopusColors.warningBg
        BusinessPayoutStage.NotConnected -> PantopusColors.businessBg
    }

@Composable
private fun StatBox(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appBg)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.4.sp,
        )
        Text(text = value, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Footnote() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Shield,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.business,
        )
        Text(
            text =
                "This payout account is linked to your business entity. " +
                    "Payments from gigs and services are deposited to it.",
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
        )
    }
}

// ─── Shared toast ─────────────────────────────────────────────────────

/** Inline result banner used by the three C3 owner surfaces. */
@Composable
internal fun ActionToast(
    message: String,
    background: Color,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(message) {
        delay(TOAST_DURATION_MS)
        onDismiss()
    }
    Text(
        text = message,
        color = PantopusColors.appTextInverse,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .clip(RoundedCornerShape(Radii.md))
                .background(background)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("businessFinance.actionToast"),
    )
}

/**
 * Open a Stripe-hosted page in a Custom Tab, falling back to the system
 * browser. Same helper shape as the personal wallet flow.
 */
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
