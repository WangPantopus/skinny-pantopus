@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.support_trains.detail.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.detail.RecipientCardContent
import app.pantopus.android.ui.screens.support_trains.detail.RecipientIdentityTag
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.9 — "For" overline + recipient card. Avatar gradient + verified
 * disc + household name + address-pin sub line + identity chip on
 * top; muted quote block with a leading quote glyph below.
 */
@Composable
fun RecipientCard(
    content: RecipientCardContent,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            modifier
                .testTag("supportTrainRecipientCard")
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Header(content)
        QuoteBlock(content)
    }
}

@Composable
private fun Header(content: RecipientCardContent) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Avatar(content)
        HeaderText(content)
        IdentityChip(content.identityTag)
    }
}

@Composable
private fun RowScope.HeaderText(content: RecipientCardContent) {
    Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = content.householdName,
            color = PantopusColors.appText,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            maxLines = 1,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = addressLine(content),
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun Avatar(content: RecipientCardContent) {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(brush = avatarGradient(content.identityTag)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = content.initials,
            color = PantopusColors.appTextInverse,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
        )
        if (content.verified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(verifiedDiscColor(content.identityTag))
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 8.dp,
                    strokeWidth = 4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun IdentityChip(tag: RecipientIdentityTag) {
    val visual = identityVisualFor(tag)
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(visual.background)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = visual.icon,
            contentDescription = null,
            size = 10.dp,
            strokeWidth = 2.5f,
            tint = visual.foreground,
        )
        Text(
            text = visual.label.uppercase(),
            color = visual.foreground,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun QuoteBlock(content: RecipientCardContent) {
    Row(
        modifier =
            Modifier
                .testTag("supportTrainRecipientQuote")
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MessageCircle,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = content.quote,
                color = PantopusColors.appTextStrong,
                fontSize = 12.sp,
            )
            content.quoteAttribution?.let {
                Text(
                    text = "— $it",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

// MARK: - Mapping helpers

private data class IdentityVisual(
    val icon: PantopusIcon,
    val label: String,
    val foreground: Color,
    val background: Color,
)

private fun identityVisualFor(tag: RecipientIdentityTag): IdentityVisual =
    when (tag) {
        RecipientIdentityTag.Home ->
            IdentityVisual(
                icon = PantopusIcon.Home,
                label = "Home",
                foreground = PantopusColors.homeDark,
                background = PantopusColors.homeBg,
            )
        RecipientIdentityTag.Personal ->
            IdentityVisual(
                icon = PantopusIcon.User,
                label = "Personal",
                foreground = PantopusColors.primary700,
                background = PantopusColors.personalBg,
            )
        RecipientIdentityTag.Business ->
            IdentityVisual(
                icon = PantopusIcon.Briefcase,
                label = "Business",
                foreground = PantopusColors.businessDark,
                background = PantopusColors.businessBg,
            )
    }

private fun addressLine(content: RecipientCardContent): String =
    if (content.proximity.isNullOrBlank()) content.address else "${content.address} · ${content.proximity}"

private fun avatarGradient(tag: RecipientIdentityTag): Brush =
    when (tag) {
        RecipientIdentityTag.Home -> Brush.linearGradient(listOf(PantopusColors.successLight, PantopusColors.home))
        RecipientIdentityTag.Personal -> Brush.linearGradient(listOf(PantopusColors.primary200, PantopusColors.primary600))
        RecipientIdentityTag.Business -> Brush.linearGradient(listOf(PantopusColors.businessBg, PantopusColors.business))
    }

private fun verifiedDiscColor(tag: RecipientIdentityTag): Color =
    when (tag) {
        RecipientIdentityTag.Home -> PantopusColors.home
        RecipientIdentityTag.Personal -> PantopusColors.personal
        RecipientIdentityTag.Business -> PantopusColors.business
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 220)
@Composable
private fun RecipientCardPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        RecipientCard(
            content =
                RecipientCardContent(
                    initials = "MR",
                    householdName = "The Reyes household",
                    identityTag = RecipientIdentityTag.Home,
                    verified = true,
                    address = "418 Elm St",
                    proximity = "2 blocks from you",
                    quote = "Baby Mateo arrived Nov 18 — we're home and overwhelmed in the best way.",
                    quoteAttribution = "Ana & Jordan",
                ),
        )
    }
}
