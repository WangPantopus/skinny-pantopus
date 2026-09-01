@file:Suppress("MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.screens._internal

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevation
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * Debug-only gallery of every Pantopus design-system token.
 *
 * Reached via a 5-tap easter-egg gesture on the Home title; no production
 * navigation entry.
 */
@Composable
fun TokenGalleryScreen() {
    PantopusTheme {
        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            sectionHeader("Primary")
            items(primaryTokens) { ColorRow(it.name, it.color, it.hex) }

            sectionHeader("Semantic")
            items(semanticTokens) { ColorRow(it.name, it.color, it.hex) }

            sectionHeader("Identity")
            items(identityTokens) { ColorRow(it.name, it.color, it.hex) }

            sectionHeader("Neutrals")
            items(neutralTokens) { ColorRow(it.name, it.color, it.hex) }

            sectionHeader("Categories")
            items(categoryTokens) { ColorRow(it.name, it.color, it.hex) }

            sectionHeader("Spacing")
            items(spacingTokens) { SpacingRow(it.first, it.second) }

            sectionHeader("Radii")
            items(radiiTokens) { RadiusRow(it.first, it.second) }

            sectionHeader("Shadows")
            items(shadowTokens) { ShadowRow(it.first, it.second) }

            sectionHeader("Type")
            items(typeTokens) { TypeRow(it.first, it.second) }

            sectionHeader("Icons")
            items(PantopusIcon.entries.toList(), key = { it.name }) { IconRow(it) }
        }
    }
}

@Composable
private fun IconRow(icon: PantopusIcon) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = icon.lucideName,
            size = Radii.xl3,
            tint = PantopusColors.appText,
        )
        androidx.compose.foundation.layout
            .Spacer(Modifier.width(Spacing.s3))
        Text(icon.lucideName, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}

private data class ColorToken(
    val name: String,
    val color: Color,
    val hex: String,
)

private fun Color.toHexString(): String {
    val argb = toArgb()
    return "#%06X".format(argb and 0xFFFFFF)
}

private fun tok(
    name: String,
    color: Color,
) = ColorToken(name, color, color.toHexString())

private val primaryTokens =
    listOf(
        tok("primary50", PantopusColors.primary50),
        tok("primary100", PantopusColors.primary100),
        tok("primary200", PantopusColors.primary200),
        tok("primary300", PantopusColors.primary300),
        tok("primary400", PantopusColors.primary400),
        tok("primary500", PantopusColors.primary500),
        tok("primary600", PantopusColors.primary600),
        tok("primary700", PantopusColors.primary700),
        tok("primary800", PantopusColors.primary800),
        tok("primary900", PantopusColors.primary900),
    )
private val semanticTokens =
    listOf(
        tok("success", PantopusColors.success),
        tok("successLight", PantopusColors.successLight),
        tok("successBg", PantopusColors.successBg),
        tok("warning", PantopusColors.warning),
        tok("warningLight", PantopusColors.warningLight),
        tok("warningBg", PantopusColors.warningBg),
        tok("error", PantopusColors.error),
        tok("errorLight", PantopusColors.errorLight),
        tok("errorBg", PantopusColors.errorBg),
        tok("info", PantopusColors.info),
        tok("infoLight", PantopusColors.infoLight),
        tok("infoBg", PantopusColors.infoBg),
    )
private val identityTokens =
    listOf(
        tok("personal", PantopusColors.personal),
        tok("personalBg", PantopusColors.personalBg),
        tok("home", PantopusColors.home),
        tok("homeBg", PantopusColors.homeBg),
        tok("business", PantopusColors.business),
        tok("businessBg", PantopusColors.businessBg),
    )
private val neutralTokens =
    listOf(
        tok("appBg", PantopusColors.appBg),
        tok("appSurface", PantopusColors.appSurface),
        tok("appSurfaceRaised", PantopusColors.appSurfaceRaised),
        tok("appSurfaceSunken", PantopusColors.appSurfaceSunken),
        tok("appSurfaceMuted", PantopusColors.appSurfaceMuted),
        tok("appBorder", PantopusColors.appBorder),
        tok("appBorderStrong", PantopusColors.appBorderStrong),
        tok("appBorderSubtle", PantopusColors.appBorderSubtle),
        tok("appText", PantopusColors.appText),
        tok("appTextStrong", PantopusColors.appTextStrong),
        tok("appTextSecondary", PantopusColors.appTextSecondary),
        tok("appTextMuted", PantopusColors.appTextMuted),
        tok("appTextInverse", PantopusColors.appTextInverse),
        tok("appHover", PantopusColors.appHover),
    )
private val categoryTokens =
    listOf(
        tok("handyman", PantopusColors.handyman),
        tok("cleaning", PantopusColors.cleaning),
        tok("moving", PantopusColors.moving),
        tok("petCare", PantopusColors.petCare),
        tok("childCare", PantopusColors.childCare),
        tok("tutoring", PantopusColors.tutoring),
        tok("delivery", PantopusColors.delivery),
        tok("tech", PantopusColors.tech),
        tok("goods", PantopusColors.goods),
        tok("gigs", PantopusColors.gigs),
        tok("rentals", PantopusColors.rentals),
        tok("vehicles", PantopusColors.vehicles),
    )
private val spacingTokens: List<Pair<String, Dp>> =
    listOf(
        "s0" to Spacing.s0,
        "s1" to Spacing.s1,
        "s2" to Spacing.s2,
        "s3" to Spacing.s3,
        "s4" to Spacing.s4,
        "s5" to Spacing.s5,
        "s6" to Spacing.s6,
        "s8" to Spacing.s8,
        "s10" to Spacing.s10,
        "s12" to Spacing.s12,
        "s16" to Spacing.s16,
    )
private val radiiTokens: List<Pair<String, Dp>> =
    listOf(
        "xs" to Radii.xs,
        "sm" to Radii.sm,
        "md" to Radii.md,
        "lg" to Radii.lg,
        "xl" to Radii.xl,
        "xl2" to Radii.xl2,
        "xl3" to Radii.xl3,
        "pill" to 28.dp,
    )
private val shadowTokens: List<Pair<String, PantopusElevation>> =
    listOf(
        "sm" to PantopusElevations.sm,
        "md" to PantopusElevations.md,
        "lg" to PantopusElevations.lg,
        "xl" to PantopusElevations.xl,
        "primary" to PantopusElevations.primary,
    )
private val typeTokens =
    listOf(
        "h1 · 30/36 bold" to PantopusTextStyle.h1,
        "h2 · 24/32 semibold" to PantopusTextStyle.h2,
        "h3 · 20/28 semibold" to PantopusTextStyle.h3,
        "body · 16/24" to PantopusTextStyle.body,
        "small · 14/20" to PantopusTextStyle.small,
        "caption · 12/16" to PantopusTextStyle.caption,
        "overline · 11/16 semibold" to PantopusTextStyle.overline,
    )

private fun androidx.compose.foundation.lazy.LazyListScope.sectionHeader(title: String) {
    item {
        Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4, bottom = Spacing.s2)) {
            Text(title, style = PantopusTextStyle.h3, color = PantopusColors.appText)
            HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
        }
    }
}

@Composable
private fun ColorRow(
    name: String,
    color: Color,
    hex: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(color)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm)),
        )
        Spacer(Modifier.width(Spacing.s3))
        Text(name, style = PantopusTextStyle.body, color = PantopusColors.appText)
        Spacer(Modifier.weight(1f))
        Text(hex, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun SpacingRow(
    name: String,
    value: Dp,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            name,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.width(60.dp),
        )
        Box(
            modifier =
                Modifier
                    .width(if (value.value == 0f) 1.dp else value)
                    .height(12.dp)
                    .background(PantopusColors.primary200),
        )
        Spacer(Modifier.weight(1f))
        Text("$value", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun RadiusRow(
    name: String,
    value: Dp,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            name,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.width(80.dp),
        )
        Box(
            modifier =
                Modifier
                    .width(56.dp)
                    .height(40.dp)
                    .clip(RoundedCornerShape(value))
                    .background(PantopusColors.primary100)
                    .border(1.dp, PantopusColors.primary600, RoundedCornerShape(value)),
        )
        Spacer(Modifier.weight(1f))
        Text("$value", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun ShadowRow(
    name: String,
    elevation: PantopusElevation,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            name,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.width(80.dp),
        )
        Box(
            modifier =
                Modifier
                    .width(72.dp)
                    .height(44.dp)
                    .pantopusShadow(elevation, RoundedCornerShape(Radii.md))
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface),
        )
        Spacer(Modifier.weight(1f))
        Text(
            "α ${"%.2f".format(elevation.alpha)}",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun TypeRow(
    label: String,
    style: androidx.compose.ui.text.TextStyle,
) {
    Column(modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(vertical = Spacing.s1)) {
        val text = if (label.startsWith("overline")) "THE QUICK BROWN FOX" else "The quick brown fox"
        Text(text, style = style, color = PantopusColors.appText)
        Text(label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 2800)
@Composable
private fun TokenGalleryScreenPreview() {
    TokenGalleryScreen()
}
