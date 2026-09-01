@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mail_day.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_day.MailDaySetupNudge
import app.pantopus.android.ui.screens.mailbox.mail_day.YesterdayRecap
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.16 — Empty-state hero for the My Mail Day editor. Bespoke
 * 120×96 mailbox illustration on top, "Nothing new today" h2,
 * description body, a streak chip + last-scan chip row, then the
 * Scan today's stack primary CTA. Yesterday recap + setup nudges
 * render in their own cards below (rendered by the host).
 */
@Composable
fun MailboxEmptyHero(
    streakDays: Int,
    lastScanLabel: String,
    onScan: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag("mailDayEmptyHero"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HeroCard(streakDays = streakDays, lastScanLabel = lastScanLabel)
        ScanCTA(onClick = onScan)
    }
}

@Composable
private fun HeroCard(
    streakDays: Int,
    lastScanLabel: String,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.xl))
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s5),
    ) {
        Spacer(modifier = Modifier.height(28.dp))
        MailboxIllustration()
        Spacer(modifier = Modifier.height(Spacing.s4))
        Text(
            text = "Nothing new today",
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text =
                "No mail has been scanned since this morning. " +
                    "Drop today's stack on the scanner when you're ready.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Spacing.s5),
        )
        Spacer(modifier = Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            StreakChip(days = streakDays)
            LastScanChip(label = lastScanLabel)
        }
        Spacer(modifier = Modifier.height(Spacing.s5))
    }
}

@Composable
private fun StreakChip(days: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .background(PantopusColors.warmAmberBg, shape = CircleShape)
                .padding(horizontal = 10.dp, vertical = Spacing.s1)
                .semantics { contentDescription = "$days day streak" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Flame,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.warmAmber,
        )
        Text(
            text = "$days-day streak",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warmAmber,
        )
    }
}

@Composable
private fun LastScanChip(label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .background(PantopusColors.appSurfaceSunken, shape = CircleShape)
                .padding(horizontal = 10.dp, vertical = Spacing.s1)
                .semantics { contentDescription = "Last scan $label" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            text = "Last scan $label",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun ScanCTA(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .shadow(
                    elevation = 8.dp,
                    shape = RoundedCornerShape(Radii.xl),
                    ambientColor = PantopusColors.primary600,
                    spotColor = PantopusColors.primary600,
                )
                .background(PantopusColors.primary600, shape = RoundedCornerShape(Radii.xl))
                .clickable(onClick = onClick)
                .testTag("mailDayEmptyScanCTA")
                .semantics { contentDescription = "Scan today's stack" },
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.ScanLine,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Scan today's stack",
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

// ─── Mailbox illustration (HEX_EXEMPT) ─────────────────────────

/**
 * 120×96 mailbox illustration: lavender shelf + grey mailbox body
 * with dark slot, red flag, mono "0" face, and three amber sparkle
 * dots.
 */
@Composable
fun MailboxIllustration() {
    Box(
        modifier =
            Modifier
                .size(width = 120.dp, height = 96.dp)
                .drawBehind {
                    val w = size.width
                    val h = size.height
                    // shelf
                    drawRoundRect(
                        color = ShelfLavender.copy(alpha = 0.7f),
                        topLeft = Offset(6f / 120f * w, 88f / 96f * h),
                        size = Size(108f / 120f * w, 8f / 96f * h),
                        cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx()),
                    )
                    // mailbox body
                    val bodyLeft = 18f / 120f * w
                    val bodyTop = 24f / 96f * h
                    val bodyWidth = 84f / 120f * w
                    val bodyHeight = 64f / 96f * h
                    drawRoundRect(
                        brush = Brush.verticalGradient(listOf(BodyTop, BodyBottom)),
                        topLeft = Offset(bodyLeft, bodyTop),
                        size = Size(bodyWidth, bodyHeight),
                        cornerRadius = CornerRadius(Radii.sm.toPx(), Radii.sm.toPx()),
                    )
                    // slot
                    drawRoundRect(
                        color = SlotDark,
                        topLeft = Offset(bodyLeft + 14f / 84f * bodyWidth, bodyTop + 14f / 64f * bodyHeight),
                        size = Size(bodyWidth * 56f / 84f, 4.dp.toPx()),
                        cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx()),
                    )
                    // flag
                    drawRoundRect(
                        color = PantopusColors.error,
                        topLeft = Offset(bodyLeft + bodyWidth, bodyTop + 18f / 64f * bodyHeight),
                        size = Size(14.dp.toPx(), 12.dp.toPx()),
                        cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx()),
                    )
                    // sparkles
                    drawCircle(
                        color = SparkleAmber,
                        radius = 2.dp.toPx(),
                        center = Offset(8f / 120f * w, 12f / 96f * h),
                    )
                    drawCircle(
                        color = SparkleLightAmber,
                        radius = 3.dp.toPx(),
                        center = Offset(110f / 120f * w, 9f / 96f * h),
                    )
                    drawCircle(
                        color = SparkleAmber,
                        radius = 1.5.dp.toPx(),
                        center = Offset(116f / 120f * w, 30f / 96f * h),
                    )
                },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier.size(width = 84.dp, height = 30.dp).padding(top = Spacing.s3),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "0",
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = (-1).sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

// ─── Yesterday recap card ──────────────────────────────────────

@Composable
fun YesterdayRecapCard(
    recap: YesterdayRecap,
    onSeeHistory: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.lg))
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .testTag("mailDayEmptyRecap"),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = recap.dateLabel,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${recap.pieces} pieces · ${recap.closedAtLabel}",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            StackedBar(segments = recap.segments)
            SegmentLegend(segments = recap.segments)
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onSeeHistory)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
                    .testTag("mailDayEmptyRecapSeeHistory")
                    .semantics { contentDescription = "See full history" },
        ) {
            Text(
                text = "See full history",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun StackedBar(segments: List<YesterdayRecap.Segment>) {
    BoxWithConstraints(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(PantopusColors.appSurfaceSunken, shape = CircleShape),
    ) {
        val totalWidth = maxWidth
        Row(modifier = Modifier.fillMaxWidth()) {
            segments.forEach { segment ->
                Box(
                    modifier =
                        Modifier
                            .height(8.dp)
                            .width(totalWidth * segment.percent)
                            .background(segment.tint.color),
                )
            }
        }
    }
}

@Composable
private fun SegmentLegend(segments: List<YesterdayRecap.Segment>) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        segments.forEach { segment ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .background(segment.tint.color, shape = RoundedCornerShape(Radii.xs)),
                )
                Text(
                    text = segment.label,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ─── Setup nudge stack ─────────────────────────────────────────

@Composable
fun SetupNudgeStack(
    nudges: List<MailDaySetupNudge>,
    onTap: (MailDaySetupNudge) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.lg))
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .testTag("mailDayEmptyNudges"),
    ) {
        nudges.forEachIndexed { index, nudge ->
            NudgeRow(nudge = nudge, isLast = index == nudges.size - 1, onClick = { onTap(nudge) })
        }
    }
}

@Composable
private fun NudgeRow(
    nudge: MailDaySetupNudge,
    isLast: Boolean,
    onClick: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onClick)
                    .padding(horizontal = 14.dp, vertical = Spacing.s3)
                    .testTag("mailDayEmptyNudge.${nudge.id}")
                    .semantics { contentDescription = "${nudge.title}. ${nudge.subtitle}" },
        ) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .background(nudge.tint.background, shape = RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = nudge.icon,
                    contentDescription = null,
                    size = 16.dp,
                    strokeWidth = 2.2f,
                    tint = nudge.tint.foreground,
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = nudge.title,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = nudge.subtitle,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (!isLast) {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        }
    }
}

// ─── Bespoke illustration palette (HEX_EXEMPT) ─────────────────

private val ShelfLavender = Color(0xFFA78BFA)
private val BodyTop = Color(0xFFF3F4F6)
private val BodyBottom = Color(0xFFD1D5DB)
private val SlotDark = Color(0xFF374151)
private val SparkleAmber = Color(0xFFFBBF24)
private val SparkleLightAmber = Color(0xFFFDE68A)
