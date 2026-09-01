@file:Suppress("CyclomaticComplexMethod", "LongMethod", "MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.gigs.quickpost

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.FutureDateTimePickerDialogs
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

@Composable
fun PostGigV1Screen(
    onDismiss: () -> Unit,
    onPosted: (String) -> Unit,
    preselectedCategoryKey: String? = null,
    viewModel: PostGigV1ViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val content = state as? PostGigV1UiState.Content
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // P0.3 — real Material3 date + time pickers behind the date field.
    var showDateTimePicker by remember { mutableStateOf(false) }

    // A13.8 P5 — the same picker pair, driving the optional `deadline`.
    var showDeadlinePicker by remember { mutableStateOf(false) }

    // P0.2 — modern photo picker; picked URIs are copied to bytes and
    // uploaded immediately by the VM.
    val handlePicked: (Uri?) -> Unit = { uri ->
        if (uri != null) {
            scope.launch {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                if (bytes != null) {
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    viewModel.addPickedPhoto(
                        PostGigV1PickedPhoto(
                            filename = "gig-${UUID.randomUUID().toString().take(6)}.jpg",
                            mimeType = mime,
                            bytes = bytes,
                        ),
                    )
                }
            }
        }
    }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia(), handlePicked)

    // P6b — real camera capture behind the Add tile's "Take a photo"
    // option (closes the P0 deferral). `TakePicture()` writes into a
    // cache-dir file exposed through the app FileProvider, then the
    // captured URI rides the SAME `handlePicked` upload path as library
    // picks. Saveable across process death during capture.
    var pendingCameraUri by rememberSaveable { mutableStateOf<String?>(null) }
    val cameraCapture =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            val uri = pendingCameraUri?.let(Uri::parse)
            pendingCameraUri = null
            if (success) handlePicked(uri)
        }
    val launchCamera = {
        val photoFile = File(context.cacheDir, "gig-camera-${UUID.randomUUID()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", photoFile)
        pendingCameraUri = uri.toString()
        // No camera app (or a broken resolver) must not crash — drop it.
        runCatching { cameraCapture.launch(uri) }.onFailure { pendingCameraUri = null }
        Unit
    }
    // CAMERA is declared in the manifest, so the TakePicture intent
    // requires the runtime grant first. Denial is graceful: skip capture.
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) launchCamera()
        }
    val onTakePhoto = {
        if (
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            launchCamera()
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    LaunchedEffect(preselectedCategoryKey) {
        viewModel.preselectCategoryIfNeeded(GigsCategory.fromBackendKey(preselectedCategoryKey))
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            is PostGigV1Event.Posted -> {
                viewModel.acknowledgeEvent()
                onPosted(event.gigId)
            }
            null -> Unit
        }
    }

    FormShell(
        // P4 — the same screen doubles as the owner's gig editor.
        title = if (viewModel.isEditMode) "Edit gig" else "Post gig",
        leading = FormShellLeading.Back,
        rightActionLabel = if (viewModel.isEditMode) "Save" else "Post",
        isValid = content?.canAttemptSubmit == true,
        isDirty = content?.isPostEnabled == true,
        isSaving = content?.isSubmitting == true,
        onClose = onDismiss,
        onCommit = { viewModel.submit() },
    ) {
        when (val s = state) {
            PostGigV1UiState.Loading -> PostGigV1Loading()
            PostGigV1UiState.Empty -> PostGigV1Empty(onStart = viewModel::startFromEmpty)
            is PostGigV1UiState.FatalError -> PostGigV1FatalError(message = s.message, onRetry = viewModel::retry)
            is PostGigV1UiState.Content ->
                PostGigV1Content(
                    state = s,
                    actions =
                        PostGigV1Actions(
                            onCategory = viewModel::updateCategory,
                            onTitle = viewModel::updateTitle,
                            onDescription = viewModel::updateDescription,
                            onPrice = viewModel::updatePrice,
                            onPriceType = viewModel::updatePriceType,
                            onPickDate = { showDateTimePicker = true },
                            onLocation = viewModel::updateLocation,
                            onAddPhoto = {
                                photoPicker.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                )
                            },
                            onTakePhoto = onTakePhoto,
                            onRemovePhoto = viewModel::removePhoto,
                            onRetryPhoto = viewModel::retryPhotoUpload,
                            onCancellationPolicy = viewModel::updateCancellationPolicy,
                            onIsUrgent = viewModel::updateIsUrgent,
                            onTags = viewModel::updateTags,
                            onEstimatedDuration = viewModel::updateEstimatedDuration,
                            onDeadlineToggle = { enabled ->
                                if (enabled) showDeadlinePicker = true else viewModel.updateDeadline(null)
                            },
                            onPickDeadline = { showDeadlinePicker = true },
                            onAddItem = viewModel::addItem,
                            onUpdateItem = viewModel::updateItem,
                            onRemoveItem = viewModel::removeItem,
                        ),
                )
        }
    }

    if (showDateTimePicker) {
        FutureDateTimePickerDialogs(
            initial = content?.form?.scheduledAt,
            onPicked = { picked ->
                showDateTimePicker = false
                viewModel.updateScheduledAt(picked)
            },
            onDismiss = { showDateTimePicker = false },
        )
    }

    if (showDeadlinePicker) {
        FutureDateTimePickerDialogs(
            initial = content?.form?.deadline ?: content?.form?.scheduledAt,
            onPicked = { picked ->
                showDeadlinePicker = false
                viewModel.updateDeadline(picked)
            },
            onDismiss = { showDeadlinePicker = false },
        )
    }
}

data class PostGigV1Actions(
    val onCategory: (GigsCategory) -> Unit = {},
    val onTitle: (String) -> Unit = {},
    val onDescription: (String) -> Unit = {},
    val onPrice: (String) -> Unit = {},
    val onPriceType: (PostGigV1PriceType) -> Unit = {},
    val onPickDate: () -> Unit = {},
    val onLocation: (String) -> Unit = {},
    val onAddPhoto: () -> Unit = {},
    /** P6b — camera capture option on the Add tile. */
    val onTakePhoto: () -> Unit = {},
    val onRemovePhoto: (String) -> Unit = {},
    /** P0.2 — tap-to-retry on a failed upload tile. */
    val onRetryPhoto: (String) -> Unit = {},
    // A13.8 P5 — the rest of RN's editable field set.
    val onCancellationPolicy: (PostGigV1CancellationPolicy) -> Unit = {},
    val onIsUrgent: (Boolean) -> Unit = {},
    val onTags: (String) -> Unit = {},
    val onEstimatedDuration: (String) -> Unit = {},
    /** Opens the deadline picker; `false` clears the deadline outright. */
    val onDeadlineToggle: (Boolean) -> Unit = {},
    val onPickDeadline: () -> Unit = {},
    val onAddItem: () -> Unit = {},
    val onUpdateItem: (String, (PostGigV1Item) -> PostGigV1Item) -> Unit = { _, _ -> },
    val onRemoveItem: (String) -> Unit = {},
)

@Composable
fun PostGigV1Content(
    state: PostGigV1UiState.Content,
    actions: PostGigV1Actions,
) {
    val errors = state.validationErrors
    val form = state.form

    if (errors.isNotEmpty()) {
        PostGigV1ErrorBanner(
            errors = errors,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
    }

    FormFieldGroup(title = "Category") {
        CategoryField(
            selected = form.category,
            error = errors.messageFor(PostGigV1Field.Category),
            onSelect = actions.onCategory,
        )
    }

    FormFieldGroup(title = "Details") {
        PantopusTextField(
            label = "Title",
            value = form.title,
            onValueChange = actions.onTitle,
            placeholder = "Help moving a sofa up 3 flights",
            state = errors.fieldState(PostGigV1Field.Title),
            isRequired = true,
            fieldTestTag = "postGigV1_title",
        )
        DescriptionField(
            value = form.description,
            error = errors.messageFor(PostGigV1Field.Description),
            onValueChange = actions.onDescription,
        )
    }

    FormFieldGroup(title = "Pay") {
        PriceField(
            value = form.price,
            unit = form.priceType.unitLabel,
            // P4 — Free disables (and the VM clears) the price input.
            enabled = form.priceType != PostGigV1PriceType.Free,
            error = errors.messageFor(PostGigV1Field.Price),
            onValueChange = actions.onPrice,
        )
        PriceTypeRow(selected = form.priceType, onSelect = actions.onPriceType)
    }

    FormFieldGroup(title = "When") {
        DateField(
            scheduledAt = form.scheduledAt,
            error = errors.messageFor(PostGigV1Field.DateTime),
            onClick = actions.onPickDate,
        )
    }

    FormFieldGroup(title = "Photos") {
        PhotosGrid(
            photos = form.photos,
            canAdd = form.photos.size < PostGigV1SampleData.MAX_PHOTOS,
            onAdd = actions.onAddPhoto,
            onTakePhoto = actions.onTakePhoto,
            onRemove = actions.onRemovePhoto,
            onRetry = actions.onRetryPhoto,
        )
    }

    FormFieldGroup(title = "Location") {
        PantopusTextField(
            label = "Location",
            value = form.location,
            onValueChange = actions.onLocation,
            placeholder = "Pearl District · NW 11th & Johnson",
            state = errors.fieldState(PostGigV1Field.Location),
            isRequired = true,
            fieldTestTag = "postGigV1_location",
        )
    }

    // A13.8 P5 — the rest of RN's editable field set, so an edit can touch
    // every column the PATCH schema accepts (`gigs.js:642`).
    FormFieldGroup(title = "More details") {
        DeadlineField(
            deadline = form.deadline,
            onToggle = actions.onDeadlineToggle,
            onPick = actions.onPickDeadline,
        )
        PantopusTextField(
            label = "Estimated duration (hours)",
            value = form.estimatedDuration,
            onValueChange = actions.onEstimatedDuration,
            placeholder = "1.5",
            state = errors.fieldState(PostGigV1Field.EstimatedDuration),
            keyboardType = KeyboardType.Decimal,
            fieldTestTag = "postGigV1_estimatedDuration",
        )
        PantopusTextField(
            label = "Tags",
            value = form.tags,
            onValueChange = actions.onTags,
            placeholder = "heavy lifting, weekend, two-person",
            fieldTestTag = "postGigV1_tags",
        )
        Text(
            text = "Comma-separated · up to ${PostGigV1SampleData.MAX_TAGS}",
            fontSize = 11.sp,
            fontStyle = FontStyle.Italic,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("postGigV1_tagsHint"),
        )
        UrgentToggle(isOn = form.isUrgent, onToggle = actions.onIsUrgent)
    }

    FormFieldGroup(title = "Items") {
        ItemsField(
            items = form.items,
            canAdd = form.items.size < PostGigV1SampleData.MAX_ITEMS,
            onAdd = actions.onAddItem,
            onUpdate = actions.onUpdateItem,
            onRemove = actions.onRemoveItem,
        )
    }

    FormFieldGroup(title = "Cancellation") {
        CancellationPolicyField(
            selected = form.cancellationPolicy,
            onSelect = actions.onCancellationPolicy,
        )
    }

    LegacyStamp()
}

/**
 * Optional `deadline` — off by default; enabling reveals the picker.
 * `Joi.date().iso().min('now')` has no `allow(null)`, so once a deadline
 * exists the editor can move it but not clear it server-side.
 */
@Composable
private fun DeadlineField(
    deadline: LocalDateTime?,
    onToggle: (Boolean) -> Unit,
    onPick: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .testTag("postGigV1_deadlineToggle"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Set a deadline",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Switch(
                checked = deadline != null,
                onCheckedChange = onToggle,
                colors =
                    SwitchDefaults.colors(
                        checkedThumbColor = PantopusColors.appTextInverse,
                        checkedTrackColor = PantopusColors.primary600,
                    ),
            )
        }
        if (deadline != null) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .clickable(onClick = onPick)
                        .padding(horizontal = Spacing.s3)
                        .testTag("postGigV1_deadline")
                        .semantics { contentDescription = "Deadline" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CalendarClock,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = deadline.format(PostGigV1DateFormatter),
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

/** `is_urgent` toggle — RN's "urgent" checkbox. */
@Composable
private fun UrgentToggle(
    isOn: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .testTag("postGigV1_isUrgent"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Mark as urgent",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Surfaces the task in the urgent feed and unlocks the live status stepper.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = isOn,
            onCheckedChange = onToggle,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appTextInverse,
                    checkedTrackColor = PantopusColors.primary600,
                ),
        )
    }
}

/** Errand / shopping line items (`items[]`) — add / edit / remove. */
@Composable
private fun ItemsField(
    items: List<PostGigV1Item>,
    canAdd: Boolean,
    onAdd: () -> Unit,
    onUpdate: (String, (PostGigV1Item) -> PostGigV1Item) -> Unit,
    onRemove: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            FieldLabel("Items to pick up", required = false)
            Text(
                text = "(up to ${PostGigV1SampleData.MAX_ITEMS})",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }
        if (items.isEmpty()) {
            Text(
                text = "Add a shopping or errand list so your helper knows exactly what to get.",
                fontSize = 11.sp,
                fontStyle = FontStyle.Italic,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("postGigV1_itemsHint"),
            )
        }
        items.forEach { item ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceMuted)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Item",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    Box(
                        modifier =
                            Modifier
                                .size(28.dp)
                                .clickable(onClick = { onRemove(item.id) })
                                .testTag("postGigV1_removeItem_${item.id}")
                                .semantics { contentDescription = "Remove item" },
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.X,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.error,
                        )
                    }
                }
                PantopusTextField(
                    label = "Name",
                    value = item.name,
                    onValueChange = { value -> onUpdate(item.id) { it.copy(name = value) } },
                    fieldTestTag = "postGigV1_itemName_${item.id}",
                )
                PantopusTextField(
                    label = "Notes",
                    value = item.notes,
                    onValueChange = { value -> onUpdate(item.id) { it.copy(notes = value) } },
                    fieldTestTag = "postGigV1_itemNotes_${item.id}",
                )
                PantopusTextField(
                    label = "Budget cap",
                    value = item.budgetCap,
                    onValueChange = { value -> onUpdate(item.id) { it.copy(budgetCap = value) } },
                    fieldTestTag = "postGigV1_itemBudget_${item.id}",
                )
                PantopusTextField(
                    label = "Preferred store",
                    value = item.preferredStore,
                    onValueChange = { value -> onUpdate(item.id) { it.copy(preferredStore = value) } },
                    fieldTestTag = "postGigV1_itemStore_${item.id}",
                )
            }
        }
        if (canAdd) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50)
                        .clickable(onClick = onAdd)
                        .testTag("postGigV1_addItem"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Plus,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Add item",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

/**
 * `cancellation_policy` picker — one card per policy with the backend's
 * own blurb (`gigs.js:541`), so the poster sees the real fee rule.
 */
@Composable
private fun CancellationPolicyField(
    selected: PostGigV1CancellationPolicy,
    onSelect: (PostGigV1CancellationPolicy) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        FieldLabel("Cancellation policy", required = false)
        PostGigV1CancellationPolicy.entries.forEach { policy ->
            val isSelected = policy == selected
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(
                            if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface,
                        ).border(
                            width = 1.dp,
                            color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.md),
                        ).clickable { onSelect(policy) }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("postGigV1_cancellationPolicy_${policy.wire}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                RadioButton(
                    selected = isSelected,
                    onClick = { onSelect(policy) },
                    colors = RadioButtonDefaults.colors(selectedColor = PantopusColors.primary600),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = policy.label,
                        style = PantopusTextStyle.caption,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = policy.blurb,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryField(
    selected: GigsCategory,
    error: String?,
    onSelect: (GigsCategory) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val border = if (error == null) PantopusColors.appBorder else PantopusColors.error

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        FieldLabel("Category", required = true)
        Box {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(
                            width = if (error == null) 1.dp else 1.5.dp,
                            color = border,
                            shape = RoundedCornerShape(Radii.md),
                        ).clickable { expanded = true }
                        .padding(horizontal = Spacing.s3)
                        .testTag("postGigV1_category")
                        .semantics { contentDescription = "Category" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = if (selected == GigsCategory.All) "Choose a category" else selected.v1Label(),
                    style = PantopusTextStyle.small,
                    fontWeight = if (selected == GigsCategory.All) FontWeight.Normal else FontWeight.Medium,
                    color = if (selected == GigsCategory.All) PantopusColors.appTextMuted else PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                GigsCategory.entries.filter { it != GigsCategory.All }.forEach { category ->
                    DropdownMenuItem(
                        text = { Text(category.v1Label()) },
                        onClick = {
                            expanded = false
                            onSelect(category)
                        },
                    )
                }
            }
        }
        if (error != null) InlineError(error)
    }
}

@Composable
private fun DescriptionField(
    value: String,
    error: String?,
    onValueChange: (String) -> Unit,
) {
    val border = if (error == null) PantopusColors.appBorder else PantopusColors.error
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        FieldLabel("Description", required = true)
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = if (error == null) 1.dp else 1.5.dp,
                        color = border,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(Spacing.s3),
        ) {
            BasicTextField(
                value = value,
                onValueChange = {
                    onValueChange(it.take(PostGigV1SampleData.DESCRIPTION_MAX_LENGTH))
                },
                textStyle = PantopusTextStyle.small.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 96.dp)
                        .testTag("postGigV1_description")
                        .semantics {
                            contentDescription =
                                if (error == null) "Description" else "Description, error: $error"
                        },
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "Tell neighbors what to carry, where to meet, and any stairs or timing constraints.",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
        Row(verticalAlignment = Alignment.Top) {
            if (error != null) InlineError(error)
            Spacer(modifier = Modifier.weight(1f))
            // A13.8 P4 — 11sp monospace counter; the 40-char minimum is enforced by validation.
            Text(
                text = "${value.length} / ${PostGigV1SampleData.DESCRIPTION_MAX_LENGTH}",
                style = PantopusTextStyle.caption.copy(fontFamily = FontFamily.Monospace, fontSize = 11.sp),
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("postGigV1_descriptionCount"),
            )
        }
    }
}

@Composable
private fun PriceField(
    value: String,
    unit: String?,
    enabled: Boolean,
    error: String?,
    onValueChange: (String) -> Unit,
) {
    val border = if (error == null) PantopusColors.appBorder else PantopusColors.error
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        FieldLabel("Price", required = enabled)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceSunken)
                    .border(
                        width = if (error == null) 1.dp else 1.5.dp,
                        color = border,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "$",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = if (value.isEmpty()) PantopusColors.appTextMuted else PantopusColors.appTextStrong,
            )
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText, fontWeight = FontWeight.SemiBold),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("postGigV1_price")
                        .semantics {
                            contentDescription =
                                when {
                                    !enabled -> "Price, free gig"
                                    error == null -> "Price"
                                    else -> "Price, error: $error"
                                }
                        },
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = if (enabled) "0" else "Free",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            if (unit != null) {
                Box(
                    modifier =
                        Modifier
                            .height(20.dp)
                            .width(1.dp)
                            .background(PantopusColors.appBorderSubtle),
                )
                Text(text = unit, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        if (error != null) InlineError(error)
    }
}

@Composable
private fun PriceTypeRow(
    selected: PostGigV1PriceType,
    onSelect: (PostGigV1PriceType) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        FieldLabel("Price type", required = false)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s5), verticalAlignment = Alignment.CenterVertically) {
            PostGigV1PriceType.entries.forEach { type ->
                Row(
                    modifier =
                        Modifier
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable { onSelect(type) }
                            .padding(end = Spacing.s1)
                            .testTag("postGigV1_priceType_${type.name.lowercase()}")
                            .semantics { contentDescription = "${type.label} price" },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(18.dp)
                                .border(
                                    width = if (type == selected) 5.dp else 1.5.dp,
                                    color = if (type == selected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                                    shape = CircleShape,
                                ),
                    )
                    Text(
                        text = type.label,
                        style = PantopusTextStyle.caption,
                        fontWeight = if (type == selected) FontWeight.SemiBold else FontWeight.Medium,
                        color = PantopusColors.appText,
                    )
                }
            }
        }
    }
}

@Composable
private fun DateField(
    scheduledAt: LocalDateTime,
    error: String?,
    onClick: () -> Unit,
) {
    val border = if (error == null) PantopusColors.appBorder else PantopusColors.error
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        FieldLabel("Date & time", required = true)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = if (error == null) 1.dp else 1.5.dp,
                        color = border,
                        shape = RoundedCornerShape(Radii.md),
                    ).clickable(onClick = onClick)
                    .padding(horizontal = Spacing.s3)
                    .testTag("postGigV1_dateTime")
                    .semantics { contentDescription = if (error == null) "Date and time" else "Date and time, error: $error" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = scheduledAt.format(PostGigV1DateFormatter),
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (error != null) InlineError(error)
    }
}

@Composable
private fun PhotosGrid(
    photos: List<PostGigV1Photo>,
    canAdd: Boolean,
    onAdd: () -> Unit,
    onTakePhoto: () -> Unit,
    onRemove: (String) -> Unit,
    onRetry: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            FieldLabel("Photos", required = false)
            Text(
                text = "(up to ${PostGigV1SampleData.MAX_PHOTOS})",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }

        val tiles: List<PhotoGridItem> =
            photos.map { PhotoGridItem.Photo(it) } +
                if (canAdd) listOf(PhotoGridItem.Add) else emptyList()
        tiles.chunked(4).forEachIndexed { rowIndex, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                row.forEachIndexed { columnIndex, item ->
                    val index = rowIndex * 4 + columnIndex
                    when (item) {
                        PhotoGridItem.Add ->
                            AddPhotoTile(
                                onPickLibrary = onAdd,
                                onTakePhoto = onTakePhoto,
                                modifier = Modifier.weight(1f),
                            )
                        is PhotoGridItem.Photo ->
                            PhotoTile(
                                photo = item.photo,
                                isCover = index == 0,
                                onRemove = onRemove,
                                onRetry = onRetry,
                                modifier = Modifier.weight(1f),
                            )
                    }
                }
                repeat(4 - row.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
        // A13.8 P4 — design-exact 11sp italic captions.
        Text(
            text =
                if (photos.isEmpty()) {
                    "Photos help your gig get picked up faster."
                } else {
                    "First photo is the cover. Tap × to remove."
                },
            style = PantopusTextStyle.caption.copy(fontSize = 11.sp, fontStyle = FontStyle.Italic),
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("postGigV1_photoHint"),
        )
    }
}

private sealed interface PhotoGridItem {
    data class Photo(
        val photo: PostGigV1Photo,
    ) : PhotoGridItem

    data object Add : PhotoGridItem
}

@Composable
private fun AddPhotoTile(
    onPickLibrary: () -> Unit,
    onTakePhoto: () -> Unit,
    modifier: Modifier,
) {
    // P6b — the tile opens a two-option source menu (camera capture vs
    // library pick) instead of jumping straight into the library.
    var sourceMenuOpen by remember { mutableStateOf(false) }
    Box(modifier = modifier.aspectRatio(1f)) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceMuted)
                    .border(
                        width = 1.5.dp,
                        color = PantopusColors.appBorderStrong,
                        shape = RoundedCornerShape(Radii.lg),
                    ).clickable { sourceMenuOpen = true }
                    .testTag("postGigV1_addPhoto")
                    .semantics { contentDescription = "Add photo" },
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Add",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        DropdownMenu(expanded = sourceMenuOpen, onDismissRequest = { sourceMenuOpen = false }) {
            DropdownMenuItem(
                text = { Text("Take a photo") },
                onClick = {
                    sourceMenuOpen = false
                    onTakePhoto()
                },
                modifier = Modifier.testTag("postGigV1_addPhoto_camera"),
            )
            DropdownMenuItem(
                text = { Text("Photo library") },
                onClick = {
                    sourceMenuOpen = false
                    onPickLibrary()
                },
                modifier = Modifier.testTag("postGigV1_addPhoto_library"),
            )
        }
    }
}

@Composable
private fun PhotoTile(
    photo: PostGigV1Photo,
    isCover: Boolean,
    onRemove: (String) -> Unit,
    onRetry: (String) -> Unit,
    modifier: Modifier,
) {
    val fill =
        when (photo.tone) {
            PostGigV1PhotoTone.Sofa -> PantopusColors.primary100
            PostGigV1PhotoTone.Stairs -> PantopusColors.homeBg
            PostGigV1PhotoTone.Street -> PantopusColors.businessBg
            PostGigV1PhotoTone.Neutral -> PantopusColors.appSurfaceSunken
        }
    Box(
        modifier =
            modifier
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(fill)
                .border(
                    width = 1.dp,
                    color =
                        if (photo.status == PostGigV1PhotoStatus.Failed) {
                            PantopusColors.error
                        } else {
                            PantopusColors.appBorder
                        },
                    shape = RoundedCornerShape(Radii.lg),
                ),
    ) {
        if (photo.url != null) {
            AsyncImage(
                model = photo.url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().aspectRatio(1f),
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.appTextSecondary,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        // P0.2 — per-tile upload state overlays.
        when (photo.status) {
            PostGigV1PhotoStatus.Uploading ->
                Box(
                    modifier =
                        Modifier
                            .aspectRatio(1f)
                            .fillMaxWidth()
                            .background(PantopusColors.appText.copy(alpha = 0.35f))
                            .testTag("postGigV1_uploadingPhoto_${photo.id}"),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(
                        color = PantopusColors.appTextInverse,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(22.dp),
                    )
                }
            PostGigV1PhotoStatus.Failed ->
                Box(
                    modifier =
                        Modifier
                            .aspectRatio(1f)
                            .fillMaxWidth()
                            .background(PantopusColors.errorBg.copy(alpha = 0.85f))
                            .clickable { onRetry(photo.id) }
                            .testTag("postGigV1_retryPhoto_${photo.id}")
                            .semantics { contentDescription = "Upload failed, tap to retry" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.error,
                    )
                }
            PostGigV1PhotoStatus.Uploaded -> Unit
        }
        if (isCover) {
            Text(
                text = "Cover",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(Spacing.s1)
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.appText.copy(alpha = 0.78f))
                        .padding(horizontal = Spacing.s1),
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(5.dp)
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appText.copy(alpha = 0.72f))
                    .clickable { onRemove(photo.id) }
                    .testTag("postGigV1_removePhoto_${photo.id}")
                    .semantics { contentDescription = if (isCover) "Remove cover photo" else "Remove photo" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun PostGigV1ErrorBanner(
    errors: List<PostGigV1ValidationError>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("postGigV1_errorBanner")
                .semantics {
                    contentDescription = "${errors.size} problems. ${errors.joinToString(" ") { it.message }}"
                },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier.size(24.dp).clip(CircleShape).background(PantopusColors.error),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertTriangle,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1), modifier = Modifier.weight(1f)) {
            // A13.8 P4 — design-exact banner copy; per-field messages render
            // inline under the highlighted fields, not in the banner.
            Text(
                text = "${errors.size} problems — please fix",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.error,
            )
            Text(
                text = "We couldn't post your gig. See the highlighted fields below.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun InlineError(message: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.error,
        )
        // A13.8 P4 — design-exact 11sp inline error rows.
        Text(
            text = message,
            style = PantopusTextStyle.caption.copy(fontSize = 11.sp),
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun FieldLabel(
    title: String,
    required: Boolean,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = title,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        if (required) {
            Text(text = "*", style = PantopusTextStyle.caption, color = PantopusColors.error)
        }
    }
}

@Composable
private fun LegacyStamp() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2).testTag("postGigV1_legacyStamp"),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "gig composer · v1.4.2",
            style = PantopusTextStyle.caption.copy(fontFamily = FontFamily.Monospace),
            color = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = Spacing.s1),
        )
    }
}

@Composable
private fun PostGigV1Loading() {
    listOf(
        "Category",
        "Details",
        "Pay",
        "When",
        "Photos",
        "More details",
        "Items",
        "Cancellation",
    ).forEach { title ->
        FormFieldGroup(title = title) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurfaceSunken),
                )
                if (title == "Details") {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.appSurfaceSunken),
                    )
                }
            }
        }
    }
}

@Composable
private fun PostGigV1Empty(onStart: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s6)
                .testTag("postGigV1_empty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Briefcase,
                contentDescription = null,
                size = 30.dp,
                tint = PantopusColors.primary600,
            )
        }
        Text(
            text = "No quick-post draft",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = "Start with the V1 form when you already know the title, price, and time.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onStart)
                    .padding(horizontal = Spacing.s5)
                    .testTag("postGigV1_emptyStart")
                    .semantics { contentDescription = "Start quick post" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Start quick post",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun PostGigV1FatalError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s6)
                .testTag("postGigV1_error"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.errorBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertTriangle,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.error,
            )
        }
        Text(
            text = "Quick post unavailable",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(text = message, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        Text(
            text = "Retry",
            style = PantopusTextStyle.body,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4)
                    .testTag("postGigV1_retry"),
        )
    }
}

private fun List<PostGigV1ValidationError>.messageFor(field: PostGigV1Field): String? = firstOrNull { it.field == field }?.message

private fun List<PostGigV1ValidationError>.fieldState(field: PostGigV1Field): PantopusFieldState =
    messageFor(field)?.let { PantopusFieldState.Error(it) } ?: PantopusFieldState.Default

private fun GigsCategory.v1Label(): String = if (this == GigsCategory.Moving) "Moving & hauling" else label

private val PostGigV1DateFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US)
