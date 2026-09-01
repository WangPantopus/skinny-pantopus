@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "FunctionNaming",
    "TooManyFunctions",
    "LongParameterList",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.wallet.scheduling

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingMiniToggle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling.payments.PaymentsComingSoon
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.SchedulingPalette
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private val PILLAR = SchedulingPillar.Business
private const val TOAST_MS = 2500L

// Stripe's brand indigo — a fixed external brand color the Pantopus design
// system does not carry, sourced from the theme-layer SchedulingPalette per
// the tokens-only rule. Matches spec StripeBadge bg `C.stripe` and iOS stripeBrand.
private val StripeBrand = SchedulingPalette.stripeBrand

@Composable
fun PaymentsSetupScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: PaymentsSetupViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val connecting by viewModel.connecting.collectAsStateWithLifecycle()
    val actionMessage by viewModel.actionMessage.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var awaitingReturn by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            if (event.refreshOnReturn) awaitingReturn = true
            runCatching { openStripeHostedUrl(context, event.url) }
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, e ->
                if (e == Lifecycle.Event.ON_RESUME && awaitingReturn) {
                    awaitingReturn = false
                    viewModel.onReturnFromConnect()
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("scheduling.paymentsSetup"),
    ) {
        SchedulingTopBar(title = "Payments", onLeading = onBack)
        Box(modifier = Modifier.weight(1f)) {
            when (val s = state) {
                PaymentsSetupUiState.Loading ->
                    SchedulingLoadingSkeleton(Modifier.fillMaxSize().testTag("scheduling.payments.loading"))
                PaymentsSetupUiState.NotEnabled -> PaymentsComingSoon(Modifier.fillMaxSize())
                PaymentsSetupUiState.NotApplicable -> PaymentsNotApplicable(Modifier.fillMaxSize())
                is PaymentsSetupUiState.Error ->
                    ErrorState(
                        message = s.message,
                        modifier = Modifier.fillMaxSize().testTag("scheduling.payments.error"),
                        onRetry = viewModel::refresh,
                    )
                is PaymentsSetupUiState.Loaded ->
                    PaymentsSetupContent(
                        model = s.model,
                        connecting = connecting,
                        onConnect = viewModel::beginConnect,
                        onOpenDashboard = viewModel::openDashboard,
                    )
            }
            actionMessage?.let { message ->
                LaunchedEffect(message) {
                    delay(TOAST_MS)
                    viewModel.clearActionMessage()
                }
                PaymentsActionToast(message = message, modifier = Modifier.align(Alignment.BottomCenter))
            }
        }
    }
}

@Composable
internal fun PaymentsSetupContent(
    model: PaymentsModel,
    connecting: Boolean,
    onConnect: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (model.justReturned) ReturnedBanner()
        Text(
            text = introCopy(model.setup),
            color = PantopusColors.appTextSecondary,
            fontSize = 11.5.sp,
            modifier = Modifier.padding(horizontal = Spacing.s1),
        )
        StatusHero(model = model)
        noteFor(model.setup)?.let { (tone, icon, text) -> NoteBanner(tone, icon, text) }
        AccountCard(
            model = model,
            connecting = connecting,
            onConnect = onConnect,
            onOpenDashboard = onOpenDashboard,
        )
        TaxCard(model = model, onOpenDashboard = onOpenDashboard)
        Spacer(Modifier.height(Spacing.s4))
    }
}

@Composable
private fun ReturnedBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                .padding(horizontal = 13.dp, vertical = 12.dp)
                .testTag("scheduling.paymentsSetup.returnedBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(CircleShape).background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Check, null, size = 18.dp, strokeWidth = 3f, tint = Color.White)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("You're set up to take payments.", color = PantopusColors.success, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text("Welcome back from Stripe.", color = PantopusColors.success.copy(alpha = 0.85f), fontSize = 11.sp)
        }
    }
}

@Composable
private fun StatusHero(model: PaymentsModel) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(13.dp)
                .testTag("scheduling.paymentsSetup.hero"),
        verticalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(34.dp).clip(RoundedCornerShape(9.dp)).background(StripeBrand),
                contentAlignment = Alignment.Center,
            ) {
                Text("S", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
            }
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(headlineFor(model.setup), color = PantopusColors.appText, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                    StatusChip(model.setup)
                }
                Text(
                    text = bodyFor(model.setup),
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            ReadyPill("Charges", model.chargesPill, Modifier.weight(1f))
            ReadyPill("Payouts", model.payoutsPill, Modifier.weight(1f))
            ReadyPill("Details", model.detailsPill, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ReadyPill(
    label: String,
    state: PaymentsSetupViewModel.PillState,
    modifier: Modifier = Modifier,
) {
    val (bg, fg, icon) =
        when (state) {
            PaymentsSetupViewModel.PillState.On -> Triple(PantopusColors.successBg, PantopusColors.success, PantopusIcon.Check)
            PaymentsSetupViewModel.PillState.Off ->
                Triple(PantopusColors.appSurfaceSunken, PantopusColors.appTextMuted, PantopusIcon.Minus)
            PaymentsSetupViewModel.PillState.Warn -> Triple(PantopusColors.warningBg, PantopusColors.warning, PantopusIcon.Clock)
        }
    Column(
        modifier = modifier.clip(RoundedCornerShape(10.dp)).background(bg).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(icon, null, size = 14.dp, strokeWidth = 2.6f, tint = fg)
        Text(label.uppercase(), color = fg, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun StatusChip(setup: PaymentsSetupViewModel.Setup) {
    val (text, bg, fg, icon) =
        when (setup) {
            PaymentsSetupViewModel.Setup.NotConnected ->
                ChipSpec("Off", PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong, null)
            PaymentsSetupViewModel.Setup.Incomplete ->
                ChipSpec("In review", PantopusColors.warningBg, PantopusColors.warning, null)
            PaymentsSetupViewModel.Setup.Restricted ->
                ChipSpec("Restricted", PantopusColors.errorBg, PantopusColors.error, null)
            PaymentsSetupViewModel.Setup.Ready ->
                ChipSpec("Connected", PantopusColors.successBg, PantopusColors.success, PantopusIcon.Check)
        }
    Row(
        modifier = Modifier.clip(RoundedCornerShape(Radii.pill)).background(bg).padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        icon?.let { PantopusIconImage(it, null, size = 10.dp, tint = fg) }
        Text(text.uppercase(), color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

private data class ChipSpec(val text: String, val bg: Color, val fg: Color, val icon: PantopusIcon?)

@Composable
private fun NoteBanner(
    tone: NoteTone,
    icon: PantopusIcon,
    text: String,
) {
    val (bg, fg, borderColor) =
        if (tone == NoteTone.Warning) {
            Triple(PantopusColors.warningBg, PantopusColors.warning, PantopusColors.warningLight)
        } else {
            Triple(PantopusColors.errorBg, PantopusColors.error, PantopusColors.errorLight)
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .border(1.dp, borderColor, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 11.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon, null, size = 15.dp, strokeWidth = 2.4f, tint = fg)
        Text(text, color = fg, fontSize = 11.5.sp, fontWeight = FontWeight.Medium)
    }
}

private enum class NoteTone { Warning, Error }

@Composable
private fun AccountCard(
    model: PaymentsModel,
    connecting: Boolean,
    onConnect: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    val connected = model.isConnected
    Column {
        SectionOverline("Account")
        Spacer(Modifier.height(Spacing.s2))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
        ) {
            PaymentRow(
                icon = PantopusIcon.DollarSign,
                label = "Default currency",
                sub = if (connected) "USD" else null,
                trailing = if (connected) RowTrailing.Chevron else RowTrailing.Dash,
                onClick = if (connected) onOpenDashboard else null,
                divider = true,
            )
            PaymentRow(
                icon = PantopusIcon.Type,
                label = "Statement descriptor",
                sub = if (connected) "Managed on Stripe" else null,
                subAsMonoChip = connected,
                trailing = if (connected) RowTrailing.Chevron else RowTrailing.Dash,
                onClick = if (connected) onOpenDashboard else null,
                divider = connected || model.setup != PaymentsSetupViewModel.Setup.Ready,
            )
            if (connected) {
                PaymentRow(
                    icon = PantopusIcon.Wallet,
                    label = "Payouts",
                    sub = "Managed on Stripe",
                    trailing = RowTrailing.Chevron,
                    onClick = onOpenDashboard,
                    divider = model.setup != PaymentsSetupViewModel.Setup.Ready,
                )
            }
            if (model.setup != PaymentsSetupViewModel.Setup.Ready) {
                ConnectActionRow(setup = model.setup, connecting = connecting, onClick = onConnect)
            }
        }
    }
}

@Composable
private fun TaxCard(
    model: PaymentsModel,
    onOpenDashboard: () -> Unit,
) {
    val connected = model.isConnected
    Column {
        SectionOverline("Tax")
        Spacer(Modifier.height(Spacing.s2))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
        ) {
            PaymentRow(
                icon = PantopusIcon.Percent,
                label = "Collect tax",
                sub = null,
                trailing = if (connected) RowTrailing.Toggle(on = true) else RowTrailing.Dash,
                onClick = null,
                divider = true,
            )
            PaymentRow(
                icon = PantopusIcon.FileText,
                label = "Tax rate · Stripe Tax",
                sub = if (connected) "automatic" else null,
                trailing = if (connected) RowTrailing.Chevron else RowTrailing.Dash,
                onClick = if (connected) onOpenDashboard else null,
                divider = false,
            )
        }
    }
}

/** How the trailing slot of a [PaymentRow] renders. */
private sealed interface RowTrailing {
    /** Right chevron (connected, tappable rows). */
    data object Chevron : RowTrailing

    /** Em-dash placeholder (gated / not connected). */
    data object Dash : RowTrailing

    /** A pillar-tinted on-toggle (Collect tax, connected). */
    data class Toggle(val on: Boolean) : RowTrailing
}

@Composable
private fun PaymentRow(
    icon: PantopusIcon,
    label: String,
    sub: String?,
    trailing: RowTrailing,
    divider: Boolean,
    modifier: Modifier = Modifier,
    subAsMonoChip: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon, null, size = 16.dp, tint = PantopusColors.appTextStrong)
        }
        // Label over an optional left-aligned sub line (or mono Receipt chip).
        Column(modifier = Modifier.weight(1f)) {
            Text(label, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            if (sub != null) {
                if (subAsMonoChip) {
                    ReceiptChip(value = sub, modifier = Modifier.padding(top = 3.dp))
                } else {
                    Text(
                        sub,
                        color = PantopusColors.appTextSecondary,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }
        }
        when (trailing) {
            RowTrailing.Chevron ->
                PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.appTextMuted)
            RowTrailing.Dash -> Text("—", color = PantopusColors.appTextMuted, fontSize = 13.sp)
            is RowTrailing.Toggle -> SchedulingMiniToggle(isOn = trailing.on, accent = PILLAR.accent)
        }
    }
    if (divider) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).padding(start = 12.dp).background(PantopusColors.appBorderSubtle))
    }
}

/**
 * Spec `Receipt` chip: a sunken monospace pill with a receipt glyph used as the
 * statement-descriptor sub line. The descriptor value is managed on Stripe and
 * not exposed by the status DTO, so the literal demo value ("MARLOW CO") is not
 * surfaced; this renders the structural mono chip around the available copy.
 */
@Composable
private fun ReceiptChip(
    value: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 7.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(PantopusIcon.Receipt, null, size = 10.dp, tint = PantopusColors.appTextStrong)
        Text(
            value,
            color = PantopusColors.appTextStrong,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun ConnectActionRow(
    setup: PaymentsSetupViewModel.Setup,
    connecting: Boolean,
    onClick: () -> Unit,
) {
    val (label, icon) =
        when (setup) {
            PaymentsSetupViewModel.Setup.NotConnected -> "Connect Stripe" to PantopusIcon.ExternalLink
            PaymentsSetupViewModel.Setup.Incomplete -> "Resume verification" to PantopusIcon.ArrowRight
            PaymentsSetupViewModel.Setup.Restricted -> "Finish verification" to PantopusIcon.ArrowRight
            PaymentsSetupViewModel.Setup.Ready -> "" to PantopusIcon.ArrowRight
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = !connecting, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 12.dp)
                .testTag("scheduling.paymentsSetup.connectAction"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon, null, size = 16.dp, tint = PantopusColors.primary600)
        }
        Text(label, color = PantopusColors.primary600, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (connecting) {
            CircularProgressIndicator(color = PantopusColors.primary600, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
        } else {
            PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.primary600)
        }
    }
}

@Composable
private fun SectionOverline(text: String) {
    Text(
        text = text.uppercase(),
        color = PILLAR.accent,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        modifier = Modifier.padding(start = Spacing.s1),
    )
}

@Composable
private fun PaymentsNotApplicable(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .padding(Spacing.s5)
                .testTag("scheduling.payments.notApplicable"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterVertically),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.CreditCard, null, size = 24.dp, tint = PantopusColors.appTextStrong)
        }
        Text("Payments are set up per person", color = PantopusColors.appText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Text(
            "Homes don't take payments directly. Each member connects Stripe from their personal scheduling settings.",
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun PaymentsActionToast(
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .padding(Spacing.s4)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = 16.dp, vertical = 10.dp)
                .testTag("scheduling.paymentsSetup.actionToast"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(PantopusIcon.AlertCircle, null, size = 15.dp, tint = PantopusColors.appTextInverse)
        Text(
            message,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            modifier = Modifier.width(240.dp),
        )
    }
}

// ─── Setup-dependent copy ───────────────────────────────────────────────────

private fun introCopy(setup: PaymentsSetupViewModel.Setup): String =
    when (setup) {
        PaymentsSetupViewModel.Setup.NotConnected, PaymentsSetupViewModel.Setup.Ready ->
            "Connect Stripe to take payments and get paid out."
        else -> "Verification keeps your payouts flowing."
    }

private fun headlineFor(setup: PaymentsSetupViewModel.Setup): String =
    when (setup) {
        PaymentsSetupViewModel.Setup.NotConnected -> "Not connected"
        PaymentsSetupViewModel.Setup.Incomplete -> "Setup unfinished"
        PaymentsSetupViewModel.Setup.Restricted -> "Action needed"
        PaymentsSetupViewModel.Setup.Ready -> "Stripe"
    }

private fun bodyFor(setup: PaymentsSetupViewModel.Setup): String =
    when (setup) {
        PaymentsSetupViewModel.Setup.NotConnected -> "Pantopus uses Stripe to charge for bookings and pay you out."
        PaymentsSetupViewModel.Setup.Incomplete -> "A few details are still needed before you can charge."
        PaymentsSetupViewModel.Setup.Restricted -> "Charges still work, but payouts are paused until you verify."
        PaymentsSetupViewModel.Setup.Ready -> "Charges and payouts are on. You're ready to take bookings."
    }

private fun noteFor(setup: PaymentsSetupViewModel.Setup): Triple<NoteTone, PantopusIcon, String>? =
    when (setup) {
        PaymentsSetupViewModel.Setup.Incomplete ->
            Triple(NoteTone.Warning, PantopusIcon.AlertTriangle, "Finish setup on Stripe to start charging.")
        PaymentsSetupViewModel.Setup.Restricted ->
            Triple(NoteTone.Error, PantopusIcon.ShieldAlert, "Stripe needs more info to keep payouts on.")
        else -> null
    }
