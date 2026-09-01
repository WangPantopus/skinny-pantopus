@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.shared.map_list_hybrid

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * T6.6a (P24) — static, render-only preview of the [MapListHybridShell]
 * chrome at a given detent.
 *
 * Lets Paparazzi (and `@Preview` callers) snapshot the shell geometry
 * without spinning up Google Maps — the real `GoogleMap` composable
 * doesn't render under Paparazzi. The map stand-in is a flat pale tile
 * so deterministic snapshots compare cleanly across runs.
 *
 * For the interactive (real) shell, use [MapListHybridShell] directly.
 */
@Composable
fun MapListHybridShellStaticPreview(
    detent: MapListHybridDetent,
    topPill: @Composable () -> Unit,
    categoryChips: @Composable () -> Unit,
    mapControls: @Composable () -> Unit,
    sheetHeader: @Composable () -> Unit,
    sheetBody: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    mapControlsStackHeight: Dp = MAP_CONTROLS_STACK_HEIGHT,
    floatingAction: @Composable () -> Unit = {},
) {
    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("mapListHybridShellPreview"),
    ) {
        val sheetHeight = detent.height(maxHeight)
        val controlsBottom =
            minOf(
                sheetHeight + SHEET_TO_CONTROLS_GAP,
                (maxHeight - mapControlsStackHeight - SHEET_TO_CONTROLS_GAP).coerceAtLeast(SHEET_TO_CONTROLS_GAP),
            )
        val fabBottom =
            minOf(
                sheetHeight + FAB_LIFT_ABOVE_SHEET,
                (maxHeight - FAB_TOP_RESERVE).coerceAtLeast(FAB_LIFT_ABOVE_SHEET),
            )
        // Flat pale-blue stand-in for the live map canvas. Holds a
        // testTag so snapshot tests can target it deterministically.
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color(0xFFE8EDF2))
                    .testTag("mapListHybridStaticMap"),
        )

        Column(
            modifier =
                Modifier
                    .padding(top = Spacing.s2, start = 14.dp, end = 14.dp)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(modifier = Modifier.fillMaxWidth().testTag("mapListHybridTopPill")) {
                topPill()
            }
            Box(modifier = Modifier.fillMaxWidth().testTag("mapListHybridChips")) {
                categoryChips()
            }
        }

        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 14.dp, bottom = controlsBottom)
                    .testTag("mapListHybridMapControls"),
        ) {
            mapControls()
        }

        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 14.dp, bottom = fabBottom)
                    .testTag("mapListHybridFloatingAction"),
        ) {
            floatingAction()
        }

        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(sheetHeight)
                    .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .background(PantopusColors.appSurface)
                    .shadow(elevation = 10.dp, shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .testTag("mapListHybridSheet"),
        ) {
            MapListHybridSheetGrabber()
            Box(modifier = Modifier.testTag("mapListHybridSheetHeader")) { sheetHeader() }
            Box(modifier = Modifier.testTag("mapListHybridSheetBody")) { sheetBody() }
        }
    }
}

/**
 * Canonical preview chrome assembly. Snapshot tests use this so the
 * baseline reflects exactly what designers see when they flip detents.
 */
@Composable
fun MapListHybridPreviewChrome(
    detent: MapListHybridDetent,
    pinCount: Int = 7,
    modifier: Modifier = Modifier,
) {
    MapListHybridShellStaticPreview(
        detent = detent,
        topPill = { PreviewTopPill() },
        categoryChips = { PreviewCategoryChips() },
        mapControls = { PreviewMapControls() },
        sheetHeader = { PreviewSheetHeader(pinCount = pinCount) },
        sheetBody = { PreviewSheetBody(detent = detent, pinCount = pinCount) },
        modifier = modifier,
    )
}

private val PreviewCategories =
    listOf(
        Triple("all", "All", PantopusColors.primary600),
        Triple("handyman", "Handyman", Color(0xFFEA580C)),
        Triple("cleaning", "Cleaning", Color(0xFF0EA5E9)),
        Triple("moving", "Moving", Color(0xFF7C3AED)),
        Triple("petcare", "Pet care", Color(0xFF16A34A)),
        Triple("childcare", "Child care", Color(0xFFDB2777)),
        Triple("tutoring", "Tutoring", Color(0xFFCA8A04)),
    )

@Composable
private fun PreviewTopPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(Color.White.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.pill))
                .padding(start = 6.dp, end = Spacing.s2, top = Spacing.s2, bottom = Spacing.s2)
                .fillMaxWidth()
                .testTag("mapListHybridPreviewTopPill"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = 18.dp,
                tint = PantopusColors.appText,
            )
        }
        Text(
            text = "Gigs",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.SlidersHorizontal,
                contentDescription = "Filters",
                size = Radii.xl,
                tint = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun PreviewCategoryChips() {
    val scrollState = rememberScrollState()
    Row(
        modifier =
            Modifier
                .horizontalScroll(scrollState)
                .padding(horizontal = 14.dp)
                .testTag("mapListHybridPreviewChipRow"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PreviewCategories.forEach { (key, label, color) ->
            val active = key == "all"
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (active) color else Color.White.copy(alpha = 0.96f))
                        .border(
                            width = if (active) 0.dp else 1.dp,
                            color = if (active) Color.Transparent else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        )
                        .shadow(elevation = 4.dp, shape = RoundedCornerShape(Radii.pill))
                        .padding(horizontal = Spacing.s3)
                        .height(28.dp)
                        .testTag("mapListHybridPreviewChip_$key"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                if (key != "all") {
                    Box(
                        modifier =
                            Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (active) Color.White else color),
                    )
                }
                Text(
                    text = label,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun PreviewMapControls() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PreviewControlButton(PantopusIcon.MapPin, "Locate me")
        PreviewControlButton(PantopusIcon.Map, "Layers")
    }
}

@Composable
private fun PreviewControlButton(
    icon: PantopusIcon,
    label: String,
) {
    Box(
        modifier =
            Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .shadow(elevation = 4.dp, shape = CircleShape)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appText,
        )
    }
}

@Composable
private fun PreviewSheetHeader(pinCount: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 18.dp, end = 18.dp, top = Spacing.s1, bottom = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "$pinCount gigs nearby",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.weight(1f))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            modifier = Modifier.testTag("mapListHybridPreviewSort"),
        ) {
            Text(
                text = "Sort:",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Closest",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun PreviewSheetBody(
    detent: MapListHybridDetent,
    pinCount: Int,
) {
    when (detent) {
        MapListHybridDetent.Collapsed -> PreviewCollapsedBody()
        MapListHybridDetent.Standard -> PreviewStandardBody(pinCount = pinCount)
        MapListHybridDetent.Expanded -> PreviewExpandedBody(pinCount = pinCount)
    }
}

@Composable
private fun PreviewCollapsedBody() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("mapListHybridPreviewCollapsedPrompt"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ChevronUp,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Drag up to see the list",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun PreviewStandardBody(pinCount: Int) {
    val scrollState = rememberScrollState()
    Row(
        modifier =
            Modifier
                .horizontalScroll(scrollState)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .testTag("mapListHybridPreviewRail"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        repeat(minOf(pinCount, 3)) { i ->
            PreviewCard(index = i, selected = i == 0)
        }
    }
}

@Composable
private fun PreviewExpandedBody(pinCount: Int) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("mapListHybridPreviewList"),
    ) {
        repeat(pinCount) { i ->
            PreviewRow(index = i, selected = i == 0)
        }
    }
}

@Composable
private fun PreviewCard(
    index: Int,
    selected: Boolean,
) {
    val color = PreviewCategories[(index % (PreviewCategories.size - 1)) + 1].third
    Row(
        modifier =
            Modifier
                .width(240.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (selected) 2.dp else 1.dp,
                    color = if (selected) color else PantopusColors.appBorder,
                    shape = RoundedCornerShape(14.dp),
                )
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(14.dp))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Hammer,
                contentDescription = null,
                size = 22.dp,
                tint = Color.White,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Sample task $index",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "$60 · 0.2 mi",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun PreviewRow(
    index: Int,
    selected: Boolean,
) {
    val color = PreviewCategories[(index % (PreviewCategories.size - 1)) + 1].third
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (selected) color.copy(alpha = 0.06f) else PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Hammer,
                contentDescription = null,
                size = Radii.xl2,
                tint = Color.White,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Sample task $index",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "$60 · 0.2 mi",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}
