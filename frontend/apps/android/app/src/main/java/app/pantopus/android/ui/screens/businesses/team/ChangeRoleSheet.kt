@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.team

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetDto
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Role-preset picker presented from a member row's overflow → "Change
 * role". Lists the `BusinessRolePresetDto`s returned by
 * `/api/businesses/:id/role-presets` and hands the chosen preset back so
 * the host can POST the change optimistically. Mirrors iOS `ChangeRoleSheet`.
 */
@Composable
fun ChangeRoleSheet(
    memberName: String,
    currentRole: BusinessRole,
    presets: List<BusinessRolePresetDto>,
    onDismiss: () -> Unit,
    onPick: (BusinessRolePresetDto) -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = true, dismissOnClickOutside = true),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("businessTeam.changeRoleSheet"),
        ) {
            ContentDetailTopBar(title = "Change role", onBack = onDismiss)
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = "Choose a role for $memberName. This sets what they can see and do.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                presets.forEach { preset ->
                    RolePresetTile(
                        preset = preset,
                        isCurrent = BusinessRole.parse(preset.roleBase) == currentRole,
                        onClick = {
                            onPick(preset)
                            onDismiss()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun RolePresetTile(
    preset: BusinessRolePresetDto,
    isCurrent: Boolean,
    onClick: () -> Unit,
) {
    val role = BusinessRole.parse(preset.roleBase)
    val palette = role.palette
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("businessTeam.rolePreset.${preset.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(44.dp).clip(RoundedCornerShape(Radii.md)).background(palette.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = role.icon, contentDescription = null, size = 22.dp, tint = palette.foreground)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = preset.displayName,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                )
                if (isCurrent) {
                    Text(
                        text = "Current",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.appSurfaceSunken)
                                .padding(horizontal = Spacing.s2, vertical = 2.dp),
                    )
                }
            }
            Text(text = preset.description, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}
