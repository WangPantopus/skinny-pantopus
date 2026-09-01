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
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BalanceHero
import app.pantopus.android.ui.components.BalanceHeroSplitCell
import app.pantopus.android.ui.components.BalanceHeroTone
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling.payments.PaymentsComingSoon
import app.pantopus.android.ui.screens.wallet.ActivityDirection
import app.pantopus.android.ui.screens.wallet.WalletPayoutMethod
import app.pantopus.android.ui.screens.wallet.WalletTaxDocs
import app.pantopus.android.ui.screens.wallet.components.HoldBanner
import app.pantopus.android.ui.screens.wallet.components.PayoutMethodCard
import app.pantopus.android.ui.screens.wallet.components.TaxDocsRow
import app.pantopus.android.ui.screens.wallet.components.WalletPalette
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private val BIZ = SchedulingPillar.Business
private const val TOAST_MS = 2500L

@Composable
fun PayoutsEarningsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: PayoutsEarningsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val source by viewModel.source.collectAsStateWithLifecycle()
    val withdrawing by viewModel.withdrawing.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

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
                .testTag("scheduling.payoutsEarnings"),
    ) {
        WalletTopBar(onBack = onBack)
        Box(modifier = Modifier.weight(1f)) {
            when (val s = state) {
                PayoutsEarningsUiState.Loading ->
                    SchedulingLoadingSkeleton(Modifier.fillMaxSize().testTag("scheduling.payoutsEarnings.loading"))
                PayoutsEarningsUiState.NotEnabled -> PaymentsComingSoon(Modifier.fillMaxSize())
                is PayoutsEarningsUiState.Error ->
                    ErrorState(message = s.message, modifier = Modifier.fillMaxSize(), onRetry = viewModel::refresh)
                is PayoutsEarningsUiState.Loaded ->
                    PayoutsEarningsContent(
                        model = s.model,
                        source = source,
                        withdrawing = withdrawing,
                        onSetSource = viewModel::setSource,
                        onWithdraw = viewModel::withdraw,
                        onSetupPayouts = viewModel::setupPayouts,
                        onOpenDashboard = viewModel::openDashboard,
                    )
            }
            toast?.let { message ->
                LaunchedEffect(message) {
                    delay(TOAST_MS)
                    viewModel.clearToast()
                }
                EarningsToast(message = message, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 84.dp))
            }
        }
    }
}

@Composable
internal fun PayoutsEarningsContent(
    model: EarningsModel,
    source: EarningsSource,
    withdrawing: Boolean,
    onSetSource: (EarningsSource) -> Unit,
    onWithdraw: () -> Unit,
    onSetupPayouts: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    val rows = if (source == EarningsSource.All) model.allRows else model.allRows.filter { it.source == source }
    val onHold = model.payoutState == PayoutsEarningsViewModel.PayoutState.OnHold
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (onHold) {
                HoldBanner(
                    headline = "Your bank needs re-verifying",
                    body = "A 2-minute check unlocks payouts. Earnings keep landing — they're safe.",
                )
            }
            BalanceHero(
                overline = "Available to withdraw",
                amount = model.availableDisplay,
                currencyCode = "USD",
                split =
                    listOf(
                        BalanceHeroSplitCell(
                            icon = PantopusIcon.Clock,
                            overline = "Pending",
                            value = model.pendingDisplay,
                            note = model.pendingMeta,
                        ),
                        BalanceHeroSplitCell(
                            icon = PantopusIcon.TrendingUp,
                            overline = "This month",
                            value = model.monthDisplay,
                            note = model.monthMeta,
                        ),
                    ),
                tone = if (onHold) BalanceHeroTone.HoldTone else BalanceHeroTone.Default,
                holdHeadline = if (onHold) "Withdrawals paused" else null,
                holdBody = if (onHold) "Funds are safe while we re-verify your bank." else null,
            )
            FilterRow(active = source, onSelect = onSetSource)
            SectionOverline(
                text = if (source == EarningsSource.All) "Recent activity" else source.label,
                actionLabel = if (source == EarningsSource.All) null else "See all",
                onAction =
                    if (source == EarningsSource.All) {
                        null
                    } else {
                        { onSetSource(EarningsSource.All) }
                    },
            )
            if (rows.isEmpty()) {
                EmptyEarnings(source = source)
            } else {
                EarningsList(rows = rows)
            }
            SectionOverline("Payout method")
            PayoutMethodSection(
                payoutState = model.payoutState,
                onSetupPayouts = onSetupPayouts,
                onOpenDashboard = onOpenDashboard,
            )
            if (model.payoutState == PayoutsEarningsViewModel.PayoutState.Enabled && rows.isNotEmpty()) {
                SectionOverline("Taxes")
                TaxDocsRow(
                    docs = WalletTaxDocs(ready = false, bodyText = "Documents are issued in mid-January."),
                    onClick = onOpenDashboard,
                )
            }
            Spacer(Modifier.height(Spacing.s2))
        }
        WithdrawBar(
            model = model,
            withdrawing = withdrawing,
            onWithdraw = onWithdraw,
        )
    }
}

@Composable
private fun WalletTopBar(onBack: () -> Unit) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(36.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClickLabel = "Back", onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.ChevronLeft, "Back", size = 22.dp, tint = PantopusColors.appText)
            }
            Text(
                "Wallet",
                color = PantopusColors.appText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                modifier = Modifier.align(Alignment.Center),
            )
            PantopusIconImage(
                PantopusIcon.History,
                contentDescription = "Transaction history",
                size = 19.dp,
                tint = PantopusColors.appText,
                modifier = Modifier.align(Alignment.CenterEnd),
            )
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

@Composable
private fun FilterRow(
    active: EarningsSource,
    onSelect: (EarningsSource) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        EarningsSource.entries.forEach { option ->
            val selected = option == active
            val accent = if (option == EarningsSource.Booking) BIZ.accent else PantopusColors.primary600
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (selected) accent else PantopusColors.appSurface)
                        .then(
                            if (selected) {
                                Modifier
                            } else {
                                Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                            },
                        ).clickable { onSelect(option) }
                        .padding(horizontal = 12.dp, vertical = 7.dp)
                        .testTag("scheduling.payoutsEarnings.filter.${option.name.lowercase()}"),
            ) {
                Text(
                    text = option.label,
                    color = if (selected) Color.White else PantopusColors.appTextStrong,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun SectionOverline(
    text: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = text.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
        if (actionLabel != null && onAction != null) {
            Text(
                text = actionLabel,
                color = PantopusColors.primary600,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onAction).testTag("scheduling.payoutsEarnings.seeAll"),
            )
        }
    }
}

@Composable
private fun EarningsList(rows: List<EarningRow>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp)),
    ) {
        rows.forEachIndexed { index, row ->
            if (index == 0 || rows[index - 1].day != row.day) {
                Text(
                    text = row.day.uppercase(),
                    color = PantopusColors.appTextMuted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(start = 13.dp, top = Spacing.s2, bottom = 4.dp),
                )
            }
            EarningRowView(row = row, isLast = index == rows.lastIndex)
        }
    }
}

@Composable
private fun EarningRowView(
    row: EarningRow,
    isLast: Boolean,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 13.dp, vertical = 10.dp)
                .testTag("scheduling.payoutsEarnings.row.${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        val (tileBg, tileFg, icon) = rowVisuals(row)
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(tileBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon, null, size = 15.dp, tint = tileFg)
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = row.description,
                    color = PantopusColors.appText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                if (row.isPending) PendingChip()
            }
            Text(text = row.time, color = PantopusColors.appTextSecondary, fontSize = 10.5.sp, modifier = Modifier.padding(top = 1.dp))
        }
        Column(horizontalAlignment = Alignment.End) {
            val isOut = row.direction == ActivityDirection.Out
            val amountColor =
                when {
                    isOut -> PantopusColors.appTextStrong
                    row.isPending -> WalletPalette.amberDeep
                    else -> PantopusColors.success
                }
            Text(
                text = "${if (isOut) "−" else "+"}$${row.amount}",
                color = amountColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(text = row.statusLabel, color = PantopusColors.appTextMuted, fontSize = 9.5.sp, modifier = Modifier.padding(top = 1.dp))
        }
    }
    if (!isLast) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
    }
}

@Composable
private fun PendingChip() {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text("PENDING", color = WalletPalette.amberDeep, fontSize = 8.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.3.sp)
    }
}

private fun rowVisuals(row: EarningRow): Triple<Color, Color, PantopusIcon> =
    when {
        row.isFee -> Triple(PantopusColors.appSurfaceSunken, PantopusColors.appTextSecondary, PantopusIcon.Receipt)
        row.direction == ActivityDirection.Out ->
            Triple(PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong, PantopusIcon.Building2)
        row.source == EarningsSource.Packages -> Triple(PantopusColors.businessBg, PantopusColors.business, PantopusIcon.Package)
        row.source == EarningsSource.Booking -> Triple(PantopusColors.businessBg, PantopusColors.business, PantopusIcon.CalendarCheck)
        else -> Triple(PantopusColors.primary50, PantopusColors.primary600, PantopusIcon.DollarSign)
    }

@Composable
private fun EmptyEarnings(source: EarningsSource) {
    val noun = if (source == EarningsSource.All) "earnings" else source.label.lowercase()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .dashedBorder(PantopusColors.appBorderStrong, 14.dp)
                .padding(horizontal = 20.dp, vertical = 28.dp)
                .testTag("scheduling.payoutsEarnings.empty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(54.dp).clip(CircleShape).background(BIZ.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.CalendarCheck, null, size = 24.dp, strokeWidth = 1.8f, tint = BIZ.accent)
        }
        Text("No $noun yet", color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Your booking earnings will show up here next to your gigs.",
            color = PantopusColors.appTextSecondary,
            fontSize = 11.5.sp,
        )
    }
}

@Composable
private fun PayoutMethodSection(
    payoutState: PayoutsEarningsViewModel.PayoutState,
    onSetupPayouts: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    when (payoutState) {
        PayoutsEarningsViewModel.PayoutState.NotEnabled ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(PantopusColors.appSurface)
                        .dashedBorder(PantopusColors.appBorderStrong, 14.dp)
                        .clickable(onClick = onSetupPayouts)
                        .padding(horizontal = 13.dp, vertical = 12.dp)
                        .testTag("scheduling.payoutsEarnings.connectTile"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier = Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(BIZ.accentBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.CreditCard, null, size = 16.dp, tint = BIZ.accent)
                }
                Text(
                    "Connect Stripe to get paid out",
                    color = PantopusColors.appTextStrong,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.appTextMuted)
            }
        PayoutsEarningsViewModel.PayoutState.OnHold ->
            PayoutMethodCard(
                method =
                    WalletPayoutMethod(
                        bankLabel = "Bank account",
                        last4 = "••••",
                        bodyText = "Verification expired",
                        warn = true,
                    ),
                onManage = onOpenDashboard,
                onReverify = onSetupPayouts,
            )
        PayoutsEarningsViewModel.PayoutState.Enabled ->
            PayoutMethodCard(
                method =
                    WalletPayoutMethod(
                        bankLabel = "Bank account",
                        last4 = "••••",
                        bodyText = "Instant payout · 1–3 min",
                        warn = false,
                    ),
                onManage = onOpenDashboard,
                onReverify = onSetupPayouts,
            )
    }
}

@Composable
private fun WithdrawBar(
    model: EarningsModel,
    withdrawing: Boolean,
    onWithdraw: () -> Unit,
) {
    val canWithdraw = model.payoutState == PayoutsEarningsViewModel.PayoutState.Enabled && model.availableCents >= 100L
    var showConfirm by remember { mutableStateOf(false) }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Withdraw $${model.availableDisplay} to your bank?") },
            text = { Text("Instant payout · funds arrive in 1–3 minutes.") },
            confirmButton = {
                TextButton(onClick = {
                    showConfirm = false
                    onWithdraw()
                }) { Text("Withdraw $${model.availableDisplay}") }
            },
            dismissButton = { TextButton(onClick = { showConfirm = false }) { Text("Cancel") } },
        )
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        if (canWithdraw) {
            WithdrawButton(amount = model.availableDisplay, loading = withdrawing, onClick = { showConfirm = true })
        } else {
            WithdrawLocked(amount = model.availableDisplay)
            Text(
                text = lockedFootnote(model),
                color = PantopusColors.appTextSecondary,
                fontSize = 10.sp,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun WithdrawButton(
    amount: String,
    loading: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(PantopusColors.primary600)
                .clickable(enabled = !loading, onClick = onClick)
                .padding(horizontal = 16.dp)
                .testTag("scheduling.payoutsEarnings.withdrawButton"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(PantopusIcon.ArrowDownToLine, null, size = 16.dp, tint = Color.White)
            Text("Withdraw", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Text("$$amount", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun WithdrawLocked(amount: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(13.dp))
                .padding(horizontal = 16.dp)
                .testTag("scheduling.payoutsEarnings.withdrawLocked"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(PantopusIcon.Lock, null, size = 15.dp, tint = PantopusColors.appTextMuted)
            Text("Withdraw", color = PantopusColors.appTextMuted, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Text("$$amount", color = PantopusColors.appTextMuted, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

private fun lockedFootnote(model: EarningsModel): String =
    when (model.payoutState) {
        PayoutsEarningsViewModel.PayoutState.OnHold -> "Re-verify your bank above to unlock payouts."
        PayoutsEarningsViewModel.PayoutState.NotEnabled -> "Finish Stripe setup to withdraw"
        PayoutsEarningsViewModel.PayoutState.Enabled -> "Take a booking to start earning"
    }

@Composable
private fun EarningsToast(
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
                .testTag("scheduling.payoutsEarnings.toast"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(PantopusIcon.Check, null, size = 15.dp, tint = PantopusColors.success)
        Text(
            message,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            modifier = Modifier.width(240.dp),
        )
    }
}

/** Rounded dashed outline (1dp) — placeholder/drop-zone stroke (spec: `1px dashed borderStrong`). */
private fun Modifier.dashedBorder(
    color: Color,
    radius: androidx.compose.ui.unit.Dp,
): Modifier =
    drawBehind {
        val stroke = 1.dp.toPx()
        val r = radius.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(stroke / 2f, stroke / 2f),
            size = Size(size.width - stroke, size.height - stroke),
            cornerRadius = CornerRadius(r, r),
            style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f))),
        )
    }
