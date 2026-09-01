@file:Suppress("PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.2 — the Add-Home wizard's Setup block: "Networks & codes
 * (optional)". Ports RN's `src/components/homes/SetupStep.tsx:66-173` —
 * repeatable rows of (access type × label × secret), a per-row reveal
 * toggle, a "Scan WiFi QR" affordance on Wi-Fi rows, and an "Add another
 * network or code" button.
 *
 * Each filled row becomes a `POST /api/homes/:id/access` call once the
 * home exists (`backend/routes/home.js:5735`), matching RN's
 * `finalizeCreatedHome`.
 *
 * Rendered on the wizard's Role step, which is RN's Setup step — role
 * picker first, networks & codes underneath — and hidden entirely when
 * the user is joining an existing home.
 */
@Composable
internal fun AddHomeAccessSetupSection(
    state: AddHomeUiState,
    vm: AddHomeWizardViewModel,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("addHomeAccessSetupSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Networks & codes (optional)",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "Add WiFi (main, guest, etc.) and other codes like door or gate. " +
                        "Passwords can't be read from your device for security—enter them manually.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }

        state.accessItems.forEach { item ->
            AccessItemCard(
                item = item,
                canRemove = state.accessItems.size > 1,
                onSelectType = { vm.updateAccessType(item.id, it) },
                onLabelChange = { vm.updateAccessLabel(item.id, it) },
                onSecretChange = { vm.updateAccessSecret(item.id, it) },
                onToggleReveal = { vm.toggleAccessSecretRevealed(item.id) },
                onScanQr = { vm.openWifiQrScanner(item.id) },
                onRemove = { vm.removeAccessItem(item.id) },
            )
        }

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = vm::addAccessItem)
                    .testTag("addHome_addAccessItem"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.PlusCircle,
                contentDescription = null,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Add another network or code",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun AccessItemCard(
    item: AddHomeAccessItem,
    canRemove: Boolean,
    onSelectType: (AddHomeAccessType) -> Unit,
    onLabelChange: (String) -> Unit,
    onSecretChange: (String) -> Unit,
    onToggleReveal: () -> Unit,
    onScanQr: () -> Unit,
    onRemove: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(ADD_HOME_HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Type",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    AddHomeAccessType.entries.forEach { type ->
                        val isSelected = item.accessType == type
                        Text(
                            text = type.label,
                            style = PantopusTextStyle.caption,
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            color =
                                if (isSelected) {
                                    PantopusColors.appTextInverse
                                } else {
                                    PantopusColors.appText
                                },
                            modifier =
                                Modifier
                                    .clip(RoundedCornerShape(Radii.pill))
                                    .background(
                                        if (isSelected) {
                                            PantopusColors.primary600
                                        } else {
                                            PantopusColors.appSurfaceSunken
                                        },
                                    ).selectable(
                                        selected = isSelected,
                                        role = Role.RadioButton,
                                        onClick = { onSelectType(type) },
                                    ).padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                                    .testTag("addHome_accessType_${type.wireValue}"),
                        )
                    }
                }
            }
            if (canRemove) {
                IconButton(
                    onClick = onRemove,
                    modifier = Modifier.testTag("addHome_removeAccessItem"),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Trash2,
                        contentDescription = "Remove ${item.accessType.label} entry",
                        tint = PantopusColors.error,
                    )
                }
            }
        }

        if (item.accessType == AddHomeAccessType.Wifi) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50)
                        .clickable(onClick = onScanQr)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("addHome_scanWifiQr"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ScanLine,
                    contentDescription = null,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Scan WiFi QR",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }

        AddHomeTextField(
            label = "Label (e.g. Main WiFi, Front door)",
            placeholder = item.accessType.labelPlaceholder,
            value = item.label,
            onValueChange = onLabelChange,
            errorText = item.labelError,
            testTag = "addHome_accessLabel",
        )

        AddHomeTextField(
            label = item.accessType.valueFieldLabel,
            placeholder = item.accessType.valuePlaceholder,
            value = item.secretValue,
            onValueChange = onSecretChange,
            isSecure = !item.isRevealed,
            errorText = item.valueError,
            testTag = "addHome_accessSecret",
            trailing = {
                IconButton(
                    onClick = onToggleReveal,
                    modifier = Modifier.testTag("addHome_toggleAccessSecret"),
                ) {
                    PantopusIconImage(
                        icon = if (item.isRevealed) PantopusIcon.EyeOff else PantopusIcon.Eye,
                        contentDescription = if (item.isRevealed) "Hide value" else "Show value",
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            },
        )
    }
}
