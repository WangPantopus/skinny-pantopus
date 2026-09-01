@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.start_train.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainMutual
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.11 — Verified-neighbor recipient card for step 1 (Frame 1). Avatar +
 * name + verified-neighbor shield + a mutuals strip (micro-avatars +
 * "2 mutuals: Marisa, Devon"), with a trailing "Change" affordance.
 *
 * Named `StartTrainRecipientCard` to mirror the iOS type and stay distinct
 * from the support-train *detail* `RecipientCard`.
 */
@Composable
internal fun StartTrainRecipientCard(
    recipient: MailRecipientDto,
    mutuals: List<StartSupportTrainMutual>,
    onChange: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = shape)
                .padding(Spacing.s3)
                .testTag("startSupportTrainSelectedBeneficiary"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RecipientAvatar(recipient)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = recipient.name ?: recipient.username ?: "Recipient",
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                )
                VerifiedShieldChip()
            }
            Text(
                text = metaLine(recipient),
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
            if (mutuals.isNotEmpty()) {
                MutualsStrip(mutuals)
            }
        }
        Box(
            modifier =
                Modifier
                    .size(width = 56.dp, height = 48.dp)
                    .clickable { onChange() }
                    .testTag("startSupportTrainChangeRecipient"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Change",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun RecipientAvatar(recipient: MailRecipientDto) {
    Box(modifier = Modifier.size(52.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.personalBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials(recipient),
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.personal,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun VerifiedShieldChip() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successBg)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 9.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "VERIFIED",
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun MutualsStrip(mutuals: List<StartSupportTrainMutual>) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
            mutuals.take(2).forEach { mutual ->
                Box(
                    modifier =
                        Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .padding(1.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.personalBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = mutual.initials.take(1),
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold, fontSize = 8.sp),
                        color = PantopusColors.personal,
                    )
                }
            }
        }
        Text(
            text = mutualsSummary(mutuals),
            style = PantopusTextStyle.caption.copy(fontSize = 10.sp),
            color = PantopusColors.appTextMuted,
            maxLines = 1,
        )
    }
}

private fun metaLine(recipient: MailRecipientDto): String {
    val address = recipient.homeAddress
    return if (!address.isNullOrBlank()) "Neighbor · $address" else "Verified neighbor"
}

private fun mutualsSummary(mutuals: List<StartSupportTrainMutual>): String {
    val names = mutuals.take(2).joinToString(", ") { it.name }
    val noun = if (mutuals.size == 1) "mutual" else "mutuals"
    return "${mutuals.size} $noun: $names"
}

private fun initials(recipient: MailRecipientDto): String {
    val source = recipient.name ?: recipient.username ?: "Recipient"
    return source
        .split(" ")
        .filter { it.isNotBlank() }
        .take(2)
        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
        .joinToString("")
        .ifBlank { "R" }
}
