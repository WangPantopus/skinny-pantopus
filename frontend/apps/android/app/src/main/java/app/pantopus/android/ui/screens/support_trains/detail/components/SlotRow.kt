@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.support_trains.detail.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.detail.ContributorTone
import app.pantopus.android.ui.screens.support_trains.detail.SlotRowAuthor
import app.pantopus.android.ui.screens.support_trains.detail.SlotRowContent
import app.pantopus.android.ui.screens.support_trains.detail.SlotRowState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.9 — Per-slot row. Same recipe carries every state (open /
 * covered / mine); the body flips the date-column tint + trailing
 * affordance off `state` + `mine`.
 */
@Composable
fun SlotRow(
    content: SlotRowContent,
    onSignUp: (() -> Unit)? = null,
    onEdit: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val borderColor = if (content.mine) PantopusColors.primary300 else PantopusColors.appBorder
    val borderWidth = if (content.mine) 1.5.dp else 1.dp
    val shadow = if (content.mine) PantopusElevations.md else PantopusElevations.sm
    Row(
        modifier =
            modifier
                .testTag("supportTrainSlotRow-${content.id}")
                .fillMaxWidth()
                .pantopusShadow(shadow, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(borderWidth, borderColor, shape)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = accessibilityLabel(content) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        DateColumn(content)
        Body(content)
        Trailing(content, onSignUp = onSignUp, onEdit = onEdit)
    }
}

@Composable
private fun DateColumn(content: SlotRowContent) {
    val foreground = dateColumnForeground(content)
    val background = dateColumnBackground(content)
    val shape = RoundedCornerShape(Radii.md)
    Box(
        modifier =
            Modifier
                .width(42.dp)
                .clip(shape)
                .background(background)
                .let { base ->
                    if (content.state == SlotRowState.Open) {
                        base.drawBehind {
                            val stroke = 1.5.dp.toPx()
                            val dash = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 2.dp.toPx()), 0f)
                            drawRoundRect(
                                color = PantopusColors.appBorder,
                                topLeft = Offset(stroke / 2, stroke / 2),
                                size = Size(size.width - stroke, size.height - stroke),
                                cornerRadius =
                                    androidx.compose.ui.geometry
                                        .CornerRadius(Radii.md.toPx(), Radii.md.toPx()),
                                style = Stroke(width = stroke, pathEffect = dash),
                            )
                        }
                    } else {
                        base
                    }
                }
                .padding(vertical = Spacing.s1),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(1.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = content.dayLabel.uppercase(),
                color = foreground.copy(alpha = 0.8f),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = content.dateLabel,
                color = foreground,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
            )
        }
    }
}

@Composable
private fun RowScope.Body(content: SlotRowContent) {
    Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        when (content.state) {
            SlotRowState.Open -> {
                Text(
                    text = content.title,
                    color = PantopusColors.appTextStrong,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.5.sp,
                    maxLines = 1,
                )
                content.subtitle?.let {
                    Text(
                        text = it,
                        color = PantopusColors.appTextSecondary,
                        fontSize = 12.sp,
                        maxLines = 1,
                    )
                }
            }
            SlotRowState.Covered -> {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    content.author?.let { AuthorDisc(it) }
                    Text(
                        text = if (content.mine) "You" else (content.author?.displayName ?: "Helper"),
                        color = PantopusColors.appText,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.5.sp,
                        maxLines = 1,
                    )
                    if (content.mine) {
                        Text(
                            text = "YOUR SLOT",
                            color = PantopusColors.primary700,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            modifier =
                                Modifier
                                    .clip(RoundedCornerShape(Radii.pill))
                                    .background(PantopusColors.primary50)
                                    .padding(horizontal = Spacing.s1, vertical = 1.dp),
                        )
                    }
                }
                Text(
                    text = coveredSubtitle(content),
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                    maxLines = 2,
                )
            }
        }
    }
}

@Composable
private fun AuthorDisc(author: SlotRowAuthor) {
    Box(
        modifier =
            Modifier
                .size(18.dp)
                .clip(CircleShape)
                .background(toneColor(author.tone)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = author.initials,
            color = PantopusColors.appTextInverse,
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun Trailing(
    content: SlotRowContent,
    onSignUp: (() -> Unit)?,
    onEdit: (() -> Unit)?,
) {
    when {
        content.state == SlotRowState.Open -> {
            Box(
                modifier =
                    Modifier
                        .testTag("supportTrainSlotRowSignUp-${content.id}")
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600)
                        .clickable(enabled = onSignUp != null) { onSignUp?.invoke() }
                        .padding(horizontal = Spacing.s3)
                        .semantics {
                            role = Role.Button
                            contentDescription = "Sign up for ${content.dayLabel} ${content.dateLabel}"
                        },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Sign up",
                    color = PantopusColors.appTextInverse,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.5.sp,
                )
            }
        }
        content.mine -> {
            Box(
                modifier =
                    Modifier
                        .testTag("supportTrainSlotRowEdit-${content.id}")
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .clickable(enabled = onEdit != null) { onEdit?.invoke() }
                        .padding(horizontal = Spacing.s2)
                        .semantics {
                            role = Role.Button
                            contentDescription = "Edit your slot"
                        },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Edit",
                    color = PantopusColors.primary700,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.5.sp,
                )
            }
        }
        else -> {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.home,
            )
        }
    }
}

private fun accessibilityLabel(content: SlotRowContent): String {
    val datePart = "${content.dayLabel} ${content.dateLabel}"
    return when (content.state) {
        SlotRowState.Open -> "Open slot · $datePart · ${content.title}. ${content.subtitle.orEmpty()}".trim()
        SlotRowState.Covered -> {
            val who = if (content.mine) "your slot" else (content.author?.displayName ?: "a neighbor")
            "$datePart · $who bringing ${content.title}"
        }
    }
}

private fun dateColumnBackground(content: SlotRowContent): Color =
    when {
        content.state == SlotRowState.Covered && content.mine -> PantopusColors.primary50
        content.state == SlotRowState.Covered -> PantopusColors.homeBg
        else -> PantopusColors.appSurfaceSunken
    }

private fun dateColumnForeground(content: SlotRowContent): Color =
    when {
        content.state == SlotRowState.Covered && content.mine -> PantopusColors.primary700
        content.state == SlotRowState.Covered -> PantopusColors.homeDark
        else -> PantopusColors.appTextStrong
    }

private fun coveredSubtitle(content: SlotRowContent): String =
    if (content.subtitle.isNullOrBlank()) content.title else "${content.title} · ${content.subtitle}"

private fun toneColor(tone: ContributorTone): Color =
    when (tone) {
        ContributorTone.Warning -> PantopusColors.warning
        ContributorTone.Primary -> PantopusColors.primary500
        ContributorTone.Business -> PantopusColors.business
        ContributorTone.Success -> PantopusColors.success
        ContributorTone.Error -> PantopusColors.error
        ContributorTone.Personal -> PantopusColors.personal
    }

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun SlotRowOpenPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        SlotRow(
            content =
                SlotRowContent(
                    id = "preview-open",
                    dayLabel = "Thu",
                    dateLabel = "4",
                    state = SlotRowState.Open,
                    title = "Open · dinner for 4",
                    subtitle = "Drop off by 5:30 pm · porch shelf",
                ),
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun SlotRowCoveredPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        SlotRow(
            content =
                SlotRowContent(
                    id = "preview-covered",
                    dayLabel = "Tue",
                    dateLabel = "2",
                    state = SlotRowState.Covered,
                    author =
                        SlotRowAuthor(
                            initials = "SK",
                            displayName = "Sam Kowalski",
                            tone = ContributorTone.Warning,
                        ),
                    title = "Lentil soup + cornbread",
                    subtitle = "drop 5pm",
                ),
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun SlotRowMinePreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        SlotRow(
            content =
                SlotRowContent(
                    id = "preview-mine",
                    dayLabel = "Thu",
                    dateLabel = "4",
                    state = SlotRowState.Covered,
                    author =
                        SlotRowAuthor(
                            initials = "YO",
                            displayName = "You",
                            tone = ContributorTone.Primary,
                        ),
                    title = "Pad thai (no peanuts) + spring rolls",
                    subtitle = "6:00 pm",
                    mine = true,
                ),
        )
    }
}
