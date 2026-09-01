@file:Suppress("PackageNaming", "UNUSED_PARAMETER", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.SchedulingPalette
import app.pantopus.android.ui.theme.Spacing

private val SETTING_ICON_BOX = 32.dp

@Composable
fun BusinessSchedulingSettingsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BusinessSchedulingSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showTz by remember { mutableStateOf(false) }
    var tzQuery by remember { mutableStateOf("") }

    androidx.compose.runtime.LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        BizTopBar(title = "Booking", onBack = onBack)
        when (val s = state) {
            BusinessSchedulingSettingsViewModel.UiState.Loading ->
                BizSettingsSkeleton()
            is BusinessSchedulingSettingsViewModel.UiState.Error ->
                ErrorState(message = s.message, modifier = Modifier.fillMaxSize(), onRetry = viewModel::refresh)
            is BusinessSchedulingSettingsViewModel.UiState.Loaded ->
                SettingsBody(
                    content = s.content,
                    viewModel = viewModel,
                    onNavigate = onNavigate,
                    onOpenTimezone = { showTz = true },
                )
        }
    }

    if (showTz) {
        val content = (state as? BusinessSchedulingSettingsViewModel.UiState.Loaded)?.content
        if (content != null) {
            val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            app.pantopus.android.ui.screens.scheduling._shared.TimezonePickerSheet(
                options = remember { defaultTimezoneOptions() },
                selectedId = content.timezone,
                query = tzQuery,
                onQueryChange = { tzQuery = it },
                onSelect = {
                    viewModel.saveTimezone(it.id)
                    showTz = false
                },
                onDismiss = { showTz = false },
                sheetState = sheetState,
                detectedId = java.time.ZoneId.systemDefault().id,
                accent = bizAccent,
            )
        }
    }
}

@Composable
private fun SettingsBody(
    content: BusinessSchedulingSettingsViewModel.Content,
    viewModel: BusinessSchedulingSettingsViewModel,
    onNavigate: (String) -> Unit,
    onOpenTimezone: () -> Unit,
) {
    val gated = content.gated
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Defaults flow into each service — change them per service anytime.",
            style = PantopusTextStyle.caption,
            fontSize = 11.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s1),
        )

        ConfirmationCard(
            approve = content.confirmationApprove,
            gated = gated,
            onSelect = { viewModel.setConfirmation(it) },
            onOpenApprovalWindow = { if (!gated) onNavigate(viewModel.schedulingDefaultsRoute()) },
        )

        SettingsGroup(title = "Scheduling", dim = gated) {
            SettingsRow(
                icon = PantopusIcon.Clock,
                label = "Minimum notice",
                sub = content.minNoticeValue,
                showDivider = true,
                gated = gated,
            ) {
                if (!gated) onNavigate(viewModel.schedulingDefaultsRoute())
            }
            SettingsRow(
                icon = PantopusIcon.CalendarDays,
                label = "Booking horizon",
                sub = content.horizonValue,
                showDivider = true,
                gated = gated,
            ) {
                if (!gated) onNavigate(viewModel.schedulingDefaultsRoute())
            }
            SettingsRow(
                icon = PantopusIcon.ArrowRightLeft,
                label = "Buffers",
                sub = content.buffersValue,
                showDivider = true,
                gated = gated,
            ) {
                if (!gated) onNavigate(viewModel.schedulingDefaultsRoute())
            }
            SettingsRow(icon = PantopusIcon.Globe, label = "Time zone", sub = content.timezone, showDivider = false, gated = gated) {
                if (!gated) onOpenTimezone()
            }
        }

        if (!gated) {
            SettingsGroup(title = "Policy") {
                SettingsRow(
                    icon = PantopusIcon.Shield,
                    label = "Cancellation & no-show policy",
                    sub = content.cancellationValue,
                    showDivider = false,
                    gated = false,
                ) { onNavigate(viewModel.cancellationPolicyRoute()) }
            }
        }

        SettingsGroup(title = "Notifications", dim = gated) {
            ToggleRow(
                icon = PantopusIcon.Bell,
                label = "Notify the owner",
                on = content.notifyOwner,
                enabled = !gated,
                showDivider = true,
                onToggle = viewModel::setNotifyOwner,
            )
            ToggleRow(
                icon = PantopusIcon.UserCheck,
                label = "Notify the assigned member",
                on = content.notifyAssigned,
                enabled = !gated,
                showDivider = false,
                onToggle = viewModel::setNotifyAssigned,
            )
        }

        if (content.showPayments) {
            SettingsGroup(title = "Payments") {
                PaymentsRow(
                    connected = content.paymentsConnected,
                    sub = content.payoutSub,
                    onOpen = { onNavigate(viewModel.paymentsRoute()) },
                )
            }
            if (content.paymentsRequired) {
                BizNote(
                    text = "Connect payments to charge for services.",
                    tone = BizNoteTone.Warning,
                    icon = PantopusIcon.AlertTriangle,
                )
            }
        }

        if (gated) {
            BizLockNote("Only admins can change booking settings.")
        }
    }
}

@Composable
private fun ConfirmationCard(
    approve: Boolean,
    gated: Boolean,
    onSelect: (Boolean) -> Unit,
    onOpenApprovalWindow: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        BizOverline("Confirmation")
        BizCard {
            Column(modifier = Modifier.padding(vertical = Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Box(
                        modifier = Modifier.size(SETTING_ICON_BOX).clip(RoundedCornerShape(Radii.md)).background(bizAccentBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(icon = PantopusIcon.CalendarCheck, contentDescription = null, size = 16.dp, tint = bizAccent)
                    }
                    Text(
                        text = "New bookings",
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
                Box(modifier = Modifier.alpha(if (gated) 0.55f else 1f)) {
                    BizSegmented(
                        options = listOf("Auto-confirm", "Approve each request"),
                        selectedIndex = if (approve) 1 else 0,
                        onSelect = { onSelect(it == 1) },
                        enabled = !gated,
                    )
                }
                Text(
                    text =
                        if (approve) {
                            "You approve each request before it lands on your calendar."
                        } else {
                            "Auto-confirm sends the booking straight to your calendar."
                        },
                    style = PantopusTextStyle.caption,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
                if (approve) {
                    BizRowDivider()
                    SettingsRow(
                        icon = PantopusIcon.Hourglass,
                        label = "Approval window",
                        sub = "24h to respond",
                        showDivider = false,
                        gated = gated,
                        onClick = onOpenApprovalWindow,
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingsGroup(
    title: String,
    dim: Boolean = false,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.alpha(if (dim) 0.7f else 1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        BizOverline(title)
        BizCard { content() }
    }
}

@Composable
private fun SettingsRow(
    icon: PantopusIcon,
    label: String,
    sub: String,
    showDivider: Boolean,
    gated: Boolean,
    onClick: () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(enabled = !gated, onClick = onClick).padding(vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SettingIcon(icon)
            Column(modifier = Modifier.weight(1f)) {
                Text(text = label, style = PantopusTextStyle.small, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(
                    text = sub,
                    style = PantopusTextStyle.caption,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (!gated) BizChevron()
        }
        if (showDivider) BizRowDivider()
    }
}

@Composable
private fun ToggleRow(
    icon: PantopusIcon,
    label: String,
    on: Boolean,
    enabled: Boolean,
    showDivider: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SettingIcon(icon)
            Text(
                text = label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            BizToggle(on = on, onToggle = onToggle, enabled = enabled)
        }
        if (showDivider) BizRowDivider()
    }
}

// Spec C.stripeBg / C.stripe are Stripe-brand swatches, not design tokens —
// sourced from the theme-layer SchedulingPalette so the disc reads as the
// Stripe mark without a hex literal in feature code.
private val StripeDiscBg = SchedulingPalette.stripeBg
private val StripeDiscGlyph = SchedulingPalette.stripeBrand

@Composable
private fun PaymentsRow(
    connected: Boolean,
    sub: String,
    onOpen: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(SETTING_ICON_BOX).clip(RoundedCornerShape(Radii.md)).background(StripeDiscBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CreditCard, contentDescription = null, size = 16.dp, tint = StripeDiscGlyph)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Stripe payments",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                style = PantopusTextStyle.caption,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (connected) {
            BizChip(text = "Connected", tone = BizChipTone.Success, icon = PantopusIcon.Check)
            BizChevron(modifier = Modifier.padding(start = Spacing.s2))
        } else {
            Box(
                modifier =
                    Modifier
                        .height(28.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onOpen)
                        .padding(horizontal = 13.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Connect",
                    style = PantopusTextStyle.caption,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun SettingIcon(icon: PantopusIcon) {
    Box(
        modifier = Modifier.size(SETTING_ICON_BOX).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextStrong)
    }
}

/**
 * Loading skeleton mirroring `bizsettings-frames.jsx` FrameLoading and iOS
 * BizSettingsSkeleton: three [ShimGroup]s of 1 / 4 / 2 rows, each row a 32dp
 * disc + two stacked text shimmers inside a card, with a 90x9 overline shimmer
 * above each group.
 */
@Composable
private fun BizSettingsSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ShimGroup(rows = 1)
        ShimGroup(rows = 4)
        ShimGroup(rows = 2)
    }
}

@Composable
private fun ShimGroup(rows: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Shimmer(width = 90.dp, height = 9.dp, cornerRadius = Radii.xs, modifier = Modifier.padding(horizontal = Spacing.s1))
        BizCard {
            Column {
                repeat(rows) { i ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 13.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        Shimmer(width = SETTING_ICON_BOX, height = SETTING_ICON_BOX, cornerRadius = Radii.md)
                        Column(modifier = Modifier.weight(1f)) {
                            Shimmer(width = 130.dp, height = 11.dp, cornerRadius = Radii.xs)
                            Shimmer(
                                width = 170.dp,
                                height = 8.dp,
                                cornerRadius = Radii.xs,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                        }
                    }
                    if (i != rows - 1) BizRowDivider()
                }
            }
        }
    }
}
