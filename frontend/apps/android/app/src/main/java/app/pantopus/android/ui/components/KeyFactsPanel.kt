@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

package app.pantopus.android.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** One row in a [KeyFactsPanel]. */
data class KeyFactRow(
    val label: String,
    val value: String,
    /** When true the value renders monospaced and gets a copy button. */
    val isCode: Boolean = false,
)

/**
 * Sunken-surface card of K/V rows. Monospace values get a copy-to-clipboard
 * action.
 */
@Composable
fun KeyFactsPanel(
    rows: List<KeyFactRow>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
    ) {
        rows.forEachIndexed { index, row ->
            KeyFactRowView(row)
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

@Composable
private fun KeyFactRowView(row: KeyFactRow) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var justCopied by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = row.label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.widthIn(min = 96.dp),
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = row.value,
            style =
                if (row.isCode) {
                    PantopusTextStyle.small.copy(fontFamily = FontFamily.Monospace)
                } else {
                    PantopusTextStyle.small
                },
            color = PantopusColors.appText,
            modifier = Modifier.widthIn(max = 220.dp),
        )
        if (row.isCode) {
            Box(
                modifier =
                    Modifier
                        .padding(start = Spacing.s2)
                        .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                        .clickable {
                            val cm = context.getSystemService(ClipboardManager::class.java)
                            cm?.setPrimaryClip(ClipData.newPlainText(row.label, row.value))
                            justCopied = true
                            scope.launch {
                                delay(1_400)
                                justCopied = false
                            }
                        }.semantics {
                            contentDescription = if (justCopied) "Copied" else "Copy ${row.label}"
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (justCopied) PantopusIcon.Check else PantopusIcon.Copy,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
    LaunchedEffect(justCopied) {
        // no-op; ensures recomposition consumers read the flag even when
        // the copy action fires twice in quick succession.
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun KeyFactsPanelPreview() {
    KeyFactsPanel(
        rows =
            listOf(
                KeyFactRow("Order ID", "PAN-48291", isCode = true),
                KeyFactRow("Placed", "Mar 18, 2026"),
                KeyFactRow("Tracking", "1Z999AA10123456784", isCode = true),
                KeyFactRow("Status", "Out for delivery"),
            ),
        modifier = Modifier.padding(Spacing.s4),
    )
}
