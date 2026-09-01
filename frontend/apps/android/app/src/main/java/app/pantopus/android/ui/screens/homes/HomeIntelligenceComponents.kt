@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.homedashboard.HomeBillBenchmarkDto
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendSeriesDto
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Home Intelligence stack rendered under the dashboard's Overview
 * tab: health-score ring, seasonal checklist, property value, and bill
 * trends. Mirrors iOS `Features/Homes/HomeIntelligenceComponents.swift`
 * and RN's `components/home/…`.
 *
 * Every card owns its four states (loading / loaded / empty / error) so a
 * single failing read never blanks the dashboard.
 */

private val RingSize = 120.dp
private val RingStroke = 8.dp

// ── Health score ────────────────────────────────────────────────────

/** `GET /api/homes/:id/health-score`. */
@Composable
fun HealthScoreRingCard(
    state: HomeIntelligenceCardState<HomeHealthScoreDto>,
    onAction: (String) -> Unit,
    onRetry: () -> Unit,
) {
    DashboardCard(
        title = "Home health",
        accent = PantopusColors.home,
        modifier = Modifier.testTag("homeDashboard_healthScoreCard"),
    ) {
        when (state) {
            HomeIntelligenceCardState.Loading ->
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Shimmer(width = RingSize, height = RingSize, cornerRadius = RingSize)
                    Shimmer(width = 180.dp, height = 12.dp)
                    Shimmer(width = 120.dp, height = 12.dp)
                }
            HomeIntelligenceCardState.Forbidden ->
                CardNote("You don't have access to this home's health score.")
            is HomeIntelligenceCardState.Failed ->
                CardError(
                    headline = "Couldn't load home health",
                    message = state.message,
                    retryTag = "homeDashboard_healthScoreRetry",
                    onRetry = onRetry,
                )
            is HomeIntelligenceCardState.Loaded ->
                if (state.value.isBrandNewHome) {
                    HealthOnboarding(onAction = onAction)
                } else {
                    HealthScoreBody(score = state.value, onAction = onAction)
                }
        }
    }
}

@Composable
private fun HealthOnboarding(onAction: (String) -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Home,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.home,
            )
        }
        Text(
            text = "Let's set up your home",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Complete these steps to see your Home Health Score",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        HealthQuickWin(PantopusIcon.Siren, "Add an emergency contact", "view_emergency", onAction)
        HealthQuickWin(PantopusIcon.FileText, "Upload a home document", "view_docs", onAction)
        HealthQuickWin(PantopusIcon.Users, "Invite a household member", "add_member", onAction)
    }
}

@Composable
private fun HealthQuickWin(
    icon: PantopusIcon,
    label: String,
    actionId: String,
    onAction: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable { onAction(actionId) }
                .padding(horizontal = Spacing.s3)
                .testTag("homeDashboard_healthQuickWin_$actionId")
                .semantics {
                    role = Role.Button
                    contentDescription = label
                },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.primary600)
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun HealthScoreBody(
    score: HomeHealthScoreDto,
    onAction: (String) -> Unit,
) {
    val tint = healthTint(score.score)
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(RingSize)
                    .semantics {
                        contentDescription = "Home health score ${score.score} out of 100"
                    },
            contentAlignment = Alignment.Center,
        ) {
            val trackColor = PantopusColors.appSurfaceSunken
            val progress = (score.score.coerceIn(0, 100)) / 100f
            Canvas(modifier = Modifier.fillMaxWidth().fillMaxHeight()) {
                val stroke = RingStroke.toPx()
                val inset = stroke / 2
                val arcSize = Size(size.width - stroke, size.height - stroke)
                drawArc(
                    color = trackColor,
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = arcSize,
                    style = Stroke(width = stroke),
                )
                drawArc(
                    color = tint,
                    startAngle = -90f,
                    sweepAngle = 360f * progress,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = score.score.toString(),
                    style = PantopusTextStyle.h2,
                    fontWeight = FontWeight.Bold,
                    color = tint,
                )
                Text(
                    text = "/100",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        score.topIssue?.let { issue ->
            Text(
                text = issue,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                maxLines = 2,
            )
        }

        val action = score.topAction
        val actionId = action?.route?.let { healthActionId(it) }
        if (action != null && actionId != null) {
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .border(1.dp, tint.copy(alpha = 0.4f), RoundedCornerShape(Radii.pill))
                        .clickable { onAction(actionId) }
                        .padding(horizontal = Spacing.s4)
                        .testTag("homeDashboard_healthTopAction")
                        .semantics {
                            role = Role.Button
                            contentDescription = action.label
                        },
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = action.label,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = tint,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = tint,
                )
            }
        }
    }
}

private fun healthTint(score: Int): Color =
    when {
        score >= 75 -> PantopusColors.success
        score >= 40 -> PantopusColors.warning
        else -> PantopusColors.error
    }

/**
 * Map the backend's `topAction.route`
 * (`backend/services/homeHealthService.js:129`) onto a dashboard action
 * id. `/dashboard` targets the checklist card directly below, so it
 * renders no chip.
 */
fun healthActionId(route: String): String? =
    when (route.substringAfterLast('/')) {
        "maintenance" -> "view_maintenance"
        "bills" -> "view_bills"
        "emergency" -> "view_emergency"
        "members" -> "add_member"
        "documents", "docs" -> "view_docs"
        else -> null
    }

// ── Seasonal checklist ──────────────────────────────────────────────

/**
 * `GET /api/homes/:id/seasonal-checklist` +
 * `PATCH …/seasonal-checklist/:itemId`.
 */
@Composable
fun SeasonalChecklistCard(
    state: HomeIntelligenceCardState<SeasonalChecklistDto>,
    pendingItemIds: Set<String>,
    onComplete: (String) -> Unit,
    onSkip: (String) -> Unit,
    onHireHelp: (SeasonalChecklistItemDto) -> Unit,
    onGenerate: () -> Unit,
    onRetry: () -> Unit,
) {
    var carryoverExpanded by remember { mutableStateOf(false) }

    DashboardCard(
        title = "Seasonal checklist",
        accent = PantopusColors.success,
        modifier = Modifier.testTag("homeDashboard_seasonalChecklistCard"),
    ) {
        when (state) {
            HomeIntelligenceCardState.Loading ->
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Shimmer(width = 160.dp, height = 14.dp)
                    Shimmer(width = 320.dp, height = 4.dp, cornerRadius = Radii.xs)
                    repeat(3) { Shimmer(width = 280.dp, height = 20.dp) }
                }
            HomeIntelligenceCardState.Forbidden ->
                CardNote("You don't have access to this home's checklist.")
            is HomeIntelligenceCardState.Failed ->
                CardError(
                    headline = "Couldn't load the seasonal checklist",
                    message = state.message,
                    retryTag = "homeDashboard_seasonalChecklistRetry",
                    onRetry = onRetry,
                )
            is HomeIntelligenceCardState.Loaded ->
                if (state.value.items.isEmpty()) {
                    SeasonalEmpty(onGenerate = onGenerate)
                } else {
                    SeasonalLoaded(
                        checklist = state.value,
                        pendingItemIds = pendingItemIds,
                        carryoverExpanded = carryoverExpanded,
                        onToggleCarryover = { carryoverExpanded = !carryoverExpanded },
                        onComplete = onComplete,
                        onSkip = onSkip,
                        onHireHelp = onHireHelp,
                    )
                }
        }
    }
}

@Composable
private fun SeasonalEmpty(onGenerate: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Leaf,
            contentDescription = null,
            size = 28.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Your seasonal checklist is ready",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Get personalized seasonal tasks for your home",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Row(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onGenerate)
                    .padding(horizontal = Spacing.s4)
                    .testTag("homeDashboard_seasonalGenerateCTA")
                    .semantics {
                        role = Role.Button
                        contentDescription = "Generate checklist"
                    },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Generate checklist",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun SeasonalLoaded(
    checklist: SeasonalChecklistDto,
    pendingItemIds: Set<String>,
    carryoverExpanded: Boolean,
    onToggleCarryover: () -> Unit,
    onComplete: (String) -> Unit,
    onSkip: (String) -> Unit,
    onHireHelp: (SeasonalChecklistItemDto) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = seasonIcon(checklist.season.key),
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = checklist.season.label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "${checklist.progress.completed}/${checklist.progress.total} done",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }

        ProgressTrack(percentage = checklist.progress.percentage)

        checklist.items.forEach { item ->
            SeasonalRow(
                item = item,
                isPending = pendingItemIds.contains(item.id),
                onComplete = onComplete,
                onSkip = onSkip,
                onHireHelp = onHireHelp,
            )
        }

        val carryover = checklist.carryover
        if (carryover != null && carryover.items.isNotEmpty()) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable(onClick = onToggleCarryover)
                        .testTag("homeDashboard_seasonalCarryoverToggle")
                        .semantics {
                            role = Role.Button
                            contentDescription = "From last season, ${carryover.season.label}"
                        },
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = if (carryoverExpanded) PantopusIcon.ChevronDown else PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "From last season (${carryover.season.label})",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${carryover.items.size} remaining",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }
            if (carryoverExpanded) {
                carryover.items.forEach { item ->
                    SeasonalRow(
                        item = item,
                        isPending = pendingItemIds.contains(item.id),
                        onComplete = onComplete,
                        onSkip = onSkip,
                        onHireHelp = onHireHelp,
                    )
                }
            }
        }
    }
}

@Composable
private fun SeasonalRow(
    item: SeasonalChecklistItemDto,
    isPending: Boolean,
    onComplete: (String) -> Unit,
    onSkip: (String) -> Unit,
    onHireHelp: (SeasonalChecklistItemDto) -> Unit,
) {
    val done = item.isResolved
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(enabled = !done && !isPending) { onComplete(item.id) }
                    .testTag("homeDashboard_seasonalItemToggle_${item.id}")
                    .semantics {
                        role = Role.Button
                        contentDescription = "Mark ${item.title} complete"
                    },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = statusIcon(item.status),
                contentDescription = null,
                size = 22.dp,
                tint = statusTint(item.status),
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                style = PantopusTextStyle.small,
                color = if (done) PantopusColors.appTextSecondary else PantopusColors.appText,
                textDecoration = if (done) TextDecoration.LineThrough else null,
                maxLines = 1,
            )
            val description = item.description
            if (!done && !description.isNullOrEmpty()) {
                Text(
                    text = description,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }

        if (item.status == "pending") {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(enabled = !isPending) { onSkip(item.id) }
                        .testTag("homeDashboard_seasonalItemSkip_${item.id}")
                        .semantics {
                            role = Role.Button
                            contentDescription = "Skip ${item.title}"
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            if (item.gigCategory != null) {
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 32.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.primary600)
                            .clickable { onHireHelp(item) }
                            .padding(horizontal = Spacing.s3)
                            .testTag("homeDashboard_seasonalItemHire_${item.id}")
                            .semantics {
                                role = Role.Button
                                contentDescription = "Hire help for ${item.title}"
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Hire",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProgressTrack(percentage: Int) {
    val tint =
        when {
            percentage >= 100 -> PantopusColors.success
            percentage >= 50 -> PantopusColors.warning
            else -> PantopusColors.primary600
        }
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.appSurfaceSunken),
    ) {
        val fraction = percentage.coerceIn(0, 100) / 100f
        if (fraction > 0f) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(fraction = fraction)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(tint),
            )
        }
    }
}

internal fun seasonIcon(key: String): PantopusIcon =
    when {
        key.contains("winter") || key.contains("ice") -> PantopusIcon.Snowflake
        key.contains("summer") || key.contains("dry") -> PantopusIcon.Sun
        key.contains("smoke") -> PantopusIcon.Cloud
        key.contains("holiday") -> PantopusIcon.Gift
        else -> PantopusIcon.Leaf
    }

private fun statusIcon(status: String): PantopusIcon =
    when (status) {
        "completed" -> PantopusIcon.CheckCircle
        "skipped" -> PantopusIcon.XCircle
        "hired" -> PantopusIcon.Briefcase
        else -> PantopusIcon.Circle
    }

private fun statusTint(status: String): Color =
    when (status) {
        "completed" -> PantopusColors.success
        "skipped" -> PantopusColors.appTextSecondary
        "hired" -> PantopusColors.business
        else -> PantopusColors.appTextMuted
    }

// ── Property value ──────────────────────────────────────────────────

/** `GET /api/homes/:id/property-value`. */
@Composable
fun PropertyValueCard(
    state: HomeIntelligenceCardState<HomePropertyValueDto>,
    onRetry: () -> Unit,
) {
    DashboardCard(
        title = "Estimated home value",
        accent = PantopusColors.primary600,
        modifier = Modifier.testTag("homeDashboard_propertyValueCard"),
    ) {
        when (state) {
            HomeIntelligenceCardState.Loading ->
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Shimmer(width = 140.dp, height = 28.dp)
                    Shimmer(width = 120.dp, height = 12.dp)
                    Shimmer(width = 180.dp, height = 12.dp)
                }
            HomeIntelligenceCardState.Forbidden ->
                CardNote("You don't have access to this home's valuation.")
            is HomeIntelligenceCardState.Failed ->
                CardError(
                    headline = "Couldn't load the property value",
                    message = state.message,
                    retryTag = "homeDashboard_propertyValueRetry",
                    onRetry = onRetry,
                )
            is HomeIntelligenceCardState.Loaded -> {
                val estimate = state.value.estimatedValue
                if (estimate == null) {
                    PropertyValueUnavailable()
                } else {
                    PropertyValueBody(value = state.value, estimate = estimate)
                }
            }
        }
    }
}

@Composable
private fun PropertyValueUnavailable() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.TrendingUp,
            contentDescription = null,
            size = 26.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Property insights coming soon",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "We'll show your home's estimated value once your address is fully verified.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun PropertyValueBody(
    value: HomePropertyValueDto,
    estimate: Double,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s1),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = HomeDashboardProjection.fullCurrency(estimate),
            style = PantopusTextStyle.h2,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        val low = value.valueRangeLow
        val high = value.valueRangeHigh
        if (low != null && high != null) {
            Text(
                text =
                    HomeDashboardProjection.compactCurrency(low) +
                        " - " +
                        HomeDashboardProjection.compactCurrency(high),
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        trendMeta(value.zipMedianSalePriceTrend)?.let { (icon, tint, label) ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = tint)
                Text(
                    text = label,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = tint,
                )
            }
        }
        val chips =
            buildList {
                value.yearBuilt?.let { add("Built $it") }
                value.sqft?.let { add("$it sqft") }
            }
        if (chips.isNotEmpty()) {
            Text(
                text = chips.joinToString(" - "),
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        HomeDashboardProjection.monthYear(value.lastUpdated)?.let { updated ->
            Text(
                text = "Updated $updated",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

private fun trendMeta(trend: String?): Triple<PantopusIcon, Color, String>? =
    when (trend) {
        "up" -> Triple(PantopusIcon.ArrowUp, PantopusColors.success, "Trending up in your ZIP")
        "down" -> Triple(PantopusIcon.ArrowDown, PantopusColors.error, "Trending down in your ZIP")
        "flat" -> Triple(PantopusIcon.ArrowRight, PantopusColors.appTextSecondary, "Flat trend in your ZIP")
        else -> null
    }

// ── Bill trends ─────────────────────────────────────────────────────

/**
 * `GET /api/homes/:id/bill-trends`. 403s for members without finance
 * permission — the card hides itself in that case.
 */
@Composable
fun BillTrendsCard(
    state: HomeIntelligenceCardState<HomeBillTrendsDto>,
    onRetry: () -> Unit,
) {
    if (state is HomeIntelligenceCardState.Forbidden) return

    DashboardCard(
        title = "Bill trends",
        accent = PantopusColors.warning,
        modifier = Modifier.testTag("homeDashboard_billTrendsCard"),
    ) {
        when (state) {
            HomeIntelligenceCardState.Loading ->
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Shimmer(width = 300.dp, height = 16.dp)
                    Shimmer(width = 260.dp, height = 16.dp)
                }
            HomeIntelligenceCardState.Forbidden -> Unit
            is HomeIntelligenceCardState.Failed ->
                CardError(
                    headline = "Couldn't load bill trends",
                    message = state.message,
                    retryTag = "homeDashboard_billTrendsRetry",
                    onRetry = onRetry,
                )
            is HomeIntelligenceCardState.Loaded ->
                if (state.value.billsByType.isEmpty()) {
                    CardNote("Mark a bill as paid to start tracking your monthly trend.")
                } else {
                    state.value.billsByType.keys.sorted().forEach { key ->
                        state.value.billsByType[key]?.let { series ->
                            BillTrendRow(
                                billType = key,
                                series = series,
                                benchmark = state.value.benchmarks[key],
                            )
                        }
                    }
                }
        }
    }
}

@Composable
private fun BillTrendRow(
    billType: String,
    series: HomeBillTrendSeriesDto,
    benchmark: HomeBillBenchmarkDto?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = HomeDashboardProjection.humanized(billType) ?: billType,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            benchmarkNote(series, benchmark)?.let { note ->
                Text(
                    text = note,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                )
            }
        }
        series.amounts.firstOrNull()?.let { latest ->
            Text(
                text = HomeDashboardProjection.fullCurrency(latest),
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

private fun benchmarkNote(
    series: HomeBillTrendSeriesDto,
    benchmark: HomeBillBenchmarkDto?,
): String? {
    val fallback = series.months.firstOrNull()
    if (benchmark == null) return fallback
    if (benchmark.insufficientData) {
        return benchmark.message ?: "Not enough neighbors for comparison yet"
    }
    val neighborCents = benchmark.avgAmounts.firstOrNull()
    val mine = series.amounts.firstOrNull()
    if (neighborCents == null || mine == null) return fallback
    val neighbors = HomeDashboardProjection.centsToDollars(neighborCents)
    val label = HomeDashboardProjection.fullCurrency(neighbors)
    return when {
        mine > neighbors -> "Above the $label neighborhood average"
        mine < neighbors -> "Below the $label neighborhood average"
        else -> "In line with the $label neighborhood average"
    }
}

// ── Shared card sub-states ──────────────────────────────────────────

@Composable
private fun CardNote(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
    )
}

@Composable
private fun CardError(
    headline: String,
    message: String,
    retryTag: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = headline,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(onClick = onRetry)
                    .testTag(retryTag)
                    .semantics {
                        role = Role.Button
                        contentDescription = "Retry"
                    },
            contentAlignment = Alignment.CenterStart,
        ) {
            Text(
                text = "Retry",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}
