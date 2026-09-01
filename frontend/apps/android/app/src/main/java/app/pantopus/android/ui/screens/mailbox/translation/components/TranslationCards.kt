@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.translation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.translation.TranslationSender
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * White rounded card with the standard mailbox border. `noPad` drops the
 * inner padding for cards that own their own row insets (glossary,
 * side-by-side). Mirrors iOS `TranslationCard`.
 */
@Composable
fun TranslationCard(
    modifier: Modifier = Modifier,
    noPad: Boolean = false,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .then(if (noPad) Modifier else Modifier.padding(Spacing.s3)),
    ) {
        content()
    }
}

/** Uppercase card label with an optional trailing accessory. */
@Composable
fun TranslationCardLabel(
    title: String,
    modifier: Modifier = Modifier,
    accessory: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = title.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Box(modifier = Modifier.weight(1f))
        accessory?.invoke()
    }
}

// ─── Confirmed banner ─────────────────────────────────────────

/** "Translation confirmed" success banner shown in the confirmed frame. */
@Composable
fun TranslationConfirmBanner(stamp: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .semantics { contentDescription = "Translation confirmed. $stamp" }
                .testTag("translation_confirmBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 19.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = "Translation confirmed",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
            Text(
                text = stamp,
                fontSize = 11.sp,
                color = PantopusColors.success,
            )
        }
    }
}

// ─── Sender card ──────────────────────────────────────────────

/** The "From" sender card (Lucía Herrera · Verified neighbor). */
@Composable
fun TranslationSenderCard(sender: TranslationSender) {
    TranslationCard(modifier = Modifier.testTag("translation_senderCard")) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            TranslationCardLabel(title = "From")
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                SenderAvatar(sender = sender)
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = sender.name,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = sender.meta,
                        fontSize = 12.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        KindPill(sender.kind)
                        ProofPill(sender.proof)
                    }
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun SenderAvatar(sender: TranslationSender) {
    Box(modifier = Modifier.size(48.dp)) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.categoryTranslation),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = sender.initials,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.success)
                    .border(2.dp, PantopusColors.appSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 9.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun KindPill(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.personalBg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UserCheck,
            contentDescription = null,
            size = 9.dp,
            tint = PantopusColors.personal,
        )
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.personal,
        )
    }
}

@Composable
private fun ProofPill(label: String) {
    Text(
        text = label,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successBg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.success,
    )
}
