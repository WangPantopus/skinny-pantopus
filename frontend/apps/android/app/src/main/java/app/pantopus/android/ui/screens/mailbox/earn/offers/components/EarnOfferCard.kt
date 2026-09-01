@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.earn.offers.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.earn.offers.EarnOfferDwell
import app.pantopus.android.ui.screens.mailbox.earn.offers.EarnOfferEngagement
import app.pantopus.android.ui.screens.mailbox.earn.offers.EarnOfferItem
import app.pantopus.android.ui.screens.mailbox.earn.offers.isOpen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * One envelope on the Earn drawer's paid-offer wall. Sealed envelopes
 * carry a warm-amber "OPEN TO EARN 25¢" flap and the whole card is the
 * open affordance; once opened the flap is replaced by an engagement
 * badge and the Save / Reveal actions unlock.
 *
 * The advertiser's `business_color` is deliberately NOT painted — the
 * wall stays inside the token system on the warm-amber Earn accent.
 *
 * Mirrors iOS `EarnOfferCard`.
 */
@Composable
fun EarnOfferCard(
    offer: EarnOfferItem,
    modifier: Modifier = Modifier,
    isBusy: Boolean = false,
    onOpen: () -> Unit = {},
    onSave: () -> Unit = {},
    onReveal: () -> Unit = {},
) {
    val shape = RoundedCornerShape(14.dp)
    val opened = offer.engagement.isOpen
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(
                    BorderStroke(
                        if (opened) 1.5.dp else 1.dp,
                        if (opened) PantopusColors.warmAmberBg else PantopusColors.appBorder,
                    ),
                    shape,
                ).then(
                    if (opened || isBusy) Modifier else Modifier.clickable(onClick = onOpen),
                ).testTag("earnOfferCard-${offer.id}"),
    ) {
        if (!opened) Flap(offer)
        EnvelopeBody(
            offer = offer,
            isBusy = isBusy,
            onSave = onSave,
            onReveal = onReveal,
        )
    }
}

@Composable
private fun Flap(offer: EarnOfferItem) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.warmAmberBg)
                .padding(horizontal = 14.dp, vertical = Spacing.s2)
                .testTag("earnOfferFlap-${offer.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Mail,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.warmAmber,
        )
        Text(
            text = if (offer.payoutLabel.isEmpty()) "OPEN TO EARN" else "OPEN TO EARN ${offer.payoutLabel}",
            color = PantopusColors.warmAmber,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
        )
    }
}

@Composable
private fun EnvelopeBody(
    offer: EarnOfferItem,
    isBusy: Boolean,
    onSave: () -> Unit,
    onReveal: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Header(offer)
        Text(
            text = offer.title,
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.15).sp,
        )
        offer.subtitle?.let { subtitle ->
            Text(
                text = subtitle,
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
            )
        }
        dwellHint(offer)?.let { hint ->
            Text(
                text = hint,
                color = PantopusColors.appTextMuted,
                fontSize = 11.sp,
                modifier = Modifier.testTag("earnOfferDwellHint-${offer.id}"),
            )
        }
        if (offer.engagement.isOpen) {
            Actions(
                offer = offer,
                isBusy = isBusy,
                onSave = onSave,
                onReveal = onReveal,
            )
        }
    }
}

@Composable
private fun Header(offer: EarnOfferItem) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Avatar(offer)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = offer.businessName,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                text = offer.expiryLabel,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        if (offer.engagement.isOpen) Badge(offer)
    }
}

@Composable
private fun Avatar(offer: EarnOfferItem) {
    Box(
        modifier =
            Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.warmAmberBg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = offer.initials,
            color = PantopusColors.warmAmber,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun Badge(offer: EarnOfferItem) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(badgeBackground(offer.engagement))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("earnOfferBadge-${offer.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = badgeIcon(offer.engagement),
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.2f,
            tint = badgeForeground(offer.engagement),
        )
        Text(
            text = badgeText(offer),
            color = badgeForeground(offer.engagement),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun Actions(
    offer: EarnOfferItem,
    isBusy: Boolean,
    onSave: () -> Unit,
    onReveal: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(40.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.warmAmber)
                    .then(if (isBusy) Modifier else Modifier.clickable(onClick = onSave))
                    .testTag("earnOfferSave-${offer.id}"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Save offer",
                color = PantopusColors.appTextInverse,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(40.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                    .then(if (isBusy) Modifier else Modifier.clickable(onClick = onReveal))
                    .testTag("earnOfferReveal-${offer.id}"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Reveal code",
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
    }
}

// MARK: - Badge vocabulary

private fun badgeText(offer: EarnOfferItem): String =
    when (val engagement = offer.engagement) {
        is EarnOfferEngagement.Unopened -> ""
        is EarnOfferEngagement.Dwelling -> "Banking · ${engagement.secondsRemaining}s"
        is EarnOfferEngagement.Pending -> "Not banked yet"
        is EarnOfferEngagement.Earned ->
            if (offer.payoutLabel.isEmpty()) "Earned" else "+${offer.payoutLabel} earned"

        is EarnOfferEngagement.Held -> "Under review"
    }

private fun badgeIcon(engagement: EarnOfferEngagement): PantopusIcon =
    when (engagement) {
        is EarnOfferEngagement.Dwelling -> PantopusIcon.Timer
        is EarnOfferEngagement.Earned -> PantopusIcon.CheckCircle
        is EarnOfferEngagement.Held -> PantopusIcon.ShieldAlert
        else -> PantopusIcon.Clock
    }

private fun badgeForeground(engagement: EarnOfferEngagement): Color =
    when (engagement) {
        is EarnOfferEngagement.Earned -> PantopusColors.success
        is EarnOfferEngagement.Held -> PantopusColors.warning
        is EarnOfferEngagement.Dwelling -> PantopusColors.warmAmber
        else -> PantopusColors.appTextSecondary
    }

private fun badgeBackground(engagement: EarnOfferEngagement): Color =
    when (engagement) {
        is EarnOfferEngagement.Earned -> PantopusColors.successBg
        is EarnOfferEngagement.Held -> PantopusColors.warningBg
        is EarnOfferEngagement.Dwelling -> PantopusColors.warmAmberBg
        else -> PantopusColors.appSurfaceSunken
    }

private fun dwellHint(offer: EarnOfferItem): String? =
    when (val engagement = offer.engagement) {
        is EarnOfferEngagement.Dwelling ->
            "Keep this offer open for ${engagement.secondsRemaining}s more to bank it."

        is EarnOfferEngagement.Pending ->
            "This one didn't reach the ${EarnOfferDwell.SECONDS}-second window, so it hasn't been paid."

        is EarnOfferEngagement.Held -> "Held while we check unusual activity on your account."
        else -> null
    }
