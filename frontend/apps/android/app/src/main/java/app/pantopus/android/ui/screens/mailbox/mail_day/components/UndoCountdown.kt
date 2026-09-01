@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_day.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.16 — 5-second undo chip on the latest reviewed row. Renders as a
 * warm-amber pill with a leading rewind glyph and a mono "Undo · Ns"
 * label that ticks down once a second.
 */
@Composable
fun UndoCountdown(
    seconds: Int,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .defaultMinSize(minHeight = 28.dp)
                .background(PantopusColors.warmAmberBg, shape = CircleShape)
                .border(width = 1.dp, color = PantopusColors.warningLight, shape = CircleShape)
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = Spacing.s1)
                .testTag("mailDayUndoCountdown")
                .semantics { contentDescription = "Undo — $seconds seconds remaining" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.RefreshCw,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = UndoForeground,
        )
        Text(
            text = "Undo · ${seconds}s",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = UndoForeground,
        )
    }
}

/**
 * Amber-800 tone (0xFF92400E). Documented per-component exception (no
 * token for this dark amber today; matches the iOS UndoCountdown.swift).
 */
private val UndoForeground = Color(0xFF92400E)
