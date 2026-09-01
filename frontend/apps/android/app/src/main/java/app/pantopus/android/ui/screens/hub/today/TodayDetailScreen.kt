@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.hub.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import java.util.Locale

@Composable
fun TodayDetailScreen(
    onBack: () -> Unit,
    onShare: () -> Unit = {},
    onMore: () -> Unit = {},
    onManage: () -> Unit = {},
    viewModel: TodayDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val headerTitle by viewModel.headerTitle.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    TodayDetailScreenContent(
        state = state,
        headerTitle = headerTitle,
        onBack = onBack,
        onShare = onShare,
        onMore = onMore,
        onManage = onManage,
        onRetry = { viewModel.refresh() },
    )
}

@Composable
internal fun TodayDetailScreenContent(
    state: TodayDetailUiState,
    headerTitle: String = "Today",
    onBack: () -> Unit = {},
    onShare: () -> Unit = {},
    onMore: () -> Unit = {},
    onManage: () -> Unit = {},
    onRetry: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("todayDetail"),
    ) {
        TodayTopBar(
            title = headerTitle,
            dateLabel = state.dateLabel,
            onBack = onBack,
            onShare = onShare,
            onMore = onMore,
        )
        when (val current = state) {
            TodayDetailUiState.Loading -> LoadingBody()
            is TodayDetailUiState.Populated -> TodayBriefing(current.content, onShare, onManage)
            is TodayDetailUiState.Alert -> TodayBriefing(current.content, onShare, onManage)
            is TodayDetailUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load today",
                    subcopy = current.message,
                    modifier = Modifier.testTag("todayDetailError"),
                    ctaTitle = "Try again",
                    onCta = onRetry,
                )
        }
    }
}

private val TodayDetailUiState.dateLabel: String?
    get() =
        when (this) {
            is TodayDetailUiState.Populated -> content.dateLabel
            is TodayDetailUiState.Alert -> content.dateLabel
            else -> null
        }

// MARK: - Top bar

@Composable
private fun TodayTopBar(
    title: String,
    dateLabel: String?,
    onBack: () -> Unit,
    onShare: () -> Unit,
    onMore: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = title,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.testTag("todayHeaderTitle"),
            )
            if (dateLabel != null) {
                Text(text = dateLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
            }
        }
        TopBarButton(
            icon = PantopusIcon.ChevronLeft,
            tag = "todayBackButton",
            label = "Back",
            onClick = onBack,
            modifier = Modifier.align(Alignment.CenterStart).padding(start = Spacing.s2),
        )
        Row(modifier = Modifier.align(Alignment.CenterEnd).padding(end = Spacing.s2)) {
            TopBarButton(
                icon = PantopusIcon.Share,
                tag = "todayShareButton",
                label = "Share today's briefing",
                onClick = onShare,
            )
            TopBarButton(
                icon = PantopusIcon.MoreHorizontal,
                tag = "todayMoreButton",
                label = "More options",
                onClick = onMore,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

@Composable
private fun TopBarButton(
    icon: PantopusIcon,
    tag: String,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(48.dp)
                .clip(CircleShape)
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 22.dp, tint = PantopusColors.appText)
    }
}

// MARK: - Briefing scroll

@Composable
internal fun TodayBriefing(
    content: TodayDetailContent,
    onShare: () -> Unit = {},
    onManage: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        TodayHero(content)

        TodaySectionCard(title = "Sun & sky", modifier = Modifier.testTag("todayDetailSunSky")) {
            SunArc(content.sunSky)
        }

        TodaySectionCard(
            title = content.signalsTitle,
            accent = content.signalsAccent,
            action = SectionAction("Manage", "todaySignalsManage", onManage),
            modifier = Modifier.testTag("todayDetailSignals"),
        ) {
            SignalsList(content.signals)
        }

        if (content.around.isNotEmpty()) {
            TodaySectionCard(title = content.aroundTitle, modifier = Modifier.testTag("todayDetailAround")) {
                AroundList(content.around)
            }
        }

        ShareCard(content.share, onShare)
    }
}

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("todayDetailLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SkeletonBlock(168.dp)
        SkeletonBlock(120.dp)
        SkeletonBlock(240.dp)
        SkeletonBlock(92.dp)
    }
}

@Composable
private fun SkeletonBlock(height: androidx.compose.ui.unit.Dp) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceSunken),
    )
}

// MARK: - Hero

@Composable
private fun TodayHero(content: TodayDetailContent) {
    val kickerColor = if (content.isAlert) PantopusColors.error else PantopusColors.primary600
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4)
                .testTag("todayDetailHero"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = if (content.isAlert) PantopusIcon.AlertTriangle else PantopusIcon.MapPin,
                contentDescription = null,
                size = Radii.lg,
                tint = kickerColor,
            )
            Text(
                text = content.kicker.uppercase(Locale.getDefault()),
                style = PantopusTextStyle.overline,
                color = kickerColor,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(content.temperature, style = PantopusTextStyle.h1, color = PantopusColors.appText)
                    Text(
                        content.condition,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(bottom = Spacing.s1),
                    )
                }
                Text(content.highLowFeels, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            Box(
                modifier =
                    Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(content.glyph, null, size = 30.dp, tint = PantopusColors.primary600)
            }
        }

        content.ribbon?.let { TodayRibbon(it) }

        FlowRow(
            modifier = Modifier.fillMaxWidth().testTag("todayDetailChips"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            content.chips.forEach { HeroChip(it) }
        }
    }
}

@Composable
private fun TodayRibbon(ribbon: TodayAlertRibbon) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("todayDetailRibbon"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(PantopusIcon.AlertTriangle, null, size = Radii.xl, tint = PantopusColors.error)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                ribbon.title,
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.error,
            )
            Text(ribbon.body, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
        }
    }
}

@Composable
private fun HeroChip(chip: TodayHeroChip) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("todayChip-${chip.label}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        chip.dotTone?.let { Dot(it.foreground(), 7.dp) }
        PantopusIconImage(chip.icon, null, size = Radii.lg, tint = PantopusColors.appTextStrong)
        Text(chip.label.uppercase(Locale.getDefault()), style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
        Text(
            chip.value,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        chip.scale?.let { Text(it, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted) }
    }
}

// MARK: - Section card

private data class SectionAction(val label: String, val tag: String, val onClick: () -> Unit)

@Composable
private fun TodaySectionCard(
    title: String,
    modifier: Modifier = Modifier,
    accent: TodayTone? = null,
    action: SectionAction? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            accent?.let { Dot(it.foreground(), 6.dp) }
            Text(
                text = title.uppercase(Locale.getDefault()),
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.weight(1f))
            action?.let { act ->
                Text(
                    text = act.label,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .heightIn(min = 48.dp)
                            .widthIn(min = 48.dp)
                            .clickable(onClick = act.onClick)
                            .testTag(act.tag)
                            .semantics { contentDescription = "${act.label} $title" }
                            .padding(vertical = Spacing.s3),
                )
            }
        }
        content()
    }
}

// MARK: - Sun & sky

@Composable
private fun SunArc(sunSky: TodaySunSky) {
    val arcColor = PantopusColors.warning
    val baseLineColor = PantopusColors.appBorder
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Canvas(modifier = Modifier.fillMaxWidth().height(80.dp)) {
            val w = size.width
            val h = size.height
            val pad = 8.dp.toPx()
            val baseY = h - 6.dp.toPx()
            val peakY = 6.dp.toPx()
            val startX = pad
            val endX = w - pad
            val cx = w / 2f
            val t = sunSky.progress.coerceIn(0f, 1f)
            val sunX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cx + t * t * endX
            val sunY = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * peakY + t * t * baseY

            drawLine(
                color = baseLineColor,
                start = Offset(0f, baseY),
                end = Offset(w, baseY),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 4.dp.toPx())),
            )
            val arc =
                Path().apply {
                    moveTo(startX, baseY)
                    quadraticTo(cx, peakY, endX, baseY)
                }
            drawPath(arc, arcColor, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
            drawCircle(arcColor.copy(alpha = 0.18f), radius = 14.dp.toPx(), center = Offset(sunX, sunY))
            drawCircle(arcColor, radius = 10.dp.toPx(), center = Offset(sunX, sunY))
        }

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            SunLabel(sunSky.sunrise, "Sunrise", Alignment.Start)
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    sunSky.phaseLabel.uppercase(Locale.getDefault()),
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.warning,
                )
                Text(sunSky.daylight, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            SunLabel(sunSky.sunset, "Sunset", Alignment.End)
        }
    }
}

@Composable
private fun SunLabel(
    value: String,
    caption: String,
    alignment: Alignment.Horizontal,
) {
    Column(horizontalAlignment = alignment) {
        Text(value, style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
        Text(caption.uppercase(Locale.getDefault()), style = PantopusTextStyle.overline, color = PantopusColors.appTextMuted)
    }
}

// MARK: - Signals

@Composable
private fun SignalsList(signals: List<TodaySignal>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        signals.forEachIndexed { index, signal ->
            if (index > 0) {
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
            }
            SignalRow(signal)
        }
    }
}

@Composable
private fun SignalRow(signal: TodaySignal) {
    Box(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min).testTag("todaySignal-${signal.id}")) {
        signal.severity?.let { sev ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .width(4.dp)
                        .fillMaxHeight()
                        .background(sev.tone.foreground()),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(signal.tone.tint()),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(signal.icon, null, size = 15.dp, tint = signal.tone.foreground())
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        signal.title,
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    signal.severity?.let { SeverityPill(it) }
                }
                Text(signal.body, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            Text(signal.timing, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun SeverityPill(severity: TodaySignalSeverity) {
    Text(
        text = severity.label.uppercase(Locale.getDefault()),
        style = PantopusTextStyle.overline,
        color = severity.tone.foreground(),
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(severity.tone.tint())
                .padding(horizontal = Spacing.s1),
    )
}

// MARK: - Around the block

@Composable
private fun AroundList(items: List<TodayAroundItem>) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        items.forEach { item ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Dot(item.tone.foreground(), 6.dp)
                Text(item.text, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
            }
        }
    }
}

// MARK: - Share card

@Composable
private fun ShareCard(
    share: TodayShareCard,
    onShare: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .testTag("todayDetailShareCard"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Share, null, size = 18.dp, tint = PantopusColors.primary600)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                share.title,
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(share.subtitle, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onShare)
                    .heightIn(min = 48.dp)
                    .padding(horizontal = Spacing.s3)
                    .testTag("todayShareCardButton")
                    .semantics { contentDescription = "Share" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(PantopusIcon.Send, null, size = 13.dp, tint = PantopusColors.appTextInverse)
            Text(
                "Share",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

// MARK: - Shared bits

@Composable
private fun Dot(
    color: Color,
    diameter: androidx.compose.ui.unit.Dp,
) {
    Box(modifier = Modifier.size(diameter).clip(CircleShape).background(color))
}

private fun TodayTone.foreground(): Color =
    when (this) {
        TodayTone.Neutral -> PantopusColors.appTextStrong
        TodayTone.Personal -> PantopusColors.personal
        TodayTone.Home -> PantopusColors.home
        TodayTone.Business -> PantopusColors.business
        TodayTone.Success -> PantopusColors.success
        TodayTone.Warning -> PantopusColors.warning
        TodayTone.Error -> PantopusColors.error
    }

private fun TodayTone.tint(): Color =
    when (this) {
        TodayTone.Neutral -> PantopusColors.appSurfaceSunken
        TodayTone.Personal -> PantopusColors.personalBg
        TodayTone.Home -> PantopusColors.homeBg
        TodayTone.Business -> PantopusColors.businessBg
        TodayTone.Success -> PantopusColors.successBg
        TodayTone.Warning -> PantopusColors.warningBg
        TodayTone.Error -> PantopusColors.errorBg
    }
