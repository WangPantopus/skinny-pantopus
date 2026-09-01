@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.translation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.translation.TranslationViewMode
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private data class ToggleOption(
    val mode: TranslationViewMode,
    val label: String,
    val icon: PantopusIcon,
)

private val toggleOptions =
    listOf(
        ToggleOption(TranslationViewMode.Translated, "Translated", PantopusIcon.Globe),
        ToggleOption(TranslationViewMode.Original, "Original", PantopusIcon.FileText),
        ToggleOption(TranslationViewMode.Side, "Side by side", PantopusIcon.GripVertical),
    )

/**
 * The Translated · Original · Side by side segmented control. The active
 * segment lifts onto a white pill in the translation accent. Mirrors iOS
 * `TranslationViewToggle`.
 */
@Composable
fun TranslationViewToggle(
    active: TranslationViewMode,
    onSelect: (TranslationViewMode) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s1)
                .testTag("translation_viewToggle"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        toggleOptions.forEach { option ->
            Segment(
                option = option,
                isOn = option.mode == active,
                onSelect = { onSelect(option.mode) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Segment(
    option: ToggleOption,
    isOn: Boolean,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val fg = if (isOn) PantopusColors.categoryTranslation else PantopusColors.appTextSecondary
    Row(
        modifier =
            modifier
                .height(36.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isOn) PantopusColors.appSurface else Color.Transparent)
                .clickable(onClick = onSelect)
                .semantics {
                    contentDescription = option.label
                    selected = isOn
                }
                .testTag("translation_viewToggle_${option.mode.name.lowercase()}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = option.icon,
            contentDescription = null,
            size = 14.dp,
            tint = fg,
        )
        Text(
            text = option.label,
            fontSize = 12.sp,
            fontWeight = if (isOn) FontWeight.Bold else FontWeight.SemiBold,
            color = fg,
            maxLines = 1,
        )
    }
}
