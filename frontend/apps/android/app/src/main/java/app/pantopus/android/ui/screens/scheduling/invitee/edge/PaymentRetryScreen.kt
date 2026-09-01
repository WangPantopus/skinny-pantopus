@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.BuildConfig
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.scheduling._shared.PaidGate
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling.invitee.edge.PaymentRetryViewModel.PaymentRetryUiState
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.stripe.android.paymentsheet.rememberPaymentSheet

const val PAYMENT_RETRY_TAG = "schedulingPaymentRetry"

/**
 * D6 — Payment failed / retry sheet. Behind the paid feature flag + Stripe TEST
 * mode. Reuses the app's Stripe PaymentSheet (collects the card, handles SCA);
 * the slot stays held while the invitee retries the `clientSecret`. Reassuring,
 * never-blame copy; "we never charge twice".
 */
@Composable
fun PaymentRetrySheet(
    manageToken: String,
    clientSecret: String?,
    onDismiss: () -> Unit,
    onPickAnotherTime: () -> Unit,
    sheetState: SheetState,
    modifier: Modifier = Modifier,
    onDone: () -> Unit = onDismiss,
    viewModel: PaymentRetryViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    val holdRemaining by viewModel.holdRemaining.collectAsStateWithLifecycle()

    val paymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onCheckoutOutcome(StripePaymentSheets.checkoutOutcome(result), manageToken)
        }

    androidx.compose.runtime.LaunchedEffect(manageToken) { viewModel.start(manageToken) }

    val retry: () -> Unit = retry@{
        val secret = clientSecret?.takeIf { it.isNotBlank() } ?: return@retry
        paymentSheet.presentWithPaymentIntent(
            paymentIntentClientSecret = secret,
            configuration =
                StripePaymentSheets.paymentConfiguration(
                    context = context,
                    customerId = null,
                    ephemeralKey = null,
                    publishableKey = BuildConfig.STRIPE_PUBLISHABLE_KEY,
                ),
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(PAYMENT_RETRY_TAG),
    ) {
        PaidGate(
            enabled = viewModel.flags.paidSchedulingEnabled,
            fallback = {
                Column(modifier = Modifier.fillMaxWidth().padding(Spacing.s6), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Online payments aren't enabled yet.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            },
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                when (val s = state) {
                    is PaymentRetryUiState.Loading -> SchedulingLoadingSkeleton(rows = 2)
                    is PaymentRetryUiState.Declined ->
                        DeclinedBody(
                            s,
                            holdLabel = viewModel.holdLabel(holdRemaining),
                            onRetry = retry,
                            onPickAnotherTime = onPickAnotherTime,
                        )
                    is PaymentRetryUiState.Timeout ->
                        TimeoutBody(
                            s,
                            holdLabel = viewModel.holdLabel(holdRemaining),
                            onRecheck = { viewModel.recheck(manageToken) },
                            onPickAnotherTime = onPickAnotherTime,
                        )
                    is PaymentRetryUiState.HoldExpired -> HoldExpiredBody(onPickAnotherTime = onPickAnotherTime, onNotNow = onDismiss)
                    is PaymentRetryUiState.Succeeded -> SucceededBody(s, onDone = onDone)
                    is PaymentRetryUiState.Error -> ErrorBody(s.message, onRetry = { viewModel.load(manageToken) })
                }
            }
        }
    }
}

@Composable
private fun DeclinedBody(
    state: PaymentRetryUiState.Declined,
    holdLabel: String,
    onRetry: () -> Unit,
    onPickAnotherTime: () -> Unit,
) {
    EdgeHalo(
        tone = EdgeTone.Error,
        icon = PantopusIcon.CreditCard,
        title = "Your payment didn't go through",
        body = "${state.message} Nothing was charged.",
    )
    // Design FrameDeclined: HoldChip shows time-anchored label with live countdown.
    val chipLabel =
        if (state.slotTime != null) {
            "Holding your ${state.slotTime} time for $holdLabel"
        } else {
            "Your time is still held · $holdLabel"
        }
    CenteredChip(tone = EdgeTone.Warn, icon = PantopusIcon.Timer, label = chipLabel)
    // Spec frame 1 surfaces the declined saved card between the halo and the CTAs.
    // The owner-side payment block carries no brand/PAN, so we show a neutral
    // card row with a Declined pill rather than fabricate a masked number.
    EdgeSavedCardRow(
        brand = CardBrand.Generic,
        label = "Your card",
        sub = "Declined · ${state.message}",
        declined = true,
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PrimaryButton(title = "Try another card", onClick = onRetry)
        GhostButton(title = "Use a different time", onClick = onPickAnotherTime)
    }
    ReassureNote(icon = PantopusIcon.ShieldCheck, text = "Your time is still held. Try another card.")
}

@Composable
private fun TimeoutBody(
    state: PaymentRetryUiState.Timeout,
    holdLabel: String,
    onRecheck: () -> Unit,
    onPickAnotherTime: () -> Unit,
) {
    EdgeHalo(
        tone = EdgeTone.Info,
        icon = PantopusIcon.CreditCard,
        title = "We're not sure that went through",
        body = "The connection dropped before we heard back. We won't double-charge you — check again to see where it landed.",
    )
    // Design FrameTimeout (payment-failed-frames.jsx:267): HoldChip between halo and InfoCalloutCard.
    val chipLabel =
        if (state.slotTime != null) {
            "Holding your ${state.slotTime} time for $holdLabel"
        } else {
            "Your time is still held · $holdLabel"
        }
    CenteredChip(tone = EdgeTone.Warn, icon = PantopusIcon.Timer, label = chipLabel)
    InfoCalloutCard(text = "If the first try did go through, checking again won't charge you a second time.")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PrimaryButton(title = "Check again", onClick = onRecheck)
        GhostButton(title = "Use a different time", onClick = onPickAnotherTime)
    }
    ReassureNote(icon = PantopusIcon.ShieldCheck, text = "We never charge twice.")
}

@Composable
private fun HoldExpiredBody(
    onPickAnotherTime: () -> Unit,
    onNotNow: () -> Unit,
) {
    EdgeHalo(
        tone = EdgeTone.Error,
        icon = PantopusIcon.CreditCard,
        title = "Your payment didn't go through",
        body = "Your time opened back up while we waited. You can grab a new one — still nothing charged.",
    )
    CenteredChip(tone = EdgeTone.Error, icon = PantopusIcon.Timer, label = "Hold released")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PrimaryButton(title = "Pick a time again", onClick = onPickAnotherTime)
        GhostButton(title = "Not now", onClick = onNotNow)
    }
    ReassureNote(icon = PantopusIcon.ShieldCheck, text = "We never charge twice.")
}

@Composable
private fun SucceededBody(
    state: PaymentRetryUiState.Succeeded,
    onDone: () -> Unit,
) {
    EdgeHalo(
        tone = EdgeTone.Success,
        icon = PantopusIcon.CheckCircle,
        title = if (state.processing) "Payment received" else "Payment went through",
        body =
            if (state.processing) {
                "We're processing your payment — your booking is confirmed."
            } else {
                "Your card worked. You're all set."
            },
    )
    CenteredChip(
        tone = EdgeTone.Success,
        icon = PantopusIcon.BadgeCheck,
        label = if (state.processing) "${state.amountLabel} · processing" else "Paid ${state.amountLabel} · receipt on its way",
    )
    SuccessAutoAdvance()
    GhostButton(title = "Done", onClick = onDone)
    ReassureNote(icon = PantopusIcon.Lock, text = "Payments secured by Stripe")
}

@Composable
private fun ErrorBody(
    message: String,
    onRetry: () -> Unit,
) {
    EdgeHalo(tone = EdgeTone.Error, icon = PantopusIcon.AlertCircle, title = "Something went wrong", body = message)
    PrimaryButton(title = "Try again", onClick = onRetry)
}

@Composable
private fun ReassureNote(
    icon: PantopusIcon,
    text: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(end = Spacing.s1),
        )
        Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
    }
}

@Composable
private fun CenteredChip(
    tone: EdgeTone,
    icon: PantopusIcon,
    label: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
    ) {
        EdgeStatusChip(tone = tone, icon = icon, label = label)
    }
}

/**
 * The timeout info callout (spec frame 3): a framed info-tone block with a
 * shield-check disc and the full reassurance sentence — not a compact chip.
 */
@Composable
private fun InfoCalloutCard(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.info,
            modifier = Modifier.padding(top = 1.dp),
        )
        Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.info)
    }
}

/**
 * The success auto-advance morph (spec frame 4): a success-tone progress bar
 * above a pulsing "Confirming your booking" indicator.
 */
@Composable
private fun SuccessAutoAdvance() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(0.7f)
                    .height(5.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(0.62f)
                        .height(5.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.success),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            val transition = rememberInfiniteTransition(label = "payPulse")
            val pulseAlpha by transition.animateFloat(
                initialValue = 1f,
                targetValue = 0.3f,
                animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
                label = "payPulseAlpha",
            )
            Box(
                modifier =
                    Modifier
                        .size(6.dp)
                        .alpha(pulseAlpha)
                        .clip(CircleShape)
                        .background(PantopusColors.success),
            )
            Text(
                text = "Confirming your booking",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
