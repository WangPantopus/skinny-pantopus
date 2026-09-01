@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.mailbox.mail_task.components.MailTaskAccentCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.12 — feature-local cards composed into the screen body (elf strip,
 * completion summary, delegate hint). The TaskCard / DueSnoozeCard /
 * SubtaskChecklist / SourceMailCard / NextUpCard live under `components/`.
 */

/**
 * Sky-gradient AI-elf strip bespoke to the task screen — labeled bullets
 * with per-bullet icon discs + inline text.
 */
@Composable
fun TaskElfStrip(
    elf: MailTaskElf,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(PantopusColors.primary50, PantopusColors.primary100),
                    ),
                )
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.xl))
                .padding(14.dp)
                .testTag("mailTask_elf"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text(
                text = elf.headline,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary800,
            )
        }
        Text(
            text = elf.summary,
            fontSize = 13.sp,
            color = PantopusColors.primary900,
            lineHeight = 19.sp,
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            elf.bullets.forEach { bullet ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Box(
                        modifier =
                            Modifier
                                .size(16.dp)
                                .clip(RoundedCornerShape(Radii.xs))
                                .background(PantopusColors.appSurface)
                                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.xs)),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = bullet.icon,
                            contentDescription = null,
                            size = 10.dp,
                            tint = PantopusColors.primary700,
                        )
                    }
                    Text(
                        text =
                            buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.appText)) {
                                    append(bullet.label)
                                }
                                withStyle(SpanStyle(color = PantopusColors.appTextStrong)) {
                                    append(" — ${bullet.text}")
                                }
                            },
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                    )
                }
            }
        }
    }
}

/**
 * "What got filed" card (done frame) — label/value rows, mono for the
 * confirmation number.
 */
@Composable
fun CompletionSummaryCard(
    completion: MailTaskCompletion,
    modifier: Modifier = Modifier,
) {
    MailTaskAccentCard(modifier = modifier.testTag("mailTask_completion")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "WHAT GOT FILED",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(bottom = Spacing.s1),
            )
            completion.rows.forEach { row ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier =
                            Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.appSurfaceSunken),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = row.icon,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.appTextStrong,
                        )
                    }
                    Text(text = row.label, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = row.value,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = if (row.isMono) FontFamily.Monospace else FontFamily.Default,
                        color = PantopusColors.appText,
                    )
                }
            }
        }
    }
}

/** "Hand this off" overlapping-avatars row (open frame). */
@Composable
fun DelegateHintCard(
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val initials = listOf("JR", "MV", "DK")
    val tints = listOf(PantopusColors.categoryTask, PantopusColors.categoryStamps, PantopusColors.warmAmber)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .testTag("mailTask_delegateHint"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row {
            initials.forEachIndexed { index, text ->
                Box(
                    modifier =
                        Modifier
                            .offset(x = if (index == 0) 0.dp else (-8 * index).dp)
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .padding(2.dp)
                            .clip(CircleShape)
                            .background(tints[index]),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = text,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = "Hand this off", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                text = "Delegate to someone in your Home drawer",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

/** Error frame — retry re-fetches the task list. */
@Composable
fun MailTaskErrorBody(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ErrorState(
        headline = "Couldn't load this task",
        message = message,
        modifier = modifier.testTag("mailTask_error"),
        onRetry = onRetry,
    )
}

/** Shimmer skeleton mirroring the loaded geometry. */
@Composable
fun MailTaskLoadingBody(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("mailTask_loading"),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            app.pantopus.android.ui.components.Shimmer(width = 74.dp, height = 20.dp, cornerRadius = Radii.pill)
            app.pantopus.android.ui.components.Shimmer(width = 54.dp, height = 20.dp, cornerRadius = Radii.pill)
            Spacer(modifier = Modifier.weight(1f))
            app.pantopus.android.ui.components.Shimmer(width = 90.dp, height = 14.dp)
        }
        app.pantopus.android.ui.components.Shimmer(modifier = Modifier.fillMaxWidth(), height = 168.dp, cornerRadius = Radii.xl)
        app.pantopus.android.ui.components.Shimmer(modifier = Modifier.fillMaxWidth(), height = 132.dp, cornerRadius = Radii.xl)
        app.pantopus.android.ui.components.Shimmer(modifier = Modifier.fillMaxWidth(), height = 150.dp, cornerRadius = Radii.xl)
        app.pantopus.android.ui.components.Shimmer(modifier = Modifier.fillMaxWidth(), height = 120.dp, cornerRadius = Radii.xl)
    }
}
