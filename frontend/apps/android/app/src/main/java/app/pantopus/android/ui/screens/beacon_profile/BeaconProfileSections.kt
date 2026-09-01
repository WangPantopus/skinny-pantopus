@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.beacon_profile

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
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** A tab in the [BeaconProfileTabStrip]. */
data class BeaconTabItem(
    val tab: BeaconProfileTab,
    val label: String,
    val count: Int?,
)

/** Underline-active tab strip (Broadcasts · About · Tiers). */
@Composable
fun BeaconProfileTabStrip(
    tabs: List<BeaconTabItem>,
    selected: BeaconProfileTab,
    onSelect: (BeaconProfileTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s6),
    ) {
        tabs.forEach { item ->
            val active = item.tab == selected
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier =
                    Modifier
                        .clickable { onSelect(item.tab) }
                        .testTag("beaconProfileTab_${item.tab.name}"),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (active) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                    )
                    if (item.count != null) {
                        Text(
                            text = " ${item.count}",
                            fontSize = 10.5.sp,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                }
                Box(
                    modifier =
                        Modifier
                            .padding(top = Spacing.s2)
                            .fillMaxWidth()
                            .height(2.dp)
                            .background(if (active) PantopusColors.primary600 else androidx.compose.ui.graphics.Color.Transparent),
                )
            }
        }
    }
}

/** Owner analytics strip — taps through to the full audience dashboard. */
@Composable
fun BeaconOwnerAnalyticsStrip(
    followerStat: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .clickable { onClick() }
                .testTag("beaconProfileAnalyticsStrip")
                .padding(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.TrendingUp, contentDescription = null, size = 17.dp, tint = PantopusColors.primary600)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("Your audience", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            Text(
                "$followerStat beacons following · View insights",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
        }
        PantopusIconImage(PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** Owner broadcast composer entry — mirrors the RN `updatesCta`. */
@Composable
fun BeaconComposeCta(
    audienceLabel: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.lg))
                .clickable { onClick() }
                .testTag("beaconProfileComposeCTA")
                .padding(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(38.dp).clip(CircleShape).background(PantopusColors.primary600),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Megaphone, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextInverse)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text("Updates", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                "Post one-way news to your ${audienceLabel.lowercase()}.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        PantopusIconImage(PantopusIcon.ArrowRight, contentDescription = null, size = 18.dp, tint = PantopusColors.primary600)
    }
}

/** Owner-flavoured empty state for the Broadcasts tab. */
@Composable
fun BeaconOwnerEmptyBroadcasts(
    broadcastEnabled: Boolean,
    onCompose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            modifier
                .fillMaxWidth()
                .testTag("beaconProfileOwnerEmptyBroadcasts")
                .padding(top = Spacing.s10, bottom = Spacing.s5),
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.RadioTower, contentDescription = null, size = 32.dp, tint = PantopusColors.primary600)
        }
        Text(
            "No broadcasts yet",
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = Spacing.s4),
        )
        Text(
            "Share an update and it lands in every follower's Beacon feed.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s2, start = Spacing.s4, end = Spacing.s4),
        )
        if (broadcastEnabled) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier =
                    Modifier
                        .padding(top = Spacing.s4)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600)
                        .clickable { onCompose() }
                        .testTag("beaconProfileComposeEmptyCTA")
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            ) {
                PantopusIconImage(PantopusIcon.Megaphone, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextInverse)
                Text("Compose broadcast", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
            }
        }
    }
}

/** About tab — bio, category / audience / follow-mode rows, and links. */
@Composable
fun BeaconAboutSection(
    content: BeaconProfileContent,
    onOpenLink: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        modifier = modifier.fillMaxWidth().testTag("beaconProfileAbout"),
    ) {
        content.bio?.takeIf { it.isNotEmpty() }?.let { bio ->
            Text(bio, fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
        ) {
            content.categoryLabel?.let { MetaRow(PantopusIcon.Crown, "Category", it) }
            MetaRow(PantopusIcon.Users, "Audience", content.audienceLabel)
            content.audienceModeLabel?.let { MetaRow(PantopusIcon.Lock, "Follow mode", it) }
        }
        if (content.links.isNotEmpty()) {
            Text("LINKS", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            content.links.forEach { link ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                            .clickable { onOpenLink(link.url) }
                            .testTag("beaconProfileLink_${link.label}")
                            .padding(Spacing.s3),
                ) {
                    PantopusIconImage(PantopusIcon.Link, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
                    Text(
                        link.label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.primary700,
                        modifier = Modifier.weight(1f),
                    )
                    PantopusIconImage(PantopusIcon.ArrowRight, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
                }
            }
        }
    }
}

@Composable
private fun MetaRow(
    icon: PantopusIcon,
    label: String,
    value: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
    ) {
        PantopusIconImage(icon, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
        Text(label, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        Box(modifier = Modifier.weight(1f))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
    }
}

/** Tiers tab — the persona's subscription ladder. */
@Composable
fun BeaconTiersSection(
    tiers: List<BeaconTier>,
    modifier: Modifier = Modifier,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = modifier.fillMaxWidth().testTag("beaconProfileTiers"),
    ) {
        tiers.forEach { tier ->
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .testTag("beaconProfileTier_${tier.rank}")
                        .padding(Spacing.s3),
            ) {
                Box(
                    modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.warningBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Crown, contentDescription = null, size = 16.dp, tint = PantopusColors.warning)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(tier.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                    tier.detail?.takeIf { it.isNotEmpty() }?.let {
                        Text(it, fontSize = 12.sp, color = PantopusColors.appTextSecondary, maxLines = 2)
                    }
                }
                Text(tier.priceLabel, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary700)
            }
        }
    }
}
