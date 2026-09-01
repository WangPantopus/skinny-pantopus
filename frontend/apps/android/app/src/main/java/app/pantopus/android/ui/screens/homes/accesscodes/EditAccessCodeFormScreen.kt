@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.accesscodes

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.MotionTokens
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * Stable test tags (mirror naming with iOS accessibilityIdentifier).
 */
object EditAccessCodeA11y {
    const val SCREEN = "editAccessCode_screen"
    const val CATEGORY_GRID = "editAccessCode_categoryGrid"
    const val CATEGORY_OPTION = "editAccessCode_categoryOption"
    const val LABEL_FIELD = "editAccessCode_labelField"
    const val VALUE_FIELD = "editAccessCode_valueField"
    const val REVEAL_TOGGLE = "editAccessCode_revealToggle"
    const val COPY_BUTTON = "editAccessCode_copyButton"
    const val NOTES_FIELD = "editAccessCode_notesField"
    const val SHARED_WITH_OPTION = "editAccessCode_sharedWithOption"
    const val TOAST = "editAccessCode_toast"
}

/**
 * Single-page Add / Edit Access Code form. Wires through
 * [FormShell] with parity to the iOS `EditAccessCodeFormView`.
 */
@Composable
fun EditAccessCodeFormScreen(
    onClose: () -> Unit,
    viewModel: EditAccessCodeFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard =
        remember {
            context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        }

    LaunchedEffect(Unit) {
        viewModel.bindClipboard { value ->
            clipboard?.setPrimaryClip(ClipData.newPlainText("Access code", value))
        }
        viewModel.load()
    }

    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            onClose()
        }
    }

    SecureScreenEffect()

    EditAccessCodeFormContent(
        state = state,
        onClose = onClose,
        onCommit = { viewModel.submit() },
        onUpdate = viewModel::update,
        onSelectCategory = viewModel::selectCategory,
        onSelectVisibility = viewModel::selectVisibility,
        onToggleReveal = viewModel::toggleReveal,
        onCopy = viewModel::copyValue,
        rosterSummary = viewModel::rosterSummary,
        sharedWithNames = viewModel::sharedWithNames,
    )
}

@Composable
internal fun EditAccessCodeFormContent(
    state: EditAccessCodeUiState,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onUpdate: (EditAccessCodeField, String) -> Unit,
    onSelectCategory: (AccessCategory) -> Unit,
    onSelectVisibility: (AccessVisibility) -> Unit,
    onToggleReveal: () -> Unit,
    onCopy: () -> Unit,
    rosterSummary: (AccessVisibility) -> String,
    sharedWithNames: () -> List<String>,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(EditAccessCodeA11y.SCREEN),
    ) {
        FormShell(
            title = state.title,
            rightActionLabel = "Save",
            isValid = state.isValid,
            isDirty = state.isDirty,
            isSaving = state.isSaving,
            onClose = onClose,
            onCommit = onCommit,
        ) {
            FormFieldGroup("Category") {
                CategoryGrid(
                    selected = state.category,
                    onSelect = onSelectCategory,
                )
            }
            FormFieldGroup("Details") {
                LabelField(state = state, onUpdate = onUpdate)
                ValueField(
                    value = state.fields[EditAccessCodeField.Value]?.value.orEmpty(),
                    isRevealed = state.isRevealed,
                    error = state.fields[EditAccessCodeField.Value]?.error,
                    touched = state.fields[EditAccessCodeField.Value]?.touched == true,
                    onChange = { onUpdate(EditAccessCodeField.Value, it) },
                    onToggleReveal = onToggleReveal,
                    onCopy = onCopy,
                )
            }
            FormFieldGroup("Notes (optional)") {
                NotesField(
                    value = state.fields[EditAccessCodeField.Notes]?.value.orEmpty(),
                    error = state.fields[EditAccessCodeField.Notes]?.error,
                    onChange = { onUpdate(EditAccessCodeField.Notes, it) },
                )
            }
            FormFieldGroup("Shared with") {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    AccessVisibility.displayOrder.forEach { scope ->
                        VisibilityRow(
                            scope = scope,
                            isSelected = state.visibility == scope,
                            summary = rosterSummary(scope),
                            onSelect = { onSelectVisibility(scope) },
                        )
                    }
                    val preview = sharedWithNames()
                    if (preview.isNotEmpty()) {
                        MemberPreviewStrip(names = preview)
                    }
                }
            }
        }

        val reduceMotion = rememberReduceMotion()
        AnimatedVisibility(
            visible = state.toast != null,
            enter = fadeIn(animationSpec = MotionTokens.componentState(reduceMotion)),
            exit = fadeOut(animationSpec = MotionTokens.componentState(reduceMotion)),
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = Spacing.s10)
                    .testTag(EditAccessCodeA11y.TOAST),
        ) {
            state.toast?.let { toast ->
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (toast.isError) PantopusColors.error else PantopusColors.success)
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                ) {
                    Text(
                        text = toast.text,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun LabelField(
    state: EditAccessCodeUiState,
    onUpdate: (EditAccessCodeField, String) -> Unit,
) {
    val snapshot = state.fields[EditAccessCodeField.Label]
    val fieldState =
        when {
            snapshot == null || !snapshot.touched -> PantopusFieldState.Default
            snapshot.error != null -> PantopusFieldState.Error(snapshot.error)
            snapshot.value.trim().isEmpty() -> PantopusFieldState.Default
            else -> PantopusFieldState.Valid
        }
    PantopusTextField(
        label = "Label",
        value = snapshot?.value.orEmpty(),
        onValueChange = { onUpdate(EditAccessCodeField.Label, it) },
        placeholder = "Main network",
        state = fieldState,
        fieldTestTag = EditAccessCodeA11y.LABEL_FIELD,
    )
}

/** 3-column grid of category tiles. */
@Composable
private fun CategoryGrid(
    selected: AccessCategory,
    onSelect: (AccessCategory) -> Unit,
) {
    val categories = AccessCategory.displayOrder
    // Use a non-lazy fixed-height grid since the list is small (6 items)
    // and we don't want nested scroll containers.
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        userScrollEnabled = false,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        contentPadding = PaddingValues(0.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 200.dp, max = 200.dp)
                .testTag(EditAccessCodeA11y.CATEGORY_GRID),
    ) {
        items(categories, key = { it.wire }) { category ->
            CategoryTile(
                category = category,
                isSelected = category == selected,
                onSelect = { onSelect(category) },
            )
        }
    }
}

@Composable
private fun CategoryTile(
    category: AccessCategory,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val tag = "${EditAccessCodeA11y.CATEGORY_OPTION}_${category.wire}"
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 88.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(
                    if (isSelected) PantopusColors.primary600.copy(alpha = 0.06f) else PantopusColors.appSurface,
                ).border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                ).clickable(onClick = onSelect)
                .padding(vertical = Spacing.s2)
                .testTag(tag)
                .semantics { contentDescription = category.label },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(category.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = category.icon,
                contentDescription = null,
                size = Radii.xl2,
                tint = category.foreground,
            )
        }
        Text(
            text = category.label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun ValueField(
    value: String,
    isRevealed: Boolean,
    error: String?,
    touched: Boolean,
    onChange: (String) -> Unit,
    onToggleReveal: () -> Unit,
    onCopy: () -> Unit,
) {
    val borderColor =
        when {
            error != null && touched -> PantopusColors.error
            else -> PantopusColors.appBorder
        }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Code",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = borderColor,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(horizontal = Spacing.s3)
                    .testTag(EditAccessCodeA11y.VALUE_FIELD),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onChange,
                textStyle =
                    PantopusTextStyle.body.copy(
                        color = PantopusColors.appText,
                        fontFamily = FontFamily.Monospace,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                visualTransformation =
                    if (isRevealed) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.weight(1f),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "••••••••",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable(onClick = onToggleReveal)
                        .testTag(EditAccessCodeA11y.REVEAL_TOGGLE)
                        .semantics { contentDescription = if (isRevealed) "Hide code" else "Show code" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (isRevealed) PantopusIcon.EyeOff else PantopusIcon.Eye,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable(onClick = onCopy)
                        .testTag(EditAccessCodeA11y.COPY_BUTTON)
                        .semantics { contentDescription = "Copy code" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Copy,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        if (error != null && touched) {
            Text(
                text = error,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun NotesField(
    value: String,
    error: String?,
    onChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 88.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = if (error == null) PantopusColors.appBorder else PantopusColors.error,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(Spacing.s2)
                    .testTag(EditAccessCodeA11y.NOTES_FIELD),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "Anything members should know about this code…",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        if (error != null) {
            Text(
                text = error,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun VisibilityRow(
    scope: AccessVisibility,
    isSelected: Boolean,
    summary: String,
    onSelect: () -> Unit,
) {
    val tag = "${EditAccessCodeA11y.SHARED_WITH_OPTION}_${scope.wire}"
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(
                    if (isSelected) PantopusColors.primary600.copy(alpha = 0.08f) else PantopusColors.appSurface,
                ).border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                ).clickable(onClick = onSelect)
                .padding(Spacing.s3)
                .testTag(tag)
                .semantics { contentDescription = "${scope.headline}. ${scope.subcopy}" },
    ) {
        Radio(isSelected = isSelected)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = summary,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = scope.subcopy,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun Radio(isSelected: Boolean) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .border(
                    width = 1.5.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun MemberPreviewStrip(names: List<String>) {
    val display =
        if (names.size <= 3) {
            names.joinToString(", ")
        } else {
            names.take(3).joinToString(", ") + " +${names.size - 3} more"
        }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .padding(top = Spacing.s1)
                .semantics { contentDescription = "Shared with: $display" },
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Users,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = display,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}
