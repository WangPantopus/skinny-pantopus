@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.PausedExpiredUnavailableState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTerminalState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun PublicPagePreviewScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: PublicPagePreviewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pillar = viewModel.pillar
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PreviewBar(onExit = onBack)
        PreviewCaption()
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when (val s = state) {
                PreviewUiState.Loading -> SchedulingLoadingSkeleton(modifier = Modifier.fillMaxSize(), rows = 4)
                is PreviewUiState.Rendered -> RenderedBody(s, pillar)
                is PreviewUiState.AllHidden -> AllHiddenBody(s, pillar)
                is PreviewUiState.Notice ->
                    PausedExpiredUnavailableState(
                        state = SchedulingTerminalState.Paused,
                        pillar = pillar,
                        title = s.title,
                        body = s.body,
                    )
                is PreviewUiState.Error ->
                    ErrorState(headline = "Couldn't load preview", message = s.message, onRetry = viewModel::refresh)
            }
        }
    }
}

@Composable
private fun PreviewBar(onExit: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appText)
                .statusBarsPadding()
                .padding(horizontal = 14.dp, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextInverse)
        Text(
            "Previewing your booking page",
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.5.sp,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceDark)
                    .clickable(onClickLabel = "Close preview", onClick = onExit)
                    .testTag("previewExit"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Close preview",
                size = 15.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun PreviewCaption() {
    Box(modifier = Modifier.fillMaxWidth().padding(top = 9.dp, bottom = 3.dp), contentAlignment = Alignment.Center) {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = 11.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.EyeOff, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextSecondary)
            Text(
                "Preview only. Nothing here is bookable.",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun RenderedBody(
    s: PreviewUiState.Rendered,
    pillar: SchedulingPillar,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            PublicHeader(s.header, pillar)
            s.eventTypes.forEachIndexed { index, et -> EventTypeCard(et, selected = index == 0, pillar = pillar) }
        }
        InertPickTimeCta(pillar)
    }
}

@Composable
private fun AllHiddenBody(
    s: PreviewUiState.AllHidden,
    pillar: SchedulingPillar,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        PublicHeader(s.header, pillar)
        // Design (booking-preview-frames.jsx:286): 1px dashed border using appBorderStrong.
        // Compose's border() only draws solid strokes; drawBehind with PathEffect.dashPathEffect
        // replicates the design's CSS "1px dashed" appearance.
        val borderColor = PantopusColors.appBorderStrong
        val cornerRadius = Radii.xl
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(cornerRadius))
                    .background(PantopusColors.appSurface)
                    .drawBehind {
                        val strokeWidthPx = 1.dp.toPx()
                        val dashLen = 6.dp.toPx()
                        val gapLen = 4.dp.toPx()
                        val cornerPx = cornerRadius.toPx()
                        drawRoundRect(
                            color = borderColor,
                            size = size,
                            cornerRadius = androidx.compose.ui.geometry.CornerRadius(cornerPx),
                            style =
                                Stroke(
                                    width = strokeWidthPx,
                                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(dashLen, gapLen)),
                                ),
                        )
                    }
                    .padding(vertical = Spacing.s6, horizontal = Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Box(
                modifier = Modifier.size(42.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CalendarX,
                    contentDescription = null,
                    size = 20.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Text("No services are visible yet", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(
                "Turn one on so people see something to book.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                lineHeight = 17.sp,
            )
        }
    }
}

@Composable
private fun PublicHeader(
    header: PreviewHeader,
    pillar: SchedulingPillar,
) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        BLAvatar(initials = header.initials, pillar = pillar, diameter = 64.dp, fontSize = 22.sp)
        Text(
            header.name.ifBlank { "Your name" },
            color = PantopusColors.appText,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 7.dp),
        )
        if (header.headline.isNotBlank()) {
            Text(
                header.headline,
                color = PantopusColors.primary700,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.5.sp,
                modifier = Modifier.padding(top = 3.dp),
            )
        }
        if (header.blurb.isNotBlank()) {
            Text(
                header.blurb,
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                lineHeight = 17.sp,
                modifier = Modifier.padding(top = Spacing.s1),
            )
        }
    }
}

@Composable
private fun EventTypeCard(
    et: PublicEventTypeView,
    selected: Boolean,
    pillar: SchedulingPillar,
) {
    val duration = et.defaultDuration ?: et.durations.firstOrNull() ?: 30
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    if (selected) 1.5.dp else 1.dp,
                    if (selected) pillar.accent else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.xl),
                )
                .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (selected) pillar.accentBg else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = serviceIcon(et.locationMode),
                contentDescription = null,
                size = 18.dp,
                tint = if (selected) pillar.accent else PantopusColors.appTextStrong,
            )
        }
        Column(Modifier.weight(1f)) {
            Text(et.name.orEmpty(), color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(
                modifier = Modifier.padding(top = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Clock,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text("$duration min", color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
                }
                ModeChip(et.locationMode, pillar)
            }
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun ModeChip(
    locationMode: String?,
    pillar: SchedulingPillar,
) {
    val label =
        when (locationMode) {
            "video" -> "Video call"
            "phone" -> "Phone call"
            "in_person" -> "In person"
            else -> "Online"
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(pillar.accentBg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = serviceIcon(locationMode), contentDescription = null, size = 10.dp, tint = pillar.accent)
        Text(label, color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 10.sp)
    }
}

@Composable
private fun InertPickTimeCta(pillar: SchedulingPillar) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s4),
    ) {
        // Spec: sticky footer carries a 1px top hairline separating it from scrolled content.
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.s2)
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(pillar.accent),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text("Pick a time", color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
