@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.unboxing.components

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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.unboxing.UnboxingDrawer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.14 `DrawerSuggestion` slot — the AI-classified filing destination. A
 * "File into" header with a "Suggested by Pantopus" chip, the selected
 * suggested drawer (accent ring + confidence "96% match"), a hairline "Or
 * re-route to" list of alternatives with selection radios, and a "Choose
 * another drawer" footer button. Mirrors iOS `DrawerSuggestionCard`.
 */
@Composable
fun DrawerSuggestionCard(
    accent: Color,
    accentDark: Color,
    accentBg: Color,
    suggestion: UnboxingDrawer,
    alternates: List<UnboxingDrawer>,
    onSelectAlternate: (UnboxingDrawer) -> Unit,
    onChooseAnother: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("unboxing_drawerSuggestion"),
    ) {
        Header()
        SuggestedRow(accent = accent, accentDark = accentDark, accentBg = accentBg, suggestion = suggestion)
        ReRouteHeader()
        alternates.forEachIndexed { index, alt ->
            if (index > 0) HorizontalDivider(color = PantopusColors.appBorderSubtle)
            AlternateRow(alt = alt, onClick = { onSelectAlternate(alt) })
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        ChooseAnotherButton(onClick = onChooseAnother)
    }
}

@Composable
private fun Header() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = "File into".uppercase(), style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
        Box(modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Suggested by Pantopus",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun SuggestedRow(
    accent: Color,
    accentDark: Color,
    accentBg: Color,
    suggestion: UnboxingDrawer,
) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3)
                .padding(bottom = Spacing.s3)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(accentBg)
                .border(1.5.dp, accent, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .semantics {
                    contentDescription =
                        "Suggested: ${suggestion.drawer}, ${suggestion.folder}" +
                        (suggestion.confidence?.let { ", $it percent match" } ?: "")
                }
                .testTag("unboxing_drawerSuggested"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SwatchTile(drawer = suggestion, size = 40.dp, iconSize = 19.dp, background = suggestion.tint.swatchBg)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = drawerPath(suggestion), fontSize = 14.sp)
            if (suggestion.confidence != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.BadgeCheck,
                        contentDescription = null,
                        size = 12.dp,
                        tint = accentDark,
                    )
                    Text(
                        text = "${suggestion.confidence}% match",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = accentDark,
                    )
                }
            }
        }
        Box(
            modifier = Modifier.size(24.dp).clip(CircleShape).background(accent),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun ReRouteHeader() {
    Text(
        text = "Or re-route to".uppercase(),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        color = PantopusColors.appTextMuted,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .padding(top = Spacing.s2, bottom = Spacing.s1),
    )
}

@Composable
private fun AlternateRow(
    alt: UnboxingDrawer,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "Re-route to ${alt.drawer}, ${alt.folder}" }
                .testTag("unboxing_drawerAlternate_${alt.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SwatchTile(drawer = alt, size = 32.dp, iconSize = 15.dp, background = PantopusColors.appSurfaceSunken)
        Text(text = drawerPath(alt), fontSize = 13.sp, modifier = Modifier.weight(1f))
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .border(1.5.dp, PantopusColors.appBorderStrong, CircleShape),
        )
    }
}

@Composable
private fun ChooseAnotherButton(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("unboxing_chooseAnotherDrawer"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FolderPlus,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Choose another drawer",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun SwatchTile(
    drawer: UnboxingDrawer,
    size: androidx.compose.ui.unit.Dp,
    iconSize: androidx.compose.ui.unit.Dp,
    background: Color,
) {
    Box(
        modifier = Modifier.size(size).clip(RoundedCornerShape(Radii.md)).background(background),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = drawer.tint.icon,
            contentDescription = null,
            size = iconSize,
            tint = drawer.tint.swatch,
        )
    }
}

/** "Home › Warranties & Receipts" — drawer + folder bold, separator muted. */
private fun drawerPath(drawer: UnboxingDrawer) =
    buildAnnotatedString {
        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.appText)) { append(drawer.drawer) }
        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextMuted)) { append("  ›  ") }
        withStyle(
            SpanStyle(
                fontWeight = if (drawer.confidence == null) FontWeight.SemiBold else FontWeight.Bold,
                color = PantopusColors.appText,
            ),
        ) { append(drawer.folder) }
    }
