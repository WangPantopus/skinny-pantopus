@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
    "ComplexMethod",
)

package app.pantopus.android.ui.screens.businesses.page_editor

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
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessBannerLogoEditor
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessCompletionStrip
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessGalleryEditor
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessHoursEditor
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessIdentityStrip
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessMapPreview
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessServiceChipsEditor
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessStickySave
import app.pantopus.android.ui.screens.businesses.page_editor.components.EditBusinessStickySaveMode
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * P4.2 — A13.10 Edit Business Page. Top-level editor screen. The strip
 * under the top bar swaps between IdentityStrip (published) and
 * CompletionStrip (setup); the sticky save footer swaps between the
 * Discard/Save pair and the Save draft / Publish · N to go pair.
 */
@Composable
fun EditBusinessPageScreen(
    onBack: () -> Unit,
    onPreview: () -> Unit = {},
    viewModel: EditBusinessPageViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val showsDiscard by viewModel.showsDiscardConfirm.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("editBusinessPage"),
    ) {
        when (val current = state) {
            EditBusinessPageUiState.Loading ->
                LoadingLayout(onBack = onBack)
            is EditBusinessPageUiState.Loaded ->
                EditBusinessPageLoadedFrame(
                    content = current.content,
                    onBack = onBack,
                    onPreview = onPreview,
                    onDiscard = viewModel::discardRequested,
                    onSave = viewModel::save,
                    onSaveDraft = viewModel::saveDraft,
                    onPublish = viewModel::publish,
                    onFieldChange = viewModel::update,
                    onBeginDescription = viewModel::beginDescriptionEditing,
                )
            EditBusinessPageUiState.Empty ->
                EmptyLayout(
                    onBack = onBack,
                    onRetry = viewModel::refresh,
                )
            is EditBusinessPageUiState.Error ->
                ErrorLayout(
                    onBack = onBack,
                    message = current.message,
                    onRetry = viewModel::refresh,
                )
        }

        toast?.let { message ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText.copy(alpha = 0.9f))
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(
                    text = message,
                    style = TextStyle(fontSize = 14.sp),
                    color = PantopusColors.appTextInverse,
                )
            }
        }

        if (showsDiscard) {
            AlertDialog(
                onDismissRequest = viewModel::cancelDiscard,
                title = { Text("Discard unsaved edits?") },
                confirmButton = {
                    TextButton(onClick = viewModel::discardConfirmed) {
                        Text("Discard", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::cancelDiscard) { Text("Keep editing") }
                },
            )
        }
    }
}

/**
 * The loaded-state body extracted as an `internal` composable so the
 * Paparazzi snapshot test can render the two frames without standing up
 * a Hilt VM.
 */
@Composable
internal fun EditBusinessPageLoadedFrame(
    content: EditBusinessPageContent,
    onBack: () -> Unit,
    onPreview: () -> Unit,
    onDiscard: () -> Unit,
    onSave: () -> Unit,
    onSaveDraft: () -> Unit,
    onPublish: () -> Unit,
    onFieldChange: (EditBusinessPageFieldKey, String) -> Unit = { _, _ -> },
    onBeginDescription: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val isSetup = content.mode is EditBusinessPageMode.Setup
    Box(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            EditBusinessTopBar(
                rightEnabled = !isSetup,
                onBack = onBack,
                onRight = onPreview,
            )
            when (val mode = content.mode) {
                is EditBusinessPageMode.Published ->
                    EditBusinessIdentityStrip(
                        name = content.name.current,
                        lastPublishedLabel = mode.lastPublishedLabel,
                    )
                is EditBusinessPageMode.Setup ->
                    EditBusinessCompletionStrip(
                        done = mode.done,
                        total = mode.total,
                        items = mode.items,
                    )
            }
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                EditBusinessBannerLogoEditor(
                    banner = content.banner,
                    logo = content.logo,
                    modifier = Modifier.padding(horizontal = Spacing.s4).padding(top = Spacing.s4),
                )
                NameAndTaglineSection(content = content, onFieldChange = onFieldChange)
                DescriptionSection(
                    content = content,
                    onFieldChange = onFieldChange,
                    onBeginDescription = onBeginDescription,
                )
                HoursSection(content = content)
                ServicesSection(content = content)
                GallerySection(content = content)
                ContactSection(content = content, onFieldChange = onFieldChange)
                LocationSection(content = content, onFieldChange = onFieldChange)
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
        EditBusinessStickySave(
            mode = stickyMode(content.mode),
            onDiscard = onDiscard,
            onSave = onSave,
            onSaveDraft = onSaveDraft,
            onPublish = onPublish,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

private fun stickyMode(mode: EditBusinessPageMode): EditBusinessStickySaveMode =
    when (mode) {
        is EditBusinessPageMode.Published -> EditBusinessStickySaveMode.Dirty(count = mode.unsavedCount)
        is EditBusinessPageMode.Setup -> EditBusinessStickySaveMode.Setup(remaining = mode.remaining)
    }

@Composable
private fun EditBusinessTopBar(
    rightEnabled: Boolean,
    onBack: () -> Unit,
    onRight: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(PantopusColors.appSurface),
    ) {
        Text(
            text = "Edit business page",
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .semantics { heading() },
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .size(44.dp)
                    .clickable(onClick = onBack)
                    .testTag("editBusinessPage.back"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = Spacing.s2)
                    .heightIn(min = 44.dp)
                    .clickable(enabled = rightEnabled, onClick = onRight)
                    .padding(horizontal = Spacing.s3)
                    .testTag("editBusinessPage.preview")
                    .semantics {
                        contentDescription =
                            if (rightEnabled) "Preview public page" else "Preview (unavailable)"
                    },
            contentAlignment = Alignment.CenterEnd,
        ) {
            Text(
                text = "Preview",
                style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
                color = if (rightEnabled) PantopusColors.business else PantopusColors.appTextMuted,
                modifier = Modifier.wrapContentSize().padding(vertical = 12.dp),
            )
        }
        HorizontalDivider(
            color = PantopusColors.appBorderSubtle,
            thickness = 1.dp,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

// MARK: - Sections

@Composable
private fun SectionWrapper(
    overline: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = overline.uppercase(),
            style =
                TextStyle(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                ),
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        content()
    }
}

@Composable
private fun NameAndTaglineSection(
    content: EditBusinessPageContent,
    onFieldChange: (EditBusinessPageFieldKey, String) -> Unit,
) {
    SectionWrapper(overline = "Business name & tagline") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            BizField(
                label = "Name",
                required = true,
                field = content.name,
                state = BizFieldState.Valid,
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.Name, it) },
            )
            BizField(
                label = "Tagline",
                hint = "Shows in search and on map pins",
                field = content.tagline,
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.Tagline, it) },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Box(modifier = Modifier.weight(1f)) {
                    BizField(
                        label = "Category",
                        required = content.categoryRequired,
                        field = content.category,
                        trailing = BizFieldTrailing.Chevron,
                        onValueChange = { onFieldChange(EditBusinessPageFieldKey.Category, it) },
                    )
                }
                Box(modifier = Modifier.width(110.dp)) {
                    BizField(
                        label = "Price",
                        field = content.price,
                        onValueChange = { onFieldChange(EditBusinessPageFieldKey.Price, it) },
                    )
                }
            }
        }
    }
}

@Composable
private fun DescriptionSection(
    content: EditBusinessPageContent,
    onFieldChange: (EditBusinessPageFieldKey, String) -> Unit,
    onBeginDescription: () -> Unit,
) {
    SectionWrapper(overline = "Description") {
        when (val desc = content.description) {
            is EditBusinessPageDescriptionState.Field -> {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    BizLabel(label = "About", dirty = desc.field.isDirty, hint = "Markdown supported")
                    BizTextarea(
                        field = desc.field,
                        charLimit = desc.charLimit,
                        onValueChange = { onFieldChange(EditBusinessPageFieldKey.Description, it) },
                    )
                }
            }
            is EditBusinessPageDescriptionState.Prompt ->
                PromptBlock(prompt = desc.prompt, onTap = onBeginDescription)
        }
    }
}

@Composable
private fun HoursSection(content: EditBusinessPageContent) {
    SectionWrapper(overline = "Hours") {
        EditBusinessHoursEditor(state = content.hours)
    }
}

@Composable
private fun ServicesSection(content: EditBusinessPageContent) {
    SectionWrapper(overline = "Services") {
        when (val svc = content.services) {
            is EditBusinessPageServicesState.Chips -> {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    BizLabel(label = "What you offer")
                    EditBusinessServiceChipsEditor(chips = svc.chips)
                }
            }
            is EditBusinessPageServicesState.Prompt -> PromptBlock(prompt = svc.prompt)
        }
    }
}

@Composable
private fun GallerySection(content: EditBusinessPageContent) {
    SectionWrapper(overline = "Gallery") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            BizLabel(label = "Photos", hint = content.gallery.hintLabel)
            EditBusinessGalleryEditor(state = content.gallery)
        }
    }
}

@Composable
private fun ContactSection(
    content: EditBusinessPageContent,
    onFieldChange: (EditBusinessPageFieldKey, String) -> Unit,
) {
    SectionWrapper(overline = "Contact") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            BizField(
                label = "Phone",
                field = content.phone,
                leading = "+1",
                state = BizFieldState.Valid,
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.Phone, it) },
            )
            BizField(
                label = "Email",
                field = content.email,
                state = BizFieldState.Valid,
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.Email, it) },
            )
            BizField(
                label = "Website",
                field = content.website,
                leading = "https://",
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.Website, it) },
            )
            content.bookingLink?.let { booking ->
                BizField(
                    label = "Booking link",
                    hint = "Public on profile",
                    field = booking,
                    leading = "https://",
                    onValueChange = { onFieldChange(EditBusinessPageFieldKey.BookingLink, it) },
                )
            }
        }
    }
}

@Composable
private fun LocationSection(
    content: EditBusinessPageContent,
    onFieldChange: (EditBusinessPageFieldKey, String) -> Unit,
) {
    SectionWrapper(overline = "Location") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            BizField(
                label = "Address",
                required = true,
                field = content.location.address,
                state =
                    content.location.error?.let { BizFieldState.Error(it) }
                        ?: BizFieldState.Valid,
                trailing = BizFieldTrailing.MapPin,
                testTag = "editBusinessPage.field.address",
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.Address, it) },
            )
            BizField(
                label = "City",
                required = true,
                field = content.location.city,
                state = BizFieldState.Valid,
                testTag = "editBusinessPage.field.city",
                onValueChange = { onFieldChange(EditBusinessPageFieldKey.City, it) },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Box(modifier = Modifier.weight(1f)) {
                    BizField(
                        label = "State",
                        field = content.location.state,
                        testTag = "editBusinessPage.field.state",
                        onValueChange = { onFieldChange(EditBusinessPageFieldKey.State, it) },
                    )
                }
                Box(modifier = Modifier.width(110.dp)) {
                    BizField(
                        label = "ZIP code",
                        field = content.location.zip,
                        keyboardType = KeyboardType.Number,
                        testTag = "editBusinessPage.field.zip",
                        onValueChange = { onFieldChange(EditBusinessPageFieldKey.Zip, it) },
                    )
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                BizLabel(label = "Map", hint = "Drag the pin to refine")
                EditBusinessMapPreview(
                    verified = content.location.mapVerified,
                    pinDirty = content.location.pinDirty,
                )
            }
            if (content.mode is EditBusinessPageMode.Published) {
                HideAddressRow(on = content.location.hideExactAddress)
            }
        }
    }
}

// MARK: - BizLabel + BizField

@Composable
private fun BizLabel(
    label: String,
    required: Boolean = false,
    dirty: Boolean = false,
    hint: String? = null,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
            )
            if (required) {
                Text(
                    text = "*",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.error,
                )
            }
            if (dirty) {
                Spacer(modifier = Modifier.width(4.dp))
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.warning),
                )
            }
        }
        Spacer(modifier = Modifier.weight(1f))
        if (hint != null) {
            Text(
                text = hint,
                style = TextStyle(fontSize = 10.5.sp, fontStyle = FontStyle.Italic),
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

private enum class BizFieldTrailing { None, Chevron, MapPin }

private sealed interface BizFieldState {
    data object Default : BizFieldState

    data object Valid : BizFieldState

    data class Error(val message: String) : BizFieldState
}

@Composable
private fun BizField(
    label: String,
    field: EditBusinessPageField,
    required: Boolean = false,
    hint: String? = null,
    state: BizFieldState = BizFieldState.Default,
    leading: String? = null,
    trailing: BizFieldTrailing = BizFieldTrailing.None,
    keyboardType: KeyboardType = KeyboardType.Text,
    testTag: String? = null,
    onValueChange: ((String) -> Unit)? = null,
) {
    val borderColor =
        when (state) {
            BizFieldState.Valid -> PantopusColors.success
            is BizFieldState.Error -> PantopusColors.error
            BizFieldState.Default -> PantopusColors.appBorder
        }
    val a11y =
        buildString {
            append(label)
            if (required) append(", required")
            if (field.current.isNotEmpty()) append(", value: ${field.current}")
            if (field.isDirty) append(", unsaved")
            if (state is BizFieldState.Error) append(", error: ${state.message}")
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .semantics { contentDescription = a11y },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        BizLabel(label = label, required = required, dirty = field.isDirty, hint = hint)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(width = 1.dp, color = borderColor, shape = RoundedCornerShape(Radii.md))
                    .heightIn(min = 44.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (leading != null) {
                Text(
                    text = leading,
                    style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
            BasicTextField(
                value = field.current,
                onValueChange = { onValueChange?.invoke(it) },
                enabled = onValueChange != null,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.business),
                decorationBox = { inner ->
                    if (field.current.isEmpty()) {
                        Text(
                            text = field.placeholder,
                            style = TextStyle(fontSize = 14.sp),
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
                modifier =
                    Modifier
                        .weight(1f)
                        .padding(
                            start = if (leading == null) Spacing.s3 else 6.dp,
                            top = 11.dp,
                            bottom = 11.dp,
                        ),
            )
            TrailingIcon(state = state, trailing = trailing)
        }
        if (state is BizFieldState.Error) {
            Text(
                text = state.message,
                style = TextStyle(fontSize = 11.sp),
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun TrailingIcon(
    state: BizFieldState,
    trailing: BizFieldTrailing,
) {
    when {
        state is BizFieldState.Valid ->
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.success,
                modifier = Modifier.padding(end = Spacing.s3),
            )
        state is BizFieldState.Error ->
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.error,
                modifier = Modifier.padding(end = Spacing.s3),
            )
        trailing == BizFieldTrailing.Chevron ->
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(end = Spacing.s3),
            )
        trailing == BizFieldTrailing.MapPin ->
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(end = Spacing.s3),
            )
        else -> Unit
    }
}

@Composable
private fun BizTextarea(
    field: EditBusinessPageField,
    charLimit: Int,
    onValueChange: (String) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 124.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                .padding(12.dp)
                .semantics {
                    contentDescription =
                        "Description, ${field.current.length} of $charLimit characters"
                },
    ) {
        BasicTextField(
            value = field.current,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 13.sp, color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.business),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 72.dp)
                    .align(Alignment.TopStart)
                    .padding(bottom = 20.dp),
        )
        Text(
            text = "${field.current.length} / $charLimit",
            style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace),
            color = PantopusColors.appTextMuted,
            modifier = Modifier.align(Alignment.BottomEnd),
        )
    }
}

@Composable
private fun PromptBlock(
    prompt: EditBusinessPagePrompt,
    onTap: (() -> Unit)? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.5.dp,
                    color = PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.md),
                )
                .then(if (onTap != null) Modifier.clickable(onClick = onTap) else Modifier)
                .padding(14.dp)
                .semantics {
                    contentDescription = "${prompt.title}. ${prompt.subtitle}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.businessBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (prompt.iconKey == "sparkles") PantopusIcon.Sparkles else PantopusIcon.FileText,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = prompt.title,
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = prompt.subtitle,
                style = TextStyle(fontSize = 11.5.sp),
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.business)
                    .padding(horizontal = 12.dp, vertical = 7.dp),
        ) {
            Text(
                text = prompt.ctaLabel,
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun HideAddressRow(on: Boolean) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                .padding(14.dp)
                .semantics {
                    contentDescription =
                        "Hide exact address until contact, ${if (on) "on" else "off"}"
                },
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Hide exact address until contact",
                style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = "Show street name only on the public page.",
                style = TextStyle(fontSize = 11.5.sp),
                color = PantopusColors.appTextSecondary,
            )
        }
        // Simple capsule toggle visualization.
        Box(
            modifier =
                Modifier
                    .width(44.dp)
                    .height(26.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(if (on) PantopusColors.business else PantopusColors.appSurfaceSunken)
                    .border(
                        width = 1.dp,
                        color = PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.pill),
                    ),
            contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(
                modifier =
                    Modifier
                        .padding(2.dp)
                        .size(22.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface),
            )
        }
    }
}

// MARK: - Loading / Error states

@Composable
private fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().testTag("editBusinessPage.loading")) {
        EditBusinessTopBar(rightEnabled = false, onBack = onBack, onRight = {})
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = PantopusColors.business)
        }
    }
}

@Composable
private fun EmptyLayout(
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("editBusinessPage.empty")) {
        EditBusinessTopBar(rightEnabled = false, onBack = onBack, onRight = {})
        EmptyState(
            icon = PantopusIcon.Building2,
            headline = "Business not found",
            subcopy = "This business page isn't available to edit.",
            ctaTitle = "Try again",
            onCta = onRetry,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
private fun ErrorLayout(
    onBack: () -> Unit,
    message: String,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("editBusinessPage.error")) {
        EditBusinessTopBar(rightEnabled = false, onBack = onBack, onRight = {})
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load editor",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
            modifier = Modifier.fillMaxSize(),
        )
    }
}
