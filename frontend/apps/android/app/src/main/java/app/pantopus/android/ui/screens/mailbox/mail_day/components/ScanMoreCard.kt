@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_day.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.16 — mid-day "scan more" prompt above the Needs-a-call section.
 * Light primary fill, 1.5dp dashed border, leading 40dp scanner disc,
 * trailing camera glyph. Tapping it opens the scanner.
 */
@Composable
fun ScanMoreCard(
    lastScanLabel: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val borderColor = PantopusColors.primary300
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.primary50, shape = RoundedCornerShape(Radii.lg))
                .drawBehind {
                    val stroke = 1.5.dp.toPx()
                    val cornerPx = Radii.lg.toPx()
                    drawRoundRect(
                        color = borderColor,
                        topLeft = Offset(stroke / 2, stroke / 2),
                        size = Size(size.width - stroke, size.height - stroke),
                        cornerRadius = CornerRadius(cornerPx, cornerPx),
                        style =
                            Stroke(
                                width = stroke,
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f, 4f), 0f),
                            ),
                    )
                }
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("mailDayScanMore")
                .semantics(mergeDescendants = true) {
                    contentDescription = "Scan more mail. Last scan $lastScanLabel."
                },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .shadow(
                            elevation = 4.dp,
                            shape = RoundedCornerShape(Radii.md),
                            ambientColor = PantopusColors.primary600,
                            spotColor = PantopusColors.primary600,
                        )
                        .background(PantopusColors.primary600, shape = RoundedCornerShape(Radii.md)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ScanLine,
                    contentDescription = null,
                    size = 18.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "Scan more mail",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
                Text(
                    text = "Last scan $lastScanLabel",
                    fontSize = 11.sp,
                    color = PantopusColors.primary700.copy(alpha = 0.75f),
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.Camera,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.primary600,
            )
        }
    }
}
