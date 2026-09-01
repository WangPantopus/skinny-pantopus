@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_ownership.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.homes.claim_ownership.ClaimDocumentOption
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * "Select document type" card list used by the residency variant of the
 * evidence step. Mirrors RN's `docCard` list
 * (`src/app/homes/[id]/claim-owner/evidence.tsx:299-338`): icon disc,
 * label + description, check glyph on the selected row.
 */
@Composable
fun ClaimDocumentTypePicker(
    options: List<ClaimDocumentOption>,
    selected: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("claimDocumentTypePicker"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        options.forEach { option ->
            DocumentOptionRow(
                option = option,
                isSelected = selected == option.id,
                onSelect = { onSelect(option.id) },
            )
        }
    }
}

@Composable
private fun DocumentOptionRow(
    option: ClaimDocumentOption,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    val surface = if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(surface)
                .border(1.5.dp, borderColor, RoundedCornerShape(Radii.lg))
                .semantics {
                    contentDescription = "${option.label}. ${option.detail}"
                    role = Role.Button
                    selected = isSelected
                }.clickable(onClick = onSelect)
                .padding(Spacing.s3)
                .testTag("claimDocumentType_${option.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = option.icon,
                contentDescription = null,
                size = 18.dp,
                tint = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = option.label,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = if (isSelected) PantopusColors.primary600 else PantopusColors.appText,
            )
            Text(
                text = option.detail,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}
