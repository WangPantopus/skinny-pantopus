@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.page_blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * C4 — read-only rendering of page blocks. Mirrors RN
 * `src/components/business/blocks/BlockRenderer.tsx` and iOS
 * `BusinessPageBlockPreview.swift`; used by both the builder's preview mode
 * and the public named-page section reached from
 * `pantopus://b/:username/:slug`.
 */
@Composable
fun BusinessPageBlocksPreview(
    blocks: List<BusinessPageBlock>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("businessPageBlocks.preview"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        blocks.filter { it.isVisible }.sortedBy { it.sortOrder }.forEach { block ->
            BusinessPageBlockPreview(block = block)
        }
    }
}

/** One block rendered the way a visitor sees it. */
@Composable
fun BusinessPageBlockPreview(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    when (block.kind) {
        BusinessPageBlockKind.Hero -> HeroBlock(block, modifier)
        BusinessPageBlockKind.Text -> TextBlock(block, modifier)
        BusinessPageBlockKind.Gallery -> GalleryBlock(block, modifier)
        BusinessPageBlockKind.CatalogGrid ->
            HeadingWithNote(block, "Catalog items appear here on the live page.", modifier)
        BusinessPageBlockKind.Hours ->
            HeadingWithNote(block, "Hours are pulled from your business locations.", modifier)
        BusinessPageBlockKind.LocationsMap ->
            HeadingWithNote(block, "Locations are pulled from your business settings.", modifier)
        BusinessPageBlockKind.Cta -> CtaBlock(block, modifier)
        BusinessPageBlockKind.Faq -> FaqBlock(block, modifier)
        BusinessPageBlockKind.Reviews ->
            HeadingWithNote(block, "Reviews are pulled from your profile.", modifier)
        BusinessPageBlockKind.Stats -> StatsBlock(block, modifier)
        BusinessPageBlockKind.Team ->
            HeadingWithNote(block, "Team members will be displayed here.", modifier)
        BusinessPageBlockKind.ContactForm ->
            HeadingWithNote(block, "Visitors can send you a message here.", modifier)
        BusinessPageBlockKind.Embed -> EmbedBlock(block, modifier)
        BusinessPageBlockKind.PostsFeed ->
            HeadingWithNote(block, "Posts will appear here when available.", modifier)
        BusinessPageBlockKind.Divider -> DividerBlock(modifier)
        is BusinessPageBlockKind.Unknown -> UnknownBlock(block.kind.rawValue, modifier)
    }
}

@Composable
private fun HeroBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.business)
                .padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = block.headline.ifEmpty { "Welcome" },
            style = PantopusTextStyle.h2,
            color = PantopusColors.appTextInverse,
        )
        if (block.subhead.isNotEmpty()) {
            Text(
                text = block.subhead,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextInverse,
            )
        }
        ButtonRow(block.buttonList("cta"), onDark = true)
    }
}

@Composable
private fun TextBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        HeadingText(block)
        if (block.body.isNotEmpty()) {
            Text(
                text = block.body,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun GalleryBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HeadingText(block)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            repeat(minOf(block.imageCount, 3)) {
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Image,
                        contentDescription = null,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
    }
}

@Composable
private fun CtaBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.businessBg)
                .padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = block.heading.ifEmpty { "Get in touch" },
            style = PantopusTextStyle.h3,
            color = PantopusColors.appTextStrong,
        )
        if (block.subhead.isNotEmpty()) {
            Text(
                text = block.subhead,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
        }
        ButtonRow(block.buttonList("buttons"), onDark = false)
    }
}

@Composable
private fun FaqBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HeadingText(block)
        block.faqItems.forEach { item ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = item.question.ifEmpty { "Question" },
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextStrong,
                )
                if (item.answer.isNotEmpty()) {
                    Text(
                        text = item.answer,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatsBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        block.stats.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                pair.forEach { stat ->
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.appSurfaceSunken)
                                .padding(Spacing.s3),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        Text(
                            text = stat.value,
                            style = PantopusTextStyle.h2,
                            color = PantopusColors.appTextStrong,
                        )
                        Text(
                            text = stat.label,
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                if (pair.size == 1) Box(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun EmbedBlock(
    block: BusinessPageBlock,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Globe,
            contentDescription = null,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = if (block.url.isEmpty()) "No embed URL" else "Embedded: ${block.url}",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun DividerBlock(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s2)
                .height(1.dp)
                .background(PantopusColors.appBorder),
    )
}

@Composable
private fun UnknownBlock(
    raw: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Package,
            contentDescription = null,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "Unsupported block “$raw” — update the app to see it.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun HeadingText(block: BusinessPageBlock) {
    if (block.heading.isNotEmpty()) {
        Text(
            text = block.heading,
            style = PantopusTextStyle.h3,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun HeadingWithNote(
    block: BusinessPageBlock,
    note: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        HeadingText(block)
        Text(
            text = note,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun ButtonRow(
    buttons: List<BusinessPageBlockButton>,
    onDark: Boolean,
) {
    if (buttons.isEmpty()) return
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        buttons.forEachIndexed { index, button ->
            val background: Color =
                if (onDark) {
                    if (index == 0) PantopusColors.appSurface else PantopusColors.businessDark
                } else {
                    if (index == 0) PantopusColors.business else PantopusColors.appSurface
                }
            val foreground: Color =
                if (onDark) {
                    if (index == 0) PantopusColors.business else PantopusColors.appTextInverse
                } else {
                    if (index == 0) PantopusColors.appTextInverse else PantopusColors.appTextStrong
                }
            Text(
                text = button.label.ifEmpty { "Learn More" },
                style = PantopusTextStyle.caption,
                color = foreground,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(background)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            )
        }
    }
}
