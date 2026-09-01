@file:Suppress("LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun PulsePostPurposePickerScreen(
    target: PulsePostingTarget,
    onSelect: (PulseComposePurpose) -> Unit,
    onBack: () -> Unit,
) {
    val purposes = PulseComposePurpose.allowedFor(target)

    FormShell(
        title = "New post",
        leading = FormShellLeading.Back,
        rightActionLabel = null,
        isValid = false,
        isDirty = false,
        isSaving = false,
        onClose = onBack,
        onCommit = {},
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .testTag("pulsePostPurposePicker"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = "What is this post for?",
                    style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                )
                Text(
                    text = "This helps neighbors find your post.",
                    style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
                    color = PantopusColors.appTextSecondary,
                )
            }

            if (target.isPlaceTarget) {
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurfaceSunken)
                            .heightIn(min = 26.dp)
                            .padding(horizontal = Spacing.s2)
                            .testTag("pulsePurposeTargetBadge"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 13.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = "Posting to ${target.displayLabel}",
                        style = PantopusTextStyle.small.copy(fontSize = 13.sp, fontWeight = FontWeight.Medium),
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                purposes.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        row.forEach { purpose ->
                            PurposeCard(
                                purpose = purpose,
                                modifier = Modifier.weight(1f),
                                onClick = { onSelect(purpose) },
                            )
                        }
                        if (row.size == 1) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PurposeCard(
    purpose: PulseComposePurpose,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val (accent, background) = purposeColors(purpose)
    val description = purposeDescription(purpose)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("pulsePurpose-${purpose.key}")
                .semantics { contentDescription = "${purpose.label}. $description" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = purposeIcon(purpose),
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2f,
                tint = accent,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = purpose.label,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = description,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
                minLines = 2,
            )
        }
    }
}

private fun purposeDescription(purpose: PulseComposePurpose): String =
    when (purpose) {
        PulseComposePurpose.Ask -> "Get help or answers from neighbors"
        PulseComposePurpose.HeadsUp -> "Warn people nearby about something"
        PulseComposePurpose.Recommend -> "Share a place or service you love"
        PulseComposePurpose.LostFound -> "Reunite lost items and pets"
        PulseComposePurpose.LocalUpdate -> "Share news from around the area"
        PulseComposePurpose.NeighborhoodWin -> "Celebrate something good nearby"
        PulseComposePurpose.VisitorGuide -> "Tips for people visiting the area"
        PulseComposePurpose.Event -> "Invite neighbors to something"
        PulseComposePurpose.Deal -> "Share a local discount or offer"
    }

private fun purposeIcon(purpose: PulseComposePurpose): PantopusIcon =
    when (purpose) {
        PulseComposePurpose.Ask -> PantopusIcon.HelpCircle
        PulseComposePurpose.HeadsUp -> PantopusIcon.Megaphone
        PulseComposePurpose.Recommend -> PantopusIcon.Star
        PulseComposePurpose.LostFound -> PantopusIcon.Search
        PulseComposePurpose.LocalUpdate -> PantopusIcon.FileText
        PulseComposePurpose.NeighborhoodWin -> PantopusIcon.Crown
        PulseComposePurpose.VisitorGuide -> PantopusIcon.Compass
        PulseComposePurpose.Event -> PantopusIcon.Calendar
        PulseComposePurpose.Deal -> PantopusIcon.Tag
    }

private fun purposeColors(purpose: PulseComposePurpose): Pair<androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color> =
    when (purpose) {
        PulseComposePurpose.Ask -> PantopusColors.primary600 to PantopusColors.primary50
        PulseComposePurpose.HeadsUp -> PantopusColors.error to PantopusColors.errorBg
        PulseComposePurpose.Recommend -> PantopusColors.warmAmber to PantopusColors.warmAmberBg
        PulseComposePurpose.LostFound -> PantopusColors.warning to PantopusColors.warningBg
        PulseComposePurpose.LocalUpdate -> PantopusColors.primary700 to PantopusColors.primary50
        PulseComposePurpose.NeighborhoodWin -> PantopusColors.success to PantopusColors.successBg
        PulseComposePurpose.VisitorGuide -> PantopusColors.home to PantopusColors.homeBg
        PulseComposePurpose.Event -> PantopusColors.primary600 to PantopusColors.primary50
        PulseComposePurpose.Deal -> PantopusColors.success to PantopusColors.successBg
    }
