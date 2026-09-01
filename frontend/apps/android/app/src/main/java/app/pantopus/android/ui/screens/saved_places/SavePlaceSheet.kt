@file:Suppress("MagicNumber", "PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.saved_places

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * BLOCK 2E Frame 6 — the bookmark save toggle on Explore/Discover rows + place
 * detail. Outline glyph when not saved, filled primary disc when saved.
 */
@Composable
fun SaveBookmarkButton(
    isSaved: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 34.dp,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(if (isSaved) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                .clickable(onClick = onToggle)
                .semantics {
                    contentDescription = if (isSaved) "Saved" else "Save"
                    role = Role.Button
                }
                .testTag("savePlace.bookmarkToggle"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Bookmark,
            contentDescription = null,
            size = size * 0.48f,
            strokeWidth = if (isSaved) 2.4f else 2.0f,
            tint = if (isSaved) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        )
    }
}

/**
 * BLOCK 2E Frame 7 — the Save-place bottom sheet: a prefilled Name field + a
 * Home / Work / Other chooser + Save.
 */
@Composable
fun SavePlaceSheet(
    pending: PendingSavePlace,
    onSave: (label: String, choice: SavePlaceTypeChoice) -> Unit,
    onClose: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by rememberSaveable(pending) { mutableStateOf(pending.label) }
    var choice by remember(pending) { mutableStateOf(SavePlaceTypeChoice.Other) }

    ModalBottomSheet(onDismissRequest = onClose, sheetState = sheetState) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s2)
                    .padding(bottom = Spacing.s5)
                    .testTag("savePlace.sheet"),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Save place",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier =
                        Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .clickable(onClick = onClose)
                            .testTag("savePlace.close"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Close",
                        size = 18.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }

            Spacer(Modifier.height(Spacing.s4))
            FieldLabel("Name")
            Spacer(Modifier.height(Spacing.s2))
            NameField(value = name, onValueChange = { name = it })

            Spacer(Modifier.height(Spacing.s4))
            FieldLabel("Type")
            Spacer(Modifier.height(Spacing.s2))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), modifier = Modifier.fillMaxWidth()) {
                SavePlaceTypeChoice.entries.forEach { option ->
                    TypeOption(option = option, active = option == choice, onClick = { choice = option }, modifier = Modifier.weight(1f))
                }
            }

            Spacer(Modifier.height(Spacing.s5))
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable {
                            val trimmed = name.trim()
                            onSave(if (trimmed.isEmpty()) pending.label else trimmed, choice)
                        }
                        .testTag("savePlace.saveBtn"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Bookmark,
                    contentDescription = null,
                    size = 17.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
                Spacer(Modifier.size(Spacing.s2))
                Text("Save", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
            }
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text = text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
}

@Composable
private fun NameField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                Text("Name this place", fontSize = 15.sp, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle =
                    TextStyle(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appText,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth().testTag("savePlace.nameField"),
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.Pencil,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun TypeOption(
    option: SavePlaceTypeChoice,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (active) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (active) 2.dp else 1.dp,
                    color = if (active) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3)
                .testTag(option.testTag),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(option.tileBackground),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = option.icon, contentDescription = null, size = 18.dp, tint = option.tileForeground)
        }
        Text(
            text = option.label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (active) PantopusColors.appText else PantopusColors.appTextSecondary,
        )
    }
}
