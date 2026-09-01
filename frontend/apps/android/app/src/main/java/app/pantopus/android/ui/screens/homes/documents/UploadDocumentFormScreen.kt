@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "MagicNumber",
    "TooGenericExceptionCaught",
    "LongParameterList",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.homes.documents

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Allowed picker MIME types — PDF / image / DOC / DOCX / XLSX. */
private val ALLOWED_UPLOAD_MIMES: Array<String> =
    arrayOf(
        "application/pdf",
        "image/*",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

@Composable
fun UploadDocumentFormScreen(
    onClose: () -> Unit,
    onUploaded: () -> Unit,
    viewModel: UploadDocumentFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showLinkSheet by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(state.shouldDismiss) {
        if (state.shouldDismiss) {
            viewModel.acknowledgeDismiss()
            onUploaded()
        }
    }

    val filePicker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocument(),
        ) { uri: Uri? ->
            if (uri != null) {
                val resolver = context.contentResolver
                val mime = resolver.getType(uri)
                val cursor = resolver.query(uri, null, null, null, null)
                var filename = uri.lastPathSegment ?: "document"
                var sizeBytes: Long? = null
                cursor?.use { c ->
                    if (c.moveToFirst()) {
                        val nameIdx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        val sizeIdx = c.getColumnIndex(android.provider.OpenableColumns.SIZE)
                        if (nameIdx >= 0) filename = c.getString(nameIdx)
                        if (sizeIdx >= 0 && !c.isNull(sizeIdx)) sizeBytes = c.getLong(sizeIdx)
                    }
                }
                viewModel.acceptPicked(filename = filename, sizeBytes = sizeBytes, mimeType = mime)
            }
        }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg),
    ) {
        FormShell(
            title = "Upload document",
            rightActionLabel = "Upload",
            isValid = state.isValid,
            isDirty = state.isDirty,
            isSaving = state.isSaving,
            onClose = onClose,
            onCommit = { viewModel.submit() },
        ) {
            FileSection(
                picked = state.pickedFile,
                onPick = { filePicker.launch(ALLOWED_UPLOAD_MIMES) },
                onRemove = viewModel::clearPickedFile,
            )
            TitleSection(state, viewModel::updateTitle)
            CategorySection(state.category, viewModel::selectCategory)
            TagsSection(
                tags = state.tags,
                draft = state.tagDraft,
                onDraftChange = viewModel::updateTagDraft,
                onCommit = viewModel::commitTagDraft,
                onRemove = viewModel::removeTag,
            )
            LinkedSection(
                link = state.linkedEntity,
                onOpenPicker = {
                    viewModel.loadLinkOptionsIfNeeded()
                    showLinkSheet = true
                },
                onClear = viewModel::clearLinkedEntity,
            )
            VisibilitySection(state.visibility, viewModel::selectVisibility)
        }

        state.toast?.let { toast ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s12)
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

    if (showLinkSheet) {
        LinkedEntityPickerDialog(
            state = state.linkOptionsState,
            onSelect = { option ->
                viewModel.selectLink(option)
                showLinkSheet = false
            },
            onRetry = { viewModel.loadLinkOptionsIfNeeded() },
            onDismiss = { showLinkSheet = false },
        )
    }
}

// MARK: - File section

@Composable
private fun FileSection(
    picked: PickedFile?,
    onPick: () -> Unit,
    onRemove: () -> Unit,
) {
    FormFieldGroup(title = "File") {
        if (picked == null) {
            FilePickerCta(onClick = onPick)
        } else {
            PickedFileCard(file = picked, onReplace = onPick, onRemove = onRemove)
        }
    }
}

@Composable
private fun FilePickerCta(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .testTag("uploadDocumentFileCTA")
                .semantics { contentDescription = "Choose a file to upload" }
                .padding(Spacing.s5),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Upload,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.home,
            )
            Text(
                text = "Choose a file",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = "PDF · JPG · PNG · DOC · DOCX · XLSX",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PickedFileCard(
    file: PickedFile,
    onReplace: () -> Unit,
    onRemove: () -> Unit,
) {
    val sizeLabel = remember(file) { formatBytes(file.sizeBytes) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        FileTypeTile(fileType = file.fileType, width = 40.dp, height = 48.dp)
        Spacer(Modifier.width(Spacing.s3))
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = file.filename,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                maxLines = 2,
            )
            sizeLabel?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier =
                    Modifier
                        .clickable(onClick = onReplace)
                        .testTag("uploadDocumentReplaceFile")
                        .semantics { contentDescription = "Replace file" }
                        .padding(top = Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.RefreshCw,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Replace",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(onClick = onRemove)
                    .testTag("uploadDocumentRemoveFile")
                    .semantics { contentDescription = "Remove file" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - Title section

@Composable
private fun TitleSection(
    state: UploadDocumentFormState,
    onChange: (String) -> Unit,
) {
    FormFieldGroup(title = "Title") {
        val fieldState =
            when {
                state.title.error != null && state.title.touched ->
                    PantopusFieldState.Error(state.title.error)
                state.title.touched && state.title.value.isNotEmpty() -> PantopusFieldState.Valid
                else -> PantopusFieldState.Default
            }
        PantopusTextField(
            label = "Document title",
            value = state.title.value,
            onValueChange = onChange,
            placeholder = "Lease — 412 Birch Ln",
            state = fieldState,
            fieldTestTag = "uploadDocumentTitleField",
        )
    }
}

// MARK: - Category section

@Composable
private fun CategorySection(
    selected: UploadDocumentCategory,
    onSelect: (UploadDocumentCategory) -> Unit,
) {
    FormFieldGroup(title = "Category") {
        // Two-row grid of nine chips; we lay them out manually with wrap.
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            UploadDocumentCategory.entries.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    row.forEach { category ->
                        CategoryChip(
                            category = category,
                            isSelected = category == selected,
                            onClick = { onSelect(category) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    repeat(3 - row.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryChip(
    category: UploadDocumentCategory,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = category.palette
    val background = if (isSelected) palette.background else PantopusColors.appSurface
    val foreground = if (isSelected) palette.foreground else PantopusColors.appText
    val borderColor = if (isSelected) palette.foreground else PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .border(if (isSelected) 1.5f.dp else 1.dp, borderColor, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .heightIn(min = 36.dp)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("uploadDocumentCategoryChip_${category.id}")
                .semantics { contentDescription = category.label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = category.palette.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = foreground,
        )
        Text(
            text = category.label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = foreground,
        )
    }
}

// MARK: - Tags section

@Composable
private fun TagsSection(
    tags: List<String>,
    draft: String,
    onDraftChange: (String) -> Unit,
    onCommit: () -> Unit,
    onRemove: (String) -> Unit,
) {
    FormFieldGroup(title = "Tags") {
        if (tags.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                tags.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        row.forEach { tag ->
                            TagChip(tag = tag, onRemove = { onRemove(tag) })
                        }
                    }
                }
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3)
                    .heightIn(min = 44.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextField(
                value = draft,
                onValueChange = onDraftChange,
                placeholder = { Text("Add tag", style = PantopusTextStyle.body) },
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("uploadDocumentTagField"),
                colors =
                    TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        disabledIndicatorColor = Color.Transparent,
                    ),
            )
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(enabled = draft.trim().isNotEmpty(), onClick = onCommit)
                        .testTag("uploadDocumentTagCommit")
                        .semantics { contentDescription = "Add tag" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.PlusCircle,
                    contentDescription = null,
                    size = Radii.xl2,
                    tint =
                        if (draft.trim().isEmpty()) {
                            PantopusColors.appTextMuted
                        } else {
                            PantopusColors.primary600
                        },
                )
            }
        }
    }
}

@Composable
private fun TagChip(
    tag: String,
    onRemove: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = tag,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appText,
        )
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clickable(onClick = onRemove)
                    .semantics { contentDescription = "Remove tag $tag" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - Linked-to section

@Composable
private fun LinkedSection(
    link: UploadDocumentLinkOption?,
    onOpenPicker: () -> Unit,
    onClear: () -> Unit,
) {
    FormFieldGroup(title = "Linked to") {
        if (link != null) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = link.kind.icon,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.home,
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = link.title,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                        maxLines = 1,
                    )
                    Text(
                        text = link.subtitle?.let { "${link.kind.label} · $it" } ?: link.kind.label,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clickable(onClick = onClear)
                            .testTag("uploadDocumentLinkClear")
                            .semantics { contentDescription = "Remove linked entity" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
        } else {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClick = onOpenPicker)
                        .testTag("uploadDocumentLinkButton")
                        .semantics { contentDescription = "Add link to bill, maintenance task, or pet" }
                        .padding(Spacing.s3)
                        .heightIn(min = 44.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Link,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Add a link",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.primary600,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

private val UploadDocumentLinkKind.icon: PantopusIcon
    get() =
        when (this) {
            UploadDocumentLinkKind.Bill -> PantopusIcon.ReceiptText
            UploadDocumentLinkKind.Maintenance -> PantopusIcon.Hammer
            UploadDocumentLinkKind.Pet -> PantopusIcon.PawPrint
        }

// MARK: - Visibility section

@Composable
private fun VisibilitySection(
    selected: UploadDocumentVisibility,
    onSelect: (UploadDocumentVisibility) -> Unit,
) {
    FormFieldGroup(title = "Visibility") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            UploadDocumentVisibility.entries.forEach { choice ->
                VisibilityRow(choice = choice, isSelected = choice == selected) {
                    onSelect(choice)
                }
            }
        }
    }
}

@Composable
private fun VisibilityRow(
    choice: UploadDocumentVisibility,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    val subtitle =
        when (choice) {
            UploadDocumentVisibility.Owners -> "Only owners and managers can read this."
            UploadDocumentVisibility.AllMembers -> "Everyone with access to the home."
        }
    val icon =
        when (choice) {
            UploadDocumentVisibility.Owners -> PantopusIcon.Lock
            UploadDocumentVisibility.AllMembers -> PantopusIcon.Users
        }
    val borderColor = if (isSelected) PantopusColors.home else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(if (isSelected) 1.5f.dp else 1.dp, borderColor, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .heightIn(min = 56.dp)
                .testTag("uploadDocumentVisibility_${choice.wire}")
                .semantics { contentDescription = "${choice.label}, $subtitle" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.home,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = choice.label,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        RadioMark(isSelected = isSelected)
    }
}

@Composable
private fun RadioMark(isSelected: Boolean) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .border(
                    width = if (isSelected) 6.dp else 2.dp,
                    color = if (isSelected) PantopusColors.home else PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.pill),
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface),
            )
        }
    }
}

// MARK: - Linked-entity picker dialog

@Composable
private fun LinkedEntityPickerDialog(
    state: UploadDocumentLinkOptionsState,
    onSelect: (UploadDocumentLinkOption) -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = 480.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appBg)
                    .testTag("uploadDocumentLinkSheet"),
        ) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Link to…",
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.testTag("uploadDocumentLinkSheetCancel"),
                ) {
                    Text(
                        text = "Cancel",
                        color = PantopusColors.primary600,
                    )
                }
            }
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            when (state) {
                UploadDocumentLinkOptionsState.Idle, UploadDocumentLinkOptionsState.Loading ->
                    LinkOptionsSkeleton()
                is UploadDocumentLinkOptionsState.Loaded ->
                    if (state.options.isEmpty()) {
                        EmptyLinkOptions()
                    } else {
                        LinkOptionsList(options = state.options, onSelect = onSelect)
                    }
                is UploadDocumentLinkOptionsState.Error ->
                    LinkOptionsError(message = state.message, onRetry = onRetry)
            }
        }
    }
}

@Composable
private fun LinkOptionsSkeleton() {
    Column(
        modifier = Modifier.padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun EmptyLinkOptions() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Link,
            contentDescription = null,
            size = 32.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "Nothing to link yet",
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
        Text(
            text = "Add a bill, maintenance task, or pet to this home first.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun LinkOptionsError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Couldn't load options",
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        TextButton(onClick = onRetry) {
            Text("Try again")
        }
    }
}

@Composable
private fun LinkOptionsList(
    options: List<UploadDocumentLinkOption>,
    onSelect: (UploadDocumentLinkOption) -> Unit,
) {
    val grouped =
        UploadDocumentLinkKind.entries.associateWith { kind ->
            options.filter { it.kind == kind }
        }
    LazyColumn(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(max = 480.dp)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        grouped.forEach { (kind, items) ->
            if (items.isEmpty()) return@forEach
            item(key = "section-${kind.id}") {
                Text(
                    text = kind.label.uppercase(),
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextSecondary,
                )
            }
            items(items, key = { it.kind.id + ":" + it.id }) { option ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurface)
                            .clickable { onSelect(option) }
                            .testTag("uploadDocumentLinkOption_${option.kind.id}_${option.id}")
                            .semantics { contentDescription = "${option.kind.label} ${option.title}" }
                            .padding(Spacing.s3)
                            .heightIn(min = 56.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PantopusIconImage(
                        icon = option.kind.icon,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.home,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = option.title,
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appText,
                            maxLines = 1,
                        )
                        if (!option.subtitle.isNullOrEmpty()) {
                            Text(
                                text = option.subtitle,
                                style = PantopusTextStyle.caption,
                                color = PantopusColors.appTextSecondary,
                            )
                        }
                    }
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

// MARK: - Helpers

/**
 * Format bytes into a human-friendly KB/MB/GB string. Mirrors the
 * helper inside the iOS view-model so the two surfaces agree.
 */
internal fun formatBytes(bytes: Long?): String? {
    if (bytes == null || bytes <= 0) return null
    val kb = bytes / 1024.0
    val mb = kb / 1024.0
    val gb = mb / 1024.0
    return when {
        gb >= 1.0 -> "%.1f GB".format(gb)
        mb >= 1.0 -> "%.1f MB".format(mb)
        kb >= 1.0 -> "%.0f KB".format(kb)
        else -> "$bytes B"
    }
}
