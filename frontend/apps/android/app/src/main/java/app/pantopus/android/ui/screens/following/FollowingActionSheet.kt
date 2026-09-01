@file:Suppress("MagicNumber", "PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.following

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private enum class SheetStep { Actions, Mute }

private const val CUSTOM_DAYS_DEFAULT = 90

/**
 * §1A① Frames 2 + 3 — the row overflow action sheet and its mute sub-step,
 * one modal sheet that swaps between an "actions" step and a "mute duration"
 * step (back chevron returns).
 */
@Composable
fun FollowingActionSheet(
    target: FollowingActionTarget,
    onMarkSeen: () -> Unit,
    onMute: (Int) -> Unit,
    onUnfollow: () -> Unit,
    onNotificationLevel: (FollowingNotificationLevel) -> Unit = {},
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var step by remember { mutableStateOf(SheetStep.Actions) }
    var showCustom by remember { mutableStateOf(false) }
    var customDays by remember { mutableIntStateOf(CUSTOM_DAYS_DEFAULT) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s4)) {
            when (step) {
                SheetStep.Actions ->
                    ActionsStep(
                        target = target,
                        onMarkSeen = onMarkSeen,
                        onMuteStep = { step = SheetStep.Mute },
                        onUnfollow = onUnfollow,
                        onNotificationLevel = onNotificationLevel,
                    )
                SheetStep.Mute ->
                    MuteStep(
                        target = target,
                        showCustom = showCustom,
                        customDays = customDays,
                        onBack = {
                            showCustom = false
                            step = SheetStep.Actions
                        },
                        onToggleCustom = { showCustom = !showCustom },
                        onCustomDaysChange = { customDays = it },
                        onMute = onMute,
                    )
            }
        }
    }
}

@Composable
private fun ActionsStep(
    target: FollowingActionTarget,
    onMarkSeen: () -> Unit,
    onMuteStep: () -> Unit,
    onUnfollow: () -> Unit,
    onNotificationLevel: (FollowingNotificationLevel) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("followingActionSheet")) {
        ContextHeader(target)
        SheetDivider()
        NotificationLevelPicker(
            selected = target.notificationLevel,
            onSelect = onNotificationLevel,
        )
        SheetDivider()
        SheetActionRow(
            icon = PantopusIcon.CheckCheck,
            label = "Mark seen",
            testTag = "followingAction.markSeen",
            onClick = onMarkSeen,
        )
        SheetDivider()
        SheetActionRow(
            icon = PantopusIcon.BellOff,
            label = "Mute",
            sub = "No updates while muted",
            trailingChevron = true,
            testTag = "followingAction.mute",
            onClick = onMuteStep,
        )
        SheetDivider()
        SheetActionRow(
            icon = PantopusIcon.UserMinus,
            label = "Unfollow",
            destructive = true,
            testTag = "followingAction.unfollow",
            onClick = onUnfollow,
        )
    }
}

@Composable
private fun MuteStep(
    target: FollowingActionTarget,
    showCustom: Boolean,
    customDays: Int,
    onBack: () -> Unit,
    onToggleCustom: () -> Unit,
    onCustomDaysChange: (Int) -> Unit,
    onMute: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("followingMuteSheet")) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("followingMuteBack"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 21.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appTextStrong,
                )
            }
            Column {
                Text(
                    "Mute ${target.displayName}",
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    "You can unmute anytime in settings",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        FollowingMutePreset.entries.forEach { preset ->
            SheetDivider()
            SheetActionRow(
                icon = PantopusIcon.Clock,
                label = preset.label,
                testTag = preset.testTag,
                onClick = { onMute(preset.days) },
            )
        }
        SheetDivider()
        SheetActionRow(
            icon = PantopusIcon.SlidersHorizontal,
            label = "Custom…",
            sub = "Up to 1 year",
            trailingChevron = !showCustom,
            testTag = "followingMute.custom",
            onClick = onToggleCustom,
        )
        if (showCustom) {
            CustomDaysPicker(
                days = customDays,
                onChange = onCustomDaysChange,
                onApply = { onMute(customDays) },
            )
        }
    }
}

@Composable
private fun CustomDaysPicker(
    days: Int,
    onChange: (Int) -> Unit,
    onApply: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            StepperButton(symbol = "–", testTag = "followingMute.customMinus") {
                onChange((days - 1).coerceAtLeast(1))
            }
            Text(
                text = "$days day${if (days == 1) "" else "s"}",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).testTag("followingMute.customValue"),
            )
            StepperButton(symbol = "+", testTag = "followingMute.customPlus") {
                onChange((days + 1).coerceAtMost(FOLLOWING_MUTE_MAX_DAYS))
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onApply)
                    .padding(vertical = Spacing.s3)
                    .testTag("followingMute.customApply"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Mute for $days day${if (days == 1) "" else "s"}",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun StepperButton(
    symbol: String,
    testTag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Text(symbol, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
    }
}

@Composable
private fun NotificationLevelPicker(
    selected: FollowingNotificationLevel,
    onSelect: (FollowingNotificationLevel) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("followingNotifyPicker"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Notifications",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextMuted,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            FollowingNotificationLevel.entries.forEach { level ->
                val active = level == selected
                Row(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(
                                if (active) PantopusColors.appSurface else androidx.compose.ui.graphics.Color.Transparent,
                            ).clickable { onSelect(level) }
                            .padding(vertical = 7.dp)
                            .testTag("followingNotify.${level.wire}"),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = level.icon,
                        contentDescription = null,
                        size = 13.dp,
                        tint = if (active) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = level.label,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (active) PantopusColors.appText else PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(start = Spacing.s1),
                    )
                }
            }
        }
    }
}

@Composable
private fun ContextHeader(target: FollowingActionTarget) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        FollowingAvatar(
            initials = target.initials,
            color = target.tone.color,
            avatarUrl = null,
            verified = target.verified,
            size = 38.dp,
        )
        Column {
            Text(target.displayName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text("@${target.handle}", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun SheetActionRow(
    icon: PantopusIcon,
    label: String,
    sub: String? = null,
    destructive: Boolean = false,
    trailingChevron: Boolean = false,
    testTag: String,
    onClick: () -> Unit,
) {
    val tint = if (destructive) PantopusColors.error else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = tint)
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 15.5.sp, fontWeight = FontWeight.Medium, color = tint)
            sub?.let { Text(it, fontSize = 12.sp, color = PantopusColors.appTextSecondary) }
        }
        if (trailingChevron) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun SheetDivider() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(1.dp)
            .padding(start = Spacing.s12)
            .background(PantopusColors.appBorderSubtle),
    )
}
