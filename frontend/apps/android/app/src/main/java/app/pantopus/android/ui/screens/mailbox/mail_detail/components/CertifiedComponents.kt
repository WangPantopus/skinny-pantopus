@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * T6.5c (P21) — Decorative USPS Certified Mail stamp. Mirrors iOS
 * `CertifiedStampBadge`. Pure Compose — no asset deps.
 */

// CSS 7B2D0E — postal orange-brown (per-feature palette exception).
private val StampInk = Color(0xFF7B2D0E)

// rgba(180, 86, 35, 0.04) — barely-tinted parchment.
private val StampBg = Color(red = 180f / 255f, green = 86f / 255f, blue = 35f / 255f, alpha = 0.04f)

const val CERTIFIED_STAMP_BADGE_TAG = "certifiedStampBadge"

@Composable
fun CertifiedStampBadge(
    trackingId: String,
    modifier: Modifier = Modifier,
) {
    val pretty = prettyPrintTracking(trackingId)
    Column(
        modifier =
            modifier
                .rotate(-1.5f)
                .clip(RoundedCornerShape(Radii.xs))
                .background(StampBg)
                .border(width = 1.5.dp, color = StampInk, shape = RoundedCornerShape(Radii.xs))
                .padding(horizontal = 9.dp, vertical = 6.dp)
                .testTag(CERTIFIED_STAMP_BADGE_TAG)
                .semantics { contentDescription = "USPS Certified Mail · tracking $pretty" },
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = "USPS · CERTIFIED",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.2.sp,
            color = StampInk,
        )
        Text(
            text = "MAIL™",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = StampInk,
        )
        Row(
            modifier = Modifier.padding(top = Spacing.s1),
            horizontalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            // Same bar widths as iOS / web for a consistent stamp profile.
            listOf(1.5f, 2.5f, 1f, 3f, 1.5f, 2f, 1f, 2.5f, 1.5f, 3f, 1f, 2f, 1.5f).forEach { w ->
                Box(
                    modifier =
                        Modifier
                            .width(w.dp)
                            .height(12.dp)
                            .background(StampInk),
                )
            }
        }
        Text(
            text = pretty,
            fontSize = 8.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
            color = StampInk,
            fontFamily = FontFamily.Monospace,
        )
    }
}

private fun prettyPrintTracking(raw: String): String {
    val trimmed = raw.replace(" ", "")
    if (trimmed.length <= 8) return raw
    val prefix = trimmed.take(12)
    return prefix.chunked(4).joinToString(" ")
}

// ─── Combined Sender + Carrier card ─────────────────────────

@Immutable
data class MailCarrierInfo(
    val service: String,
    val trackingId: String? = null,
    val signatureRequired: Boolean = true,
    val postmarkVerified: Boolean = true,
)

const val COMBINED_SENDER_CARRIER_TAG = "combinedSenderCarrierCard"

@Composable
fun CombinedSenderCarrierCard(
    senderName: String,
    senderMeta: String?,
    senderInitials: String,
    senderAvatarTint: Color,
    senderUserId: String?,
    trust: MailTrust,
    carrier: MailCarrierInfo,
    modifier: Modifier = Modifier,
    onOpenSenderProfile: (String) -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag(COMBINED_SENDER_CARRIER_TAG),
    ) {
        Text(
            text = "SENDER & CARRIER",
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        SenderRow(
            senderName = senderName,
            senderMeta = senderMeta,
            senderInitials = senderInitials,
            senderAvatarTint = senderAvatarTint,
            senderUserId = senderUserId,
            trust = trust,
            onOpenSenderProfile = onOpenSenderProfile,
        )
        HorizontalDivider(
            color = PantopusColors.appBorder,
            modifier = Modifier.padding(horizontal = Spacing.s3),
        )
        CarrierRow(carrier = carrier)
    }
}

@Composable
private fun SenderRow(
    senderName: String,
    senderMeta: String?,
    senderInitials: String,
    senderAvatarTint: Color,
    senderUserId: String?,
    trust: MailTrust,
    onOpenSenderProfile: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = senderUserId != null) {
                    senderUserId?.let(onOpenSenderProfile)
                }
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("combinedSenderCarrierCard_sender"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SenderAvatar(initials = senderInitials, tint = senderAvatarTint)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            EyebrowLabel("FROM")
            Text(
                text = senderName,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            senderMeta?.let {
                Text(text = it, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)
            }
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Pill(
                    icon = PantopusIcon.Landmark,
                    text = trust.label,
                    background = PantopusColors.primary100,
                    foreground = PantopusColors.primary800,
                )
                Pill(
                    icon = null,
                    text = "Sender domain checked",
                    background = PantopusColors.successBg,
                    foreground = PantopusColors.success,
                )
            }
        }
        if (senderUserId != null) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun SenderAvatar(
    initials: String,
    tint: Color,
) {
    Box(modifier = Modifier.size(46.dp)) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .align(Alignment.TopStart)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(tint),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(15.dp)
                    .align(Alignment.BottomEnd)
                    .clip(CircleShape)
                    .background(PantopusColors.success)
                    .border(width = 2.dp, color = PantopusColors.appSurface, shape = CircleShape),
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
private fun CarrierRow(carrier: MailCarrierInfo) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("combinedSenderCarrierCard_carrier"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(width = 1.5.dp, color = StampInk, shape = RoundedCornerShape(Radii.lg)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mailbox,
                contentDescription = null,
                size = 18.dp,
                tint = StampInk,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            EyebrowLabel("DELIVERED VIA")
            Text(
                text = carrier.service,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            carrier.trackingId?.let { id ->
                Text(
                    text = "#$id",
                    fontSize = 11.5.sp,
                    fontFamily = FontFamily.Monospace,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (carrier.signatureRequired) {
                    Pill(
                        icon = PantopusIcon.Pencil,
                        text = "Signature required",
                        background = PantopusColors.warningBg,
                        foreground = PantopusColors.warning,
                    )
                }
                if (carrier.postmarkVerified) {
                    Pill(
                        icon = null,
                        text = "Postmark verified",
                        background = PantopusColors.successBg,
                        foreground = PantopusColors.success,
                    )
                }
            }
        }
    }
}

@Composable
private fun EyebrowLabel(text: String) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.4.sp,
        color = PantopusColors.appTextSecondary,
    )
}

@Composable
private fun Pill(
    icon: PantopusIcon?,
    text: String,
    background: Color,
    foreground: Color,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = (Spacing.s1 + 2.dp), vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 9.dp,
                tint = foreground,
            )
        }
        Text(
            text = text,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
        )
    }
}
