@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P5.1 / A14.1 — Per-home Settings index. Thin wrapper around
 * [GroupedListScreen] with the home identity card injected as the
 * shell's optional `header`.
 */
@Composable
fun HomeSettingsScreen(
    onBack: () -> Unit = {},
    onNavigate: (HomeSettingsRoute) -> Unit = {},
    viewModel: HomeSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val navigation by viewModel.navigation.collectAsStateWithLifecycle()
    val identity by viewModel.identity.collectAsStateWithLifecycle()
    val footerCaption by viewModel.footerCaption.collectAsStateWithLifecycle()
    val rename by viewModel.rename.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(navigation) {
        navigation?.let {
            viewModel.consumeNavigation()
            onNavigate(it)
        }
    }

    GroupedListScreen(
        title = viewModel.title,
        state = state,
        footerCaption = footerCaption,
        callbacks =
            GroupedListCallbacks(
                onBack = onBack,
                onTapRow = viewModel::onRow,
                onRetry = viewModel::refresh,
            ),
        header = {
            HomeSettingsIdentityCard(
                identity = identity,
                rename = rename,
                onBeginRename = viewModel::beginRenaming,
                onRenameDraftChange = viewModel::updateRenameDraft,
                onSaveRename = viewModel::saveRenaming,
                onCancelRename = viewModel::cancelRenaming,
            )
        },
    )
}

/**
 * Identity strip rendered at the top of the per-home Settings list.
 * Holds the home name plus the "HOME" identity chip and the
 * address-verified (or amber `VERIFYING`) chip. When the viewer holds
 * `home.edit`, the name swaps for RN's inline nickname editor
 * (`src/app/homes/[id]/settings/index.tsx:89-108`).
 */
@Composable
fun HomeSettingsIdentityCard(
    identity: HomeSettingsSampleData.Identity,
    rename: HomeRenameState = HomeRenameState(),
    onBeginRename: () -> Unit = {},
    onRenameDraftChange: (String) -> Unit = {},
    onSaveRename: () -> Unit = {},
    onCancelRename: () -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("homeSettingsIdentityCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (rename.isRenaming) {
            RenameEditor(
                rename = rename,
                onDraftChange = onRenameDraftChange,
                onSave = onSaveRename,
                onCancel = onCancelRename,
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = identity.homeName,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.testTag("homeSettingsIdentityName"),
                )
                if (rename.canEdit) {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.sm))
                                .clickable(onClick = onBeginRename)
                                .padding(Spacing.s1)
                                .testTag("homeSettingsRenameButton"),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Edit2,
                            contentDescription = "Rename home",
                            size = 15.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                    }
                }
            }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            IdentityChip()
            AddressChip(label = identity.addressChipLabel, tone = identity.addressChipTone)
        }
    }
}

/** RN's inline nickname editor: field + Save + Cancel. */
@Composable
private fun RenameEditor(
    rename: HomeRenameState,
    onDraftChange: (String) -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("homeSettingsRenameEditor"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusTextField(
            label = "Home name",
            value = rename.draft,
            onValueChange = onDraftChange,
            placeholder = "14 Elm Park Lane",
            state =
                rename.error?.let { PantopusFieldState.Error(it) }
                    ?: PantopusFieldState.Default,
            fieldTestTag = "homeSettingsRenameField",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = if (rename.isSaving) "Saving…" else "Save",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600)
                        .clickable(enabled = !rename.isSaving, onClick = onSave)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("homeSettingsRenameSave"),
            )
            Text(
                text = "Cancel",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(enabled = !rename.isSaving, onClick = onCancel)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("homeSettingsRenameCancel"),
            )
        }
    }
}

@Composable
private fun IdentityChip() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .testTag("homeSettingsIdentityChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary700,
        )
        Text(
            text = "HOME",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
            letterSpacing = 0.4.sp,
        )
    }
}

@Composable
private fun AddressChip(
    label: String,
    tone: RowControl.ChipTone,
) {
    val bg: Color =
        when (tone) {
            RowControl.ChipTone.Success -> PantopusColors.successBg
            RowControl.ChipTone.Warning -> PantopusColors.warningBg
            RowControl.ChipTone.Info -> PantopusColors.primary50
            RowControl.ChipTone.Neutral -> PantopusColors.appSurfaceSunken
        }
    val fg: Color =
        when (tone) {
            RowControl.ChipTone.Success -> PantopusColors.success
            RowControl.ChipTone.Warning -> PantopusColors.warning
            RowControl.ChipTone.Info -> PantopusColors.primary700
            RowControl.ChipTone.Neutral -> PantopusColors.appTextStrong
        }
    val icon: PantopusIcon =
        when (tone) {
            RowControl.ChipTone.Success -> PantopusIcon.ShieldCheck
            RowControl.ChipTone.Warning -> PantopusIcon.Clock
            RowControl.ChipTone.Info -> PantopusIcon.Info
            RowControl.ChipTone.Neutral -> PantopusIcon.Info
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .testTag("homeSettingsAddressChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.2f,
            tint = fg,
        )
        Text(
            text = label.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
            letterSpacing = 0.4.sp,
        )
    }
}
