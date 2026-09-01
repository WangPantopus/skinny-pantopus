package app.pantopus.android.ui.screens.place.components

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
import app.pantopus.android.data.api.models.place.PlaceDensityBucket
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * Composite Place cards ported 1:1 from `place-components.jsx`:
 * LockedCard (tier-gated content), DensityCard (k-anon bucket — text
 * and dots only, NEVER a number), HeroCard ("Today's Pulse" with the
 * inset nudge). Parity twin of iOS `PlaceCards.swift`.
 */

// ─── Locked card (`LockedCard`) ──────────────────────────────

/** Tier-gated section teaser: muted tile, lock glyph, reason + sky CTA. */
@Composable
fun PlaceLockedCard(
    title: String,
    reason: String,
    cta: String,
    icon: PantopusIcon = PantopusIcon.Home,
    onTap: (() -> Unit)? = null,
) {
    Column(
        modifier =
            Modifier
                .placeCard()
                .let { m -> onTap?.let { m.clickable(onClick = it) } ?: m }
                .fillMaxWidth()
                .padding(16.dp)
                .testTag("place.locked.$title"),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlaceIconTile(icon = icon, tone = PlaceTileTone.MUTED)
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = "Locked",
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
        Spacer(modifier = Modifier.height(11.dp))
        Text(
            text = reason,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(10.dp))
        PlaceTextButton(title = cta)
    }
}

// ─── Density card (`DensityCard`) ────────────────────────────

/**
 * Block-density bucket card. Bucket text + dots only — the k-anonymity
 * rule means this card never shows a neighbor count.
 */
@Composable
fun PlaceDensityCard(
    bucket: PlaceDensityBucket,
    label: String? = null,
    // Pass null to hide the CTA (dashboard cards tap through to Block).
    ctaTitle: String? = "Be one of the first to verify on your block",
    onTap: (() -> Unit)? = null,
) {
    val dots =
        when (bucket) {
            PlaceDensityBucket.NONE, PlaceDensityBucket.UNKNOWN -> 0
            PlaceDensityBucket.FORMING -> 1
            PlaceDensityBucket.FEW -> 2
            PlaceDensityBucket.GROWING -> 3
        }
    val fallbackLabel =
        when (bucket) {
            PlaceDensityBucket.FORMING -> "Your block is starting to form"
            PlaceDensityBucket.FEW -> "A few verified homes nearby"
            PlaceDensityBucket.GROWING -> "Growing activity near this area"
            PlaceDensityBucket.NONE, PlaceDensityBucket.UNKNOWN -> "No activity shown yet"
        }
    Column(
        modifier =
            Modifier
                .placeCard()
                .let { m -> onTap?.let { m.clickable(onClick = it) } ?: m }
                .fillMaxWidth()
                .padding(16.dp)
                .testTag("place.density"),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlaceIconTile(
                icon = PantopusIcon.Users,
                tone = if (dots == 0) PlaceTileTone.MUTED else PlaceTileTone.HOME,
            )
            Text(
                text = "Verified homes nearby",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PlaceChevron()
        }
        Spacer(modifier = Modifier.height(11.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlaceDensityDots(level = dots)
            Text(
                text = label ?: fallbackLabel,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = if (dots == 0) PantopusColors.appTextSecondary else PantopusColors.appText,
            )
        }
        if (ctaTitle != null) {
            Spacer(modifier = Modifier.height(11.dp))
            PlaceTextButton(title = ctaTitle)
        }
    }
}

// ─── Hero card (`HeroCard` — "Today's Pulse") ────────────────

enum class PlaceHeroVariant { ALL_CLEAR, ALERT }

/**
 * The dashboard hero. All-clear (green) or alert (amber) framing, with
 * an inset, clearly-tappable secondary nudge.
 */
@Composable
fun PlaceHeroCard(
    chip: PlaceChipModel,
    heroIcon: PantopusIcon,
    headline: String,
    nudgeIcon: PantopusIcon,
    nudgeText: String,
    modifier: Modifier = Modifier,
    variant: PlaceHeroVariant = PlaceHeroVariant.ALL_CLEAR,
    onNudgeTap: (() -> Unit)? = null,
    onTap: (() -> Unit)? = null,
) {
    val isAlert = variant == PlaceHeroVariant.ALERT
    Column(
        modifier =
            modifier
                .placeCard()
                .let { m -> onTap?.let { m.clickable(onClick = it) } ?: m }
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 14.dp)
                .testTag("place.hero"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "TODAY'S PULSE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.77.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            PlaceChip(chip)
        }
        Spacer(modifier = Modifier.height(13.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(13.dp)) {
            Box(
                modifier =
                    Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isAlert) PantopusColors.warningBg else PantopusColors.homeBg)
                        .border(
                            1.dp,
                            if (isAlert) PantopusColors.warningLight else PantopusColors.successLight,
                            RoundedCornerShape(12.dp),
                        ),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = heroIcon,
                    contentDescription = null,
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = if (isAlert) PantopusColors.warning else PantopusColors.home,
                )
            }
            Text(
                text = headline,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 23.sp,
                letterSpacing = (-0.2).sp,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
        }
        // The inset nudge is optional — all-clear with nothing to flag
        // renders just the overline + headline (parity with the web hero).
        if (nudgeText.isNotEmpty()) {
            Spacer(modifier = Modifier.height(14.dp))
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isAlert) PantopusColors.warningBg else PantopusColors.appBg)
                        .border(
                            1.dp,
                            if (isAlert) PantopusColors.warningLight else PantopusColors.appBorderSubtle,
                            RoundedCornerShape(12.dp),
                        )
                        .let { m -> onNudgeTap?.let { m.clickable(onClick = it) } ?: m }
                        .padding(vertical = 11.dp, horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = nudgeIcon,
                    contentDescription = null,
                    size = 17.dp,
                    strokeWidth = 2f,
                    tint = if (isAlert) PantopusColors.warning else PantopusColors.home,
                )
                Text(
                    text = nudgeText,
                    fontSize = 13.5.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextStrong,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 17.dp,
                    strokeWidth = 2.25f,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}
