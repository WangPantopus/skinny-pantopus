@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.settings

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun SchedulingSettingsRootScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: SchedulingSettingsRootViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var showReset by remember { mutableStateOf(false) }
    var showDisable by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(Unit) { viewModel.load() }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appSurfaceMuted)) {
        Column(modifier = Modifier.fillMaxSize()) {
            SettingsTopBar(title = "Booking settings", onBack = onBack)
            when (val s = state) {
                SchedulingSettingsUiState.Loading -> SettingsSkeleton()
                is SchedulingSettingsUiState.Error -> SettingsError(message = s.message, onRetry = viewModel::refresh)
                is SchedulingSettingsUiState.Loaded ->
                    SettingsBody(
                        data = s.data,
                        onNavigate = onNavigate,
                        onReset = { showReset = true },
                        onDisable = { showDisable = true },
                        vm = viewModel,
                    )
            }
        }
        toast?.let { SettingsSavedToast(message = it, modifier = Modifier.align(Alignment.TopCenter)) }
    }

    if (showReset) {
        ConfirmDialog(
            title = "Reset booking link?",
            message = "Your current link will stop working and a new one will be generated.",
            confirm = "Reset link",
            onConfirm = {
                showReset = false
                viewModel.resetSlug()
            },
            onDismiss = { showReset = false },
        )
    }
    if (showDisable) {
        ConfirmDialog(
            title = "Disable scheduling?",
            message = "Your booking page goes offline. Existing bookings stay on your calendar.",
            confirm = "Disable scheduling",
            onConfirm = {
                showDisable = false
                viewModel.disableScheduling()
            },
            onDismiss = { showDisable = false },
        )
    }
}

@Composable
private fun SettingsBody(
    data: SettingsData,
    onNavigate: (String) -> Unit,
    onReset: () -> Unit,
    onDisable: () -> Unit,
    vm: SchedulingSettingsRootViewModel,
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = Spacing.s8)) {
        if (data.isBusiness) {
            SettingsGroup(title = "Team", accent = PantopusColors.business) {
                SettingsRow(
                    label = "Team & seats",
                    sublabel = "4 members · 2 booking seats",
                    showDivider = true,
                    onClick = { onNavigate(vm.teamRoute()) },
                )
                SettingsNewBookingsBlock(accent = PantopusColors.business)
            }
        }
        val accent = data.pillar.accent
        val accentBg = data.pillar.accentBg
        SettingsGroup(title = "Automation", accent = accent, helper = "Reminders go out automatically before each booking.") {
            SettingsRow(
                label = "Default reminders",
                sublabel = if (data.isFresh) null else (data.remindersValue ?: "1 day · 1 hr"),
                onClick = { onNavigate(vm.remindersRoute()) },
                trailing = {
                    if (data.isFresh) SettingsChipChevron("Off", SettingsChipTone.Warning) else SettingsChevron()
                },
            )
            SettingsRow(
                label = "Workflows & follow-ups",
                sublabel = if (data.isFresh) "No workflows yet" else null,
                onClick = { onNavigate(vm.workflowsRoute()) },
                trailing = {
                    if (data.isFresh) {
                        SettingsChipChevron("Set up", SettingsChipTone.Warning, PantopusIcon.Plus)
                    } else {
                        SettingsChipChevron("3 active", SettingsChipTone.Success)
                    }
                },
            )
            SettingsRow(
                label = "Message templates",
                sublabel = if (data.isFresh) "No templates yet" else "5 templates",
                onClick = { onNavigate(vm.templatesRoute()) },
                trailing = {
                    if (data.isFresh) SettingsChipChevron("Set up", SettingsChipTone.Warning, PantopusIcon.Plus) else SettingsChevron()
                },
            )
            SettingsRow(
                label = "Booking notifications",
                sublabel = if (data.isFresh) "Using defaults" else "Push · Email",
                showDivider = false,
                onClick = { onNavigate(vm.notificationsRoute()) },
            )
        }
        SettingsGroup(title = "Scheduling defaults", accent = accent) {
            val tzSaving = data.savingRow == "timezone"
            SettingsRow(
                label = "Default timezone",
                sublabel = if (tzSaving) null else data.timezoneValue,
                onClick = { onNavigate(vm.availabilityRoute()) },
                trailing = {
                    if (tzSaving) {
                        SettingsRowShimmer(width = 70.dp)
                    } else {
                        SettingsTzRight(accent = accent, locked = !data.isFresh, accentBg = accentBg)
                    }
                },
            )
            SettingsRow(label = "Default availability", sublabel = "Mon–Fri, 9–5", onClick = { onNavigate(vm.availabilityRoute()) })
            val cancelSaving = data.savingRow == "cancellation"
            val cancelSaved = data.justSavedRow == "cancellation"
            SettingsRow(
                label = "Cancellation policy",
                sublabel =
                    when {
                        cancelSaving -> null
                        data.isFresh -> null
                        else -> "24-hour notice"
                    },
                showDivider = false,
                onClick = { onNavigate(vm.cancellationPolicyRoute()) },
                trailing = {
                    when {
                        cancelSaving -> SettingsRowShimmer(width = 84.dp)
                        cancelSaved ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                            ) {
                                SettingsSavedChip()
                                SettingsChevron()
                            }
                        data.isFresh -> SettingsChipChevron("Set up", SettingsChipTone.Warning, PantopusIcon.Plus)
                        else -> SettingsChevron()
                    }
                },
            )
        }
        if (data.paidEnabled) {
            SettingsGroup(title = "Payments", accent = accent, helper = "Required only for paid event types.") {
                SettingsRow(
                    label = "Payments & payouts",
                    sublabel = if (data.paymentsConnected) "Stripe · connected" else "Take payment at booking",
                    showDivider = false,
                    onClick = { onNavigate(vm.paymentsRoute()) },
                    trailing = {
                        if (data.paymentsConnected) {
                            // Row navigates, so the chip carries the trailing chevron like
                            // every other navigable row (scheduling-settings-frames.jsx
                            // ChipChevron; iOS `.chipChevron(...)`).
                            SettingsChipChevron("Connected", SettingsChipTone.Success, PantopusIcon.Check)
                        } else {
                            SettingsConnectPill(accent = accent, onClick = { onNavigate(vm.paymentsRoute()) })
                        }
                    },
                )
            }
        }
        SettingsDangerGroup {
            SettingsDangerRow(label = "Reset booking link", icon = PantopusIcon.RefreshCw, showDivider = true, onClick = onReset)
            SettingsDangerRow(label = "Disable scheduling", icon = PantopusIcon.CalendarX, showDivider = false, onClick = onDisable)
        }
        SettingsMonoFooter(text = data.monoFooter)
    }
}

@Composable
private fun SettingsError(
    message: String,
    onRetry: () -> Unit,
) {
    // Mirrors iOS SettingsErrorView / the standard scheduling error pattern: a
    // centered cloud-off hero in a sunken circle, headline + body, and a bordered
    // "Try again" capsule with a refresh icon (not a bare text button).
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CloudOff,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Spacer(Modifier.height(Spacing.s4))
        Text("Couldn't load settings", style = PantopusTextStyle.h3, color = PantopusColors.appText, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.s2))
        Text(message, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextStrong)
            Text("Try again", color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        }
    }
}

private val SETTINGS_SKELETON_CARD_H = 140.dp

/**
 * Loading skeleton mirroring the grouped-card geometry (and iOS SettingsSkeleton):
 * an overline shimmer + a 140-tall card, repeated for the Automation / Defaults /
 * Payments groups — not uniform identical cards.
 */
@Composable
private fun SettingsSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        repeat(3) {
            Shimmer(
                width = 110.dp,
                height = 11.dp,
                cornerRadius = Radii.xs,
                modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = 18.dp, bottom = Spacing.s2),
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3)
                        .height(SETTINGS_SKELETON_CARD_H)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun ConfirmDialog(
    title: String,
    message: String,
    confirm: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirm, color = PantopusColors.error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
