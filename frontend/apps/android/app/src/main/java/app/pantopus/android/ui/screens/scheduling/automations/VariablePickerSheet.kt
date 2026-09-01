@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Stream A16 — H6 Variable Picker (local sheet, no route). Inserts a dynamic
 * `{{token}}` into a workflow or template message. A search field over grouped
 * cards (EVENT / PEOPLE / LINKS); each row shows a human label, a mono token
 * chip, and a sample value, and inserts + dismisses on tap. Catalog is the
 * client-side [TemplateVariableCatalog]; the backend `/preview` interpolates any
 * token. Pure local state — no networking.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VariablePickerSheet(
    onInsert: (TemplateVariable) -> Unit,
    onDismiss: () -> Unit,
    accent: Color = PantopusColors.primary600,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }
    val groups = remember(query) { TemplateVariableCatalog.grouped(query) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        dragHandle = null,
    ) {
        Column(modifier = Modifier.fillMaxWidth().testTag("scheduling.templates.variablePicker")) {
            AutoSheetHeader(title = "Insert variable", onClose = onDismiss)
            VariableSearchField(query = query, onQueryChange = { query = it })
            if (groups.isEmpty()) {
                NoVariablesMatch()
            } else {
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                ) {
                    groups.forEach { section ->
                        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            AutoOverline(text = section.group.title, modifier = Modifier.padding(horizontal = 2.dp))
                            AutoCard(horizontal = 14.dp, vertical = Spacing.s0) {
                                section.items.forEachIndexed { idx, variable ->
                                    VariableRow(variable = variable, onTap = { onInsert(variable) })
                                    if (idx < section.items.size - 1) AutoRowDivider()
                                }
                            }
                        }
                    }
                    Box(modifier = Modifier.padding(bottom = Spacing.s4))
                }
            }
        }
    }
}

@Composable
private fun VariableSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s2)
                .fillMaxWidth()
                .heightIn(min = 42.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurface)
                .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Search, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (query.isEmpty()) {
                Text(text = "Search variables", fontSize = 14.sp, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun VariableRow(
    variable: TemplateVariable,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onTap)
                .heightIn(min = 48.dp)
                .padding(vertical = 11.dp)
                .testTag("variableRow_${variable.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = variable.label, fontSize = 14.5.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
            Text(
                text = variable.token,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.primary700,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.primary50)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
            )
        }
        Text(text = variable.sample, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = PantopusColors.appTextMuted, maxLines = 1)
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = "Insert ${variable.label}",
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun NoVariablesMatch() {
    Column(
        modifier = Modifier.fillMaxWidth().heightIn(min = 220.dp).padding(horizontal = Spacing.s8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3, Alignment.CenterVertically),
    ) {
        Box(
            modifier =
                Modifier
                    .heightIn(min = 72.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s5),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = 30.dp,
                strokeWidth = 1.8f,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(text = "No variables match", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Try a different word, or use the event link variables.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}
