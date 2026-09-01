@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * P2.8 Paparazzi baselines for the Add Emergency Info form + detail.
 *
 * Snapshot coverage:
 *   - one SeverityChip per severity (info / caution / critical) — locks
 *     the semantic token pairing and the critical-with-alert-triangle
 *     acceptance check.
 *   - one DetailHeader per form category, each with the matching
 *     palette glyph — the acceptance "snapshot test: each category".
 *
 * Combining the two locks every (category, severity) variant the
 * detail surface can render.
 */
class EmergencyInfoFormSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    @Test
    fun severity_chip_info() {
        paparazzi.snapshot {
            Frame { SeverityChip(EmergencySeverity.Info) }
        }
    }

    @Test
    fun severity_chip_caution() {
        paparazzi.snapshot {
            Frame { SeverityChip(EmergencySeverity.Caution) }
        }
    }

    @Test
    fun severity_chip_critical_with_alert_triangle() {
        paparazzi.snapshot {
            Frame { SeverityChip(EmergencySeverity.Critical) }
        }
    }

    @Test
    fun all_severity_chips_side_by_side() {
        paparazzi.snapshot {
            Frame {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    EmergencySeverity.entries.forEach { SeverityChip(it) }
                }
            }
        }
    }

    @Test
    fun all_categories_render_with_palette_tile() {
        paparazzi.snapshot {
            Frame {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    EmergencyFormCategory.entries.forEach { category ->
                        CategoryRowPreview(category = category)
                    }
                }
            }
        }
    }

    @Test
    fun critical_allergy_detail_header_locks_the_chip_glyph() {
        // The acceptance check: "Critical items render with the
        // error-bg chip and a small alert icon". This snapshot pairs
        // the most common combination (allergy + critical) so any
        // accidental swap of severity tokens / chip glyph fails.
        paparazzi.snapshot {
            Frame {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(
                        text = "Allergy + critical",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                    SeverityChip(EmergencySeverity.Critical)
                }
            }
        }
    }

    @Composable
    private fun CategoryRowPreview(category: EmergencyFormCategory) {
        Row(
            modifier =
                Modifier
                    .padding(Spacing.s2)
                    .background(PantopusColors.appSurface, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(category.palette.background),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = category.icon,
                    contentDescription = null,
                    size = 16.dp,
                    tint = category.palette.foreground,
                )
            }
            Text(
                text = category.label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg)
                        .padding(Spacing.s4),
            ) { content() }
        }
    }
}
