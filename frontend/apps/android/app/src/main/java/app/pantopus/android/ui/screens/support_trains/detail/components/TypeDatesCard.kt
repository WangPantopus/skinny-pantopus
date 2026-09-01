@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.support_trains.detail.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.detail.ContributorBubble
import app.pantopus.android.ui.screens.support_trains.detail.ContributorTone
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainKind
import app.pantopus.android.ui.screens.support_trains.detail.TypeDatesCardContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.9 — "The train" overline + card. Icon tile in homeBg, title +
 * date range, status pill, sky-gradient progress bar, contributor
 * strip. Mirrors `TypeDatesCard.swift`.
 */
@Composable
fun TypeDatesCard(
    content: TypeDatesCardContent,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            modifier
                .testTag("supportTrainTypeDatesCard")
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Header(content)
        ProgressBlock(content)
    }
}

@Composable
private fun Header(content: TypeDatesCardContent) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        IconTile(content.kind)
        HeaderText(content)
        StatusPill(isFullyCovered = content.isFullyCovered)
    }
}

@Composable
private fun IconTile(kind: SupportTrainKind) {
    Box(
        modifier =
            Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.homeBg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = iconFor(kind),
            contentDescription = null,
            size = 19.dp,
            strokeWidth = 2f,
            tint = PantopusColors.homeDark,
        )
    }
}

@Composable
private fun RowScope.HeaderText(content: TypeDatesCardContent) {
    Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = content.title,
            color = PantopusColors.appText,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            maxLines = 1,
        )
        Text(
            text = metaLine(content),
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
            maxLines = 1,
        )
    }
}

@Composable
private fun StatusPill(isFullyCovered: Boolean) {
    val fg = if (isFullyCovered) PantopusColors.success else PantopusColors.primary700
    val bg = if (isFullyCovered) PantopusColors.successBg else PantopusColors.primary50
    Text(
        text = if (isFullyCovered) "COVERED" else "OPEN",
        color = fg,
        fontWeight = FontWeight.Bold,
        fontSize = 10.5.sp,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    )
}

@Composable
private fun ProgressBlock(content: TypeDatesCardContent) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            ProgressCounts(content)
            Box(modifier = Modifier.weight(1f))
            Text(
                text = "${content.percentCovered}%",
                color = if (content.isFullyCovered) PantopusColors.success else PantopusColors.primary700,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        ProgressBar(content)
        ContributorStrip(content)
    }
}

@Composable
private fun ProgressCounts(content: TypeDatesCardContent) {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(
            text = content.slotsFilled.toString(),
            color = PantopusColors.appText,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = " of ${content.slotsTotal} slots covered",
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun ProgressBar(content: TypeDatesCardContent) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(7.dp)) {
        val width = this.maxWidth
        val fillFraction =
            if (content.slotsTotal <= 0) {
                0f
            } else {
                content.slotsFilled.coerceIn(0, content.slotsTotal).toFloat() / content.slotsTotal.toFloat()
            }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken),
        )
        Box(
            modifier =
                Modifier
                    .width(width * fillFraction)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(progressGradient(content.isFullyCovered)),
        )
    }
}

private fun progressGradient(isFullyCovered: Boolean): Brush =
    if (isFullyCovered) {
        Brush.horizontalGradient(listOf(PantopusColors.success, PantopusColors.home))
    } else {
        Brush.horizontalGradient(listOf(PantopusColors.primary500, PantopusColors.primary600))
    }

@Composable
private fun ContributorStrip(content: TypeDatesCardContent) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        val visible = content.contributors.take(4)
        Box(
            modifier = Modifier.height(22.dp).width(contributorRowWidth(visible.size, content.extraCount)),
        ) {
            visible.forEachIndexed { index, bubble ->
                ContributorDisc(
                    bubble = bubble,
                    modifier = Modifier.offset(x = (index * 15).dp),
                )
            }
            if (content.extraCount > 0) {
                ExtraDisc(
                    extra = content.extraCount,
                    modifier = Modifier.offset(x = (visible.size * 15).dp),
                )
            }
        }
        Text(
            text = if (content.isFullyCovered) "All neighbors confirmed" else "${content.slotsFilled} neighbors signed up",
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
        )
    }
}

private fun contributorRowWidth(
    visible: Int,
    extra: Int,
): Dp {
    val count = visible + if (extra > 0) 1 else 0
    if (count <= 0) return 0.dp
    return ((count - 1) * 15 + 22).dp
}

@Composable
private fun ContributorDisc(
    bubble: ContributorBubble,
    modifier: Modifier,
) {
    Box(
        modifier =
            modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(tone(bubble.tone))
                .border(2.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = bubble.initials,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
        )
    }
}

@Composable
private fun ExtraDisc(
    extra: Int,
    modifier: Modifier,
) {
    Box(
        modifier =
            modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .border(2.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "+$extra",
            color = PantopusColors.appTextStrong,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
        )
    }
}

// MARK: - Mapping helpers

private fun metaLine(content: TypeDatesCardContent): String =
    if (content.daysLeft <= 0) content.dateRange else "${content.dateRange} · ${content.daysLeft} days left"

private fun iconFor(kind: SupportTrainKind): PantopusIcon =
    when (kind) {
        SupportTrainKind.Meals -> PantopusIcon.Utensils
        SupportTrainKind.Rides -> PantopusIcon.Navigation
        SupportTrainKind.Childcare -> PantopusIcon.Baby
        SupportTrainKind.Petcare -> PantopusIcon.PawPrint
        SupportTrainKind.Errands -> PantopusIcon.ShoppingBag
        SupportTrainKind.Visits -> PantopusIcon.Heart
        SupportTrainKind.Generic -> PantopusIcon.HandCoins
    }

internal fun tone(tone: ContributorTone): Color =
    when (tone) {
        ContributorTone.Warning -> PantopusColors.warning
        ContributorTone.Primary -> PantopusColors.primary500
        ContributorTone.Business -> PantopusColors.business
        ContributorTone.Success -> PantopusColors.success
        ContributorTone.Error -> PantopusColors.error
        ContributorTone.Personal -> PantopusColors.personal
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 200)
@Composable
private fun TypeDatesCardPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        TypeDatesCard(
            content =
                TypeDatesCardContent(
                    kind = SupportTrainKind.Meals,
                    title = "Meal train · dinner for 4",
                    dateRange = "Mon Nov 24 → Sun Dec 22",
                    daysLeft = 20,
                    slotsFilled = 12,
                    slotsTotal = 21,
                    contributors =
                        listOf(
                            ContributorBubble(id = "sk", initials = "SK", tone = ContributorTone.Warning),
                            ContributorBubble(id = "tp", initials = "TP", tone = ContributorTone.Primary),
                            ContributorBubble(id = "mo", initials = "MO", tone = ContributorTone.Business),
                            ContributorBubble(id = "rj", initials = "RJ", tone = ContributorTone.Success),
                        ),
                    extraCount = 8,
                ),
        )
    }
}
